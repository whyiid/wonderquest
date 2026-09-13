/* ===========================================================================
   WonderQuest — app.js
   Shell: router, Today screen, header stats, global taps.
   Screens live in their own files; this file only decides which one runs.
   =========================================================================== */
'use strict';

window.WQApp = (function () {

  const view = () => WQUI.$('#view');

  /* ── header stats ─────────────────────────────────────────────────────── */
  function refreshStats() {
    WQUI.$('#chip-streak').innerHTML = '🔥 <b>' + WQProgress.liveStreak() + '</b>';
    WQUI.$('#chip-xp').innerHTML = '⭐ <b>' + WQProgress.xp() + '</b>';
  }

  function applySettings() {
    document.body.dataset.text = WQProgress.settings().textSize || 'normal';
  }

  /* ── Today ────────────────────────────────────────────────────────────── */
  function today(host) {
    // A pinned topic that has been read has done its job. Drop it *silently*:
    // bumping the parent revision here would reshuffle today's cards behind him.
    WQProgress.parent().pinned
      .filter(id => WQProgress.isRead(id))
      .forEach(id => WQProgress.unpinSilently(id));

    const picks = WQDaily.pick();
    const allRead = picks.length > 0 && picks.every(t => WQProgress.isRead(t.id));
    const doneToday = picks.filter(t => WQProgress.isRead(t.id)).length;

    const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const streak = WQProgress.liveStreak();

    let note;
    if (allRead) note = 'You have read everything in the library — these are worth a second look.';
    else if (doneToday === picks.length) note = 'All done for today. See you tomorrow!';
    else if (doneToday > 0) note = doneToday + ' down, ' + (picks.length - doneToday) + ' to go.';
    else note = 'Three new things, about a minute each.';

    host.innerHTML = WQUI.screen("Today's Discoveries", date,
      '<p class="today-note">' + WQUI.esc(note) + '</p>' +
      (streak > 1 ? '<p class="streak-line">🔥 ' + streak + ' days in a row — keep it alive.</p>' : '') +
      '<div class="today-cards">' + picks.map(t => WQUI.card(t, 'big')).join('') + '</div>' +
      (picks.length === 0 ? WQUI.empty('📭', 'Library is empty', 'Ask Dad to add some topics.') : ''));
  }

  /* ── router ───────────────────────────────────────────────────────────── */
  function route() {
    const hash = location.hash || '#/today';
    const host = view();
    const parts = hash.replace(/^#\//, '').split('/');

    WQUI.$$('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === '#/' + parts[0]));
    window.scrollTo(0, 0);

    switch (parts[0]) {
      case 'article':    WQArticle.render(host, parts[1]); break;
      case 'explore':    WQExplore.home(host); break;
      case 'category':   WQExplore.category(host, parts[1]); break;
      case 'collection': WQCollection.render(host); break;
      case 'settings':   WQParent.settings(host); break;
      case 'parent':     WQParent.render(host); break;
      default:           today(host);
    }
    refreshStats();
  }

  /* ── global taps: [data-go] navigates, [data-open] opens an article ───── */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { location.hash = go.dataset.go; return; }
    const open = e.target.closest('[data-open]');
    if (open) { location.hash = '#/article/' + open.dataset.open; }
  });

  async function start() {
    WQProgress.load();
    applySettings();
    try {
      await WQData.init();
    } catch (e) {
      view().innerHTML = WQUI.empty('📡', 'Could not load the library',
        e.message + ' — WonderQuest needs to be opened from a web address, not a file on disk.');
      return;
    }
    window.addEventListener('hashchange', route);
    route();

    // Offline caching is for the real device, not the dev machine. On localhost
    // the worker would keep serving the previous build of every file, which
    // makes local changes appear not to work at all.
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isLocal) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { start, route, refreshStats, applySettings };
})();

document.addEventListener('DOMContentLoaded', WQApp.start);
