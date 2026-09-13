/* ===========================================================================
   WonderQuest — data.js
   Content loading. Two rules live here and nowhere else:

   1. Startup loads ONLY content/index.json (cards + search, no article bodies).
   2. A category's full articles load the first time one of its topics is
      opened, then stay in memory.

   That is what lets the library grow to hundreds of articles without the app
   getting slower to start.
   =========================================================================== */
'use strict';

window.WQData = (function () {

  let index = null;                 // { version, categories, topics }
  const articleCache = {};          // categoryId -> { articleId: article }

  async function init() {
    const res = await fetch('content/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not load the library (HTTP ' + res.status + ')');
    index = await res.json();
    return index;
  }

  function categories() { return index ? index.categories : []; }

  function category(id) { return categories().find(c => c.id === id) || null; }

  function topics() { return index ? index.topics : []; }

  function topic(id) { return topics().find(t => t.id === id) || null; }

  function topicsIn(categoryId) { return topics().filter(t => t.category === categoryId); }

  /* Full article body — lazily fetches the whole category file once. */
  async function article(id) {
    const t = topic(id);
    if (!t) return null;
    if (!articleCache[t.category]) {
      const res = await fetch('content/' + t.category + '.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Could not load ' + t.category + ' articles');
      const list = await res.json();
      const map = {};
      // reviewed !== true never reaches the reader, matching build-index.js
      list.filter(a => a.reviewed === true).forEach(a => { map[a.id] = a; });
      articleCache[t.category] = map;
    }
    return articleCache[t.category][id] || null;
  }

  function search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    return topics().filter(t => t.keywords.indexOf(q) !== -1 || t.title.toLowerCase().indexOf(q) !== -1);
  }

  return { init, categories, category, topics, topic, topicsIn, article, search };
})();
