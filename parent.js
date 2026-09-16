/* ===========================================================================
   WonderQuest — parent.js
   Settings (for Matthew) and the PIN-gated parent panel (for Wahyu).

   Honest about what the PIN is: a door an 8-year-old will not walk through.
   It is stored in localStorage in plain text and is trivially bypassed by
   anyone who can open developer tools. Nothing sensitive belongs in here.
   =========================================================================== */
'use strict';

window.WQParent = (function () {

  const esc = (s) => WQUI.esc(s);
  let unlocked = false;   // resets on every reload, by design

  /* ── Settings (open to Matthew) ───────────────────────────────────────── */
  function settings(host) {
    const s = WQProgress.settings();
    const sizes = ['normal', 'large', 'huge'];

    host.innerHTML = WQUI.screen('Settings', null,
      '<div class="panel">' +
        '<h3>Text size</h3>' +
        '<div class="seg">' + sizes.map(v =>
          '<button class="seg-btn' + (s.textSize === v ? ' on' : '') + '" data-size="' + v + '">' +
          v.charAt(0).toUpperCase() + v.slice(1) + '</button>').join('') + '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>Your progress</h3>' +
        '<p class="muted">' + WQUI.plural(WQProgress.readCount(), 'topic') + ' read · ' +
        WQProgress.xp() + ' wonder points · best streak ' +
        WQUI.plural(WQProgress.streakBest(), 'day') + '</p>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>Grown-ups</h3>' +
        '<p class="muted">A panel for parents, behind a PIN.</p>' +
        '<button class="btn" id="to-parent">Open parent panel</button>' +
      '</div>' +
      '<p class="version">WonderQuest · made for Matthew</p>');

    WQUI.$$('.seg-btn', host).forEach(b => b.addEventListener('click', () => {
      WQProgress.setSetting('textSize', b.dataset.size);
      WQApp.applySettings();
      settings(host);
    }));
    WQUI.$('#to-parent', host).addEventListener('click', () => { location.hash = '#/parent'; });
  }

  /* ── PIN gate ─────────────────────────────────────────────────────────── */
  function gate(host) {
    const hasPin = !!WQProgress.parent().pin;

    host.innerHTML = '<button class="back" data-go="#/settings">‹ Settings</button>' +
      WQUI.screen('Parent panel', hasPin ? 'Enter your 4-digit PIN.' : 'Set a 4-digit PIN to protect this panel.',
      '<div class="panel pin-panel">' +
        '<input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" />' +
        '<button class="btn btn-primary" id="pin-go">' + (hasPin ? 'Unlock' : 'Set PIN') + '</button>' +
        '<p class="pin-msg" id="pin-msg"></p>' +
        '<p class="muted small">This keeps a child out. It is not real security — the PIN is stored on this device in plain text.</p>' +
      '</div>');

    const input = WQUI.$('#pin', host);
    const msg = WQUI.$('#pin-msg', host);
    const submit = () => {
      const v = input.value.trim();
      if (!/^\d{4}$/.test(v)) { msg.textContent = 'Four digits, please.'; return; }
      if (!hasPin) { WQProgress.setPin(v); unlocked = true; panel(host); return; }
      if (WQProgress.checkPin(v)) { unlocked = true; panel(host); }
      else { msg.textContent = 'Not quite. Try again.'; input.value = ''; }
    };
    WQUI.$('#pin-go', host).addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  /* Every article carries a readingLevel (1 Easy, 2 Standard, 3 Challenging),
     set once by hand against how abstract the idea is — not word count. This
     panel is the only thing that ever narrows it: Today and Explore simply
     hide anything above the chosen ceiling. Default is 3 (everything), so the
     library reads exactly as it always has until a parent acts here. */
  function levelPanelHTML() {
    const cap = WQProgress.parent().maxLevel || 3;
    const topics = WQData.topics();
    const counts = { 1: 0, 2: 0, 3: 0 };
    const read = { 1: 0, 2: 0, 3: 0 };
    topics.forEach(t => {
      const lv = t.readingLevel || 1;
      counts[lv]++;
      if (WQProgress.isRead(t.id)) read[lv]++;
    });

    const opts = [[1, 'Easy only'], [2, 'Easy + Standard'], [3, 'Everything']];
    return '<div class="panel">' +
      '<h3>Reading level</h3>' +
      '<p class="muted small">Today and Explore only ever show this level or below. Raise it as he grows — nothing to rebuild, it just opens up.</p>' +
      '<div class="seg">' + opts.map(([v, label]) =>
        '<button class="seg-btn' + (v === cap ? ' on' : '') + '" data-cap="' + v + '">' + label + '</button>'
      ).join('') + '</div>' +
      '<p class="muted small level-breakdown">' +
        [1, 2, 3].map(lv => WQUI.LEVEL_NAMES[lv] + ' ' + read[lv] + '/' + counts[lv]).join(' · ') +
      '</p>' +
    '</div>';
  }

  /* ── The panel itself ─────────────────────────────────────────────────── */
  function panel(host) {
    const history = WQProgress.readHistory(30);
    const shaky = WQProgress.shaky();
    const pinned = WQProgress.parent().pinned;

    const historyHTML = history.length
      ? '<ul class="plist">' + history.slice(0, 30).map(r => {
          const t = WQData.topic(r.id);
          return '<li><span class="pday">' + esc(r.day) + '</span>' +
                 '<span class="pname">' + esc(t ? t.title : r.id) + '</span>' +
                 '<span class="pscore">' + (r.total ? r.score + '/' + r.total : '–') + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">Nothing read yet.</p>';

    const shakyHTML = shaky.length
      ? '<ul class="plist">' + shaky.slice(0, 10).map(r => {
          const t = WQData.topic(r.id);
          return '<li><span class="pname">' + esc(t ? t.title : r.id) + '</span>' +
                 '<span class="pscore">' + r.score + '/' + r.total + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">Nothing to worry about — every quiz was full marks.</p>';

    const queue = WQData.topics().filter(t => !WQProgress.isRead(t.id));
    const queueHTML = '<div class="ptopics">' + queue.map(t => {
      const isPinned = pinned.indexOf(t.id) !== -1;
      const isHidden = WQProgress.isHidden(t.id);
      return '<div class="ptopic' + (isHidden ? ' hidden-topic' : '') + '">' +
        '<span class="pname">' + esc(t.emoji) + ' ' + esc(t.title) + '</span>' +
        '<span class="pacts">' +
          '<button class="mini' + (isPinned ? ' on' : '') + '" data-pin="' + esc(t.id) + '">' + (isPinned ? '📌 Pinned' : 'Pin') + '</button>' +
          '<button class="mini' + (isHidden ? ' on' : '') + '" data-hide="' + esc(t.id) + '">' + (isHidden ? 'Hidden' : 'Hide') + '</button>' +
        '</span></div>';
    }).join('') + '</div>';

    host.innerHTML = '<button class="back" data-go="#/settings">‹ Settings</button>' +
      WQUI.screen('Parent panel',
        WQUI.plural(WQProgress.liveStreak(), 'day') + ' streak · ' +
        WQUI.plural(WQProgress.readCount(), 'topic') + ' read',
      levelPanelHTML() +
      '<div class="panel"><h3>Last 30 days</h3>' + historyHTML + '</div>' +
      '<div class="panel"><h3>Worth revisiting</h3>' + shakyHTML + '</div>' +
      '<div class="panel"><h3>Tomorrow\'s queue</h3>' +
        '<p class="muted small">Pinned topics come first on Today. Hidden topics never appear.</p>' +
        queueHTML + '</div>' +
      '<div class="panel"><h3>Backup</h3>' +
        '<p class="muted small">Progress lives only on this device. Export to move it to another one.</p>' +
        '<div class="row">' +
          '<button class="btn" id="export">Export progress</button>' +
          '<label class="btn file-btn">Import<input id="import" type="file" accept="application/json" hidden /></label>' +
        '</div>' +
        '<p class="pin-msg" id="io-msg"></p>' +
      '</div>');

    WQUI.$$('[data-cap]', host).forEach(b => b.addEventListener('click', () => {
      WQProgress.setMaxLevel(Number(b.dataset.cap)); panel(host);
    }));
    WQUI.$$('[data-pin]', host).forEach(b => b.addEventListener('click', () => {
      WQProgress.togglePinned(b.dataset.pin); panel(host);
    }));
    WQUI.$$('[data-hide]', host).forEach(b => b.addEventListener('click', () => {
      WQProgress.toggleHidden(b.dataset.hide); panel(host);
    }));

    WQUI.$('#export', host).addEventListener('click', () => {
      const blob = new Blob([WQProgress.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'wonderquest-progress-' + WQProgress.today() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    WQUI.$('#import', host).addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const msg = WQUI.$('#io-msg', host);
      if (!file) return;
      try {
        WQProgress.importJSON(await file.text());
        WQApp.refreshStats();
        msg.textContent = 'Progress restored.';
        panel(host);
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }

  function render(host) {
    if (unlocked) panel(host); else gate(host);
  }

  return { settings, render };
})();
