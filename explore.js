/* ===========================================================================
   WonderQuest — explore.js
   The "real encyclopedia" surface: categories, a category listing, and search.
   =========================================================================== */
'use strict';

window.WQExplore = (function () {

  const esc = (s) => WQUI.esc(s);

  function visible(topics) {
    return topics.filter(t => !WQProgress.isHidden(t.id));
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

  function category(host, id) {
    const c = WQData.category(id);
    if (!c) { host.innerHTML = WQUI.empty('🔍', 'Unknown category', 'That shelf does not exist.'); return; }

    const all = visible(WQData.topicsIn(id));
    host.innerHTML = '<button class="back" data-go="#/explore">‹ Explore</button>' +
      WQUI.screen(c.emoji + ' ' + c.name, c.blurb,
        all.length ? '<div class="list">' + all.map(t => WQUI.card(t, 'small')).join('') + '</div>'
                   : WQUI.empty('📭', 'Empty shelf', 'No articles here yet.'));
  }

  return { home, category };
})();
