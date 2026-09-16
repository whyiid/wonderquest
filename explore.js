/* ===========================================================================
   WonderQuest — explore.js
   The "real encyclopedia" surface: categories, a category listing, and search.
   =========================================================================== */
'use strict';

window.WQExplore = (function () {

  const esc = (s) => WQUI.esc(s);

  /* What Matthew is allowed to see: not hidden by a parent, and not above the
     parent's reading-level ceiling (default 3 — everything). */
  function visible(topics) {
    const maxLevel = WQProgress.parent().maxLevel || 3;
    return topics.filter(t => !WQProgress.isHidden(t.id) && (t.readingLevel || 1) <= maxLevel);
  }

  function home(host) {
    const cats = WQData.categories().map(c => {
      const all = visible(WQData.topicsIn(c.id));
      const read = all.filter(t => WQProgress.isRead(t.id)).length;
      return '' +
        '<button class="cat" data-cat="' + esc(c.id) + '" style="--c1:' + esc(c.c1) + ';--c2:' + esc(c.c2) + '">' +
          '<span class="cat-emoji">' + esc(c.emoji) + '</span>' +
          '<span class="cat-name">' + esc(c.name) + '</span>' +
          '<span class="cat-blurb">' + esc(c.blurb) + '</span>' +
          '<span class="cat-count">' + read + ' / ' + all.length + ' read</span>' +
        '</button>';
    }).join('');

    host.innerHTML = WQUI.screen('Explore', 'Wonder about something right now? Look it up.',
      '<div class="searchbar">' +
        '<input id="q" type="search" placeholder="Search the library…" autocomplete="off" enterkeyhint="search" />' +
      '</div>' +
      '<div id="results"></div>' +
      '<div class="cat-grid" id="cats">' + cats + '</div>');

    const input = WQUI.$('#q', host);
    const results = WQUI.$('#results', host);
    const grid = WQUI.$('#cats', host);

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; grid.hidden = false; return; }
      grid.hidden = true;
      const hits = visible(WQData.search(q));
      results.innerHTML = hits.length
        ? '<p class="result-count">' + hits.length + ' found</p><div class="list">' + hits.map(t => WQUI.card(t, 'small')).join('') + '</div>'
        : WQUI.empty('🤔', 'Nothing yet', 'No article about "' + q + '" — ask Dad to add one.');
    });

    WQUI.$$('.cat', host).forEach(b => {
      b.addEventListener('click', () => { location.hash = '#/category/' + b.dataset.cat; });
    });
  }

  /* Level filter row: All / Easy / Standard / Challenging. Local to whichever
     screen renders it — not a saved setting, just a browsing aid he re-picks
     each visit. */
  function levelFilterHTML(active) {
    const opts = [[0, 'All'], [1, 'Easy'], [2, 'Standard'], [3, 'Challenging']];
    return '<div class="seg level-filter">' + opts.map(([v, label]) =>
      '<button class="seg-btn' + (v === active ? ' on' : '') + '" data-level="' + v + '">' + label + '</button>'
    ).join('') + '</div>';
  }

  function category(host, id, level) {
    const c = WQData.category(id);
    if (!c) { host.innerHTML = WQUI.empty('🔍', 'Unknown category', 'That shelf does not exist.'); return; }

    level = level || 0;
    const all = visible(WQData.topicsIn(id));
    const shown = level ? all.filter(t => (t.readingLevel || 1) === level) : all;

    host.innerHTML = '<button class="back" data-go="#/explore">‹ Explore</button>' +
      WQUI.screen(c.emoji + ' ' + c.name, c.blurb,
        levelFilterHTML(level) +
        (shown.length ? '<div class="list">' + shown.map(t => WQUI.card(t, 'small')).join('') + '</div>'
                      : WQUI.empty('📭', level ? 'None at this level' : 'Empty shelf',
                          level ? 'Try a different level, or All.' : 'No articles here yet.')));

    WQUI.$$('.level-filter .seg-btn', host).forEach(b => {
      b.addEventListener('click', () => category(host, id, Number(b.dataset.level)));
    });
  }

  return { home, category };
})();
