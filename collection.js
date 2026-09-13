/* ===========================================================================
   WonderQuest — collection.js
   The album. Deliberately a second view over progress data, not a second data
   model: empty slots are simply topics he has not read yet.
   =========================================================================== */
'use strict';

window.WQCollection = (function () {

  const esc = (s) => WQUI.esc(s);

  function render(host) {
    const cats = WQData.categories();
    const totalRead = WQProgress.readCount();
    const totalAll = WQData.topics().filter(t => !WQProgress.isHidden(t.id)).length;

    const shelves = cats.map(c => {
      const all = WQData.topicsIn(c.id).filter(t => !WQProgress.isHidden(t.id));
      const read = all.filter(t => WQProgress.isRead(t.id));
      const slots = all.map(t => {
        return WQProgress.isRead(t.id)
          ? '<button class="slot filled" data-open="' + esc(t.id) + '" title="' + esc(t.title) + '" ' +
            'style="--c1:' + esc(c.c1) + ';--c2:' + esc(c.c2) + '">' + esc(t.emoji) + '</button>'
          : '<span class="slot" title="Not discovered yet">?</span>';
      }).join('');

      return '<div class="shelf">' +
        '<div class="shelf-head"><h3>' + esc(c.emoji) + ' ' + esc(c.name) + '</h3>' +
        '<span class="shelf-count">' + read.length + ' / ' + all.length + '</span></div>' +
        '<div class="slots">' + slots + '</div></div>';
    }).join('');

    const lvl = WQProgress.level();
    host.innerHTML = WQUI.screen('Collection', totalRead + ' of ' + totalAll + ' discovered',
      '<div class="levelbar">' +
        '<div class="level-top"><b>Level ' + lvl + '</b><span>' + WQProgress.xp() + ' ⭐</span></div>' +
        '<div class="level-track"><i style="width:' + WQProgress.xpInLevel() + '%"></i></div>' +
        '<p class="level-note">' + (100 - WQProgress.xpInLevel()) + ' points to level ' + (lvl + 1) + '</p>' +
      '</div>' +
      '<div class="badges">' + badges() + '</div>' +
      shelves);
  }

  /* Badges are derived, never stored — they can be changed later without a
     migration, and cannot get out of sync with the real progress. */
  function badges() {
    const read = WQProgress.readCount();
    const streak = WQProgress.liveStreak();
    const best = WQProgress.streakBest();
    const perfect = WQProgress.readHistory().filter(r => r.total && r.score === r.total).length;

    const list = [
      { on: read >= 1,   emoji: '🌱', name: 'First discovery' },
      { on: read >= 10,  emoji: '📚', name: '10 topics' },
      { on: read >= 25,  emoji: '🎓', name: '25 topics' },
      { on: best >= 3,   emoji: '🔥', name: '3-day streak' },
      { on: best >= 7,   emoji: '🏆', name: '7-day streak' },
      { on: perfect >= 5, emoji: '🎯', name: '5 perfect quizzes' }
    ];
    void streak;
    return list.map(b =>
      '<div class="badge' + (b.on ? ' on' : '') + '"><span>' + b.emoji + '</span>' + WQUI.esc(b.name) + '</div>'
    ).join('');
  }

  return { render };
})();
