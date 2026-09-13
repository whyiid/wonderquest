/* ===========================================================================
   WonderQuest — ui.js
   Shared rendering helpers. Anything drawn in more than one screen lives here
   so a topic card looks identical on Today, Explore, Search and Collection.
   =========================================================================== */
'use strict';

window.WQUI = (function () {

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* Article text is authored by us, but it still goes through escaping —
     the review page and any future import must never be able to inject markup. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function catOf(topic) {
    return WQData.category(topic.category) || { c1: '#8b5cf6', c2: '#3b82f6', name: '', emoji: '❓' };
  }

  /* The one and only topic card. `size` is 'big' (Today) or 'small' (lists). */
  function card(topic, size) {
    const c = catOf(topic);
    const read = WQProgress.isRead(topic.id);
    const art = topic.image
      ? '<img class="card-img" src="' + esc(topic.image) + '" alt="" loading="lazy" />'
      : '<span class="card-emoji">' + esc(topic.emoji) + '</span>';

    return '' +
      '<button class="card card-' + (size || 'small') + (read ? ' is-read' : '') + '" data-open="' + esc(topic.id) + '">' +
        '<span class="card-art" style="--c1:' + esc(c.c1) + ';--c2:' + esc(c.c2) + '">' + art +
          (read ? '<span class="card-tick" aria-label="Already read">✓</span>' : '') +
        '</span>' +
        '<span class="card-body">' +
          '<span class="card-cat">' + esc(c.emoji) + ' ' + esc(c.name) + '</span>' +
          '<span class="card-title">' + esc(topic.title) + '</span>' +
          (size === 'big' ? '<span class="card-hook">' + esc(topic.hook) + '</span>' : '') +
        '</span>' +
      '</button>';
  }

  /* "1 day" / "2 days" — a child notices bad grammar in an app about learning. */
  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }

  function empty(emoji, title, line) {
    return '<div class="empty"><div class="empty-emoji">' + esc(emoji) + '</div>' +
           '<h3>' + esc(title) + '</h3><p>' + esc(line) + '</p></div>';
  }

  function screen(title, subtitle, bodyHTML) {
    return '<section class="screen">' +
      '<h1 class="screen-title">' + esc(title) + '</h1>' +
      (subtitle ? '<p class="screen-sub">' + esc(subtitle) + '</p>' : '') +
      bodyHTML + '</section>';
  }

  return { $, $$, esc, card, empty, screen, catOf, plural };
})();
