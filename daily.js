/* ===========================================================================
   WonderQuest — daily.js
   Picks the three cards for today.

   Deterministic by date: the same day always produces the same three topics,
   so closing and reopening the app does not reshuffle them (which would make
   the "today" promise meaningless and let him re-roll until he likes one).

   Order of precedence:
     1. topics the parent pinned  (always first, then un-pinned automatically
        once read — handled by the caller)
     2. one topic from his most-read category      → the comfortable pick
     3. one topic from a category he reads least   → the stretch pick
     4. one topic from anywhere                    → the wildcard
   Hidden topics never appear. When everything is read, it falls back to
   revisiting old ones rather than showing an empty screen.
   =========================================================================== */
'use strict';

window.WQDaily = (function () {

  const COUNT = 3;

  /* Small deterministic hash → seeded RNG (mulberry32). */
  function seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickOne(list, rand) {
    if (!list.length) return null;
    return list[Math.floor(rand() * list.length)];
  }

  /* Which categories he reads most / least, from his own history. */
  function categoryCounts() {
    const counts = {};
    WQData.categories().forEach(c => { counts[c.id] = 0; });
    WQProgress.readHistory().forEach(r => {
      const t = WQData.topic(r.id);
      if (t && counts[t.category] !== undefined) counts[t.category]++;
    });
    return counts;
  }

  /* Today's three are chosen once and then frozen for the rest of the day, so
     a card he has already read stays on the screen with a tick instead of
     being silently swapped for a fresh one. The freeze is released when the
     day changes, or when a parent pins/hides something (that should take
     effect immediately, not tomorrow). */
  function pick(dayString) {
    const day = dayString || WQProgress.today();
    const pinSig = String(WQProgress.parent().rev || 0);

    if (!dayString) {
      const saved = WQProgress.dailyPick();
      if (saved.day === day && saved.pinSig === pinSig && saved.ids.length) {
        const topics = saved.ids.map(id => WQData.topic(id)).filter(Boolean);
        if (topics.length) return topics;
      }
    }

    const chosenTopics = choose(day);
    if (!dayString) WQProgress.setDailyPick(chosenTopics.map(t => t.id), pinSig);
    return chosenTopics;
  }

  function choose(day) {
    const rand = rng(seedFrom(day));

    const hidden = id => WQProgress.isHidden(id);
    // A topic above the parent's ceiling is treated exactly like a hidden one
    // here: it must never reach Today, pinned or not, until the ceiling is
    // raised. Default ceiling is 3 (everything), so this changes nothing
    // unless a parent has deliberately narrowed it.
    const maxLevel = WQProgress.parent().maxLevel || 3;
    const allowed = t => (t.readingLevel || 1) <= maxLevel;
    const unread = WQData.topics().filter(t => !WQProgress.isRead(t.id) && !hidden(t.id) && allowed(t));

    const chosen = [];
    const take = t => { if (t && !chosen.some(c => c.id === t.id)) chosen.push(t); };

    // 1. parent pins first
    WQProgress.parent().pinned
      .map(id => WQData.topic(id))
      .filter(t => t && !WQProgress.isRead(t.id) && !hidden(t.id) && allowed(t))
      .slice(0, COUNT)
      .forEach(take);

    if (unread.length) {
      const counts = categoryCounts();
      const byCount = WQData.categories().slice().sort((a, b) => counts[b.id] - counts[a.id]);
      const favourite = byCount[0] ? byCount[0].id : null;
      const neglected = byCount[byCount.length - 1] ? byCount[byCount.length - 1].id : null;

      // 2. comfortable pick
      if (chosen.length < COUNT) take(pickOne(unread.filter(t => t.category === favourite), rand));
      // 3. stretch pick
      if (chosen.length < COUNT) {
        take(pickOne(unread.filter(t => t.category === neglected && !chosen.some(c => c.id === t.id)), rand));
      }
      // 4. wildcard(s)
      let guard = 0;
      while (chosen.length < COUNT && guard++ < 50) {
        const rest = unread.filter(t => !chosen.some(c => c.id === t.id));
        if (!rest.length) break;
        take(pickOne(rest, rand));
      }
    }

    // Library exhausted → revisit, clearly marked by the caller.
    if (chosen.length < COUNT) {
      const revisit = WQData.topics().filter(t => !hidden(t.id) && allowed(t) && !chosen.some(c => c.id === t.id));
      let guard = 0;
      while (chosen.length < COUNT && revisit.length && guard++ < 50) take(pickOne(revisit, rand));
    }

    return chosen.slice(0, COUNT);
  }

  return { pick, COUNT };
})();
