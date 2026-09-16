/* ===========================================================================
   WonderQuest — progress.js
   Everything the app remembers about Matthew, in localStorage. No account,
   no server: nothing about a child leaves the device.

   Shape:
     read     { topicId: { day, score, total } }
     streak   { count, best, lastDay }
     xp       number
     settings { textSize }
     parent   { pin, pinned[], hidden[], maxLevel }
   =========================================================================== */
'use strict';

window.WQProgress = (function () {

  const KEY = 'wonderquest.v1';

  const blank = () => ({
    read: {},
    streak: { count: 0, best: 0, lastDay: null },
    xp: 0,
    // today's three, frozen for the day — see daily.js
    daily: { day: null, ids: [], pinSig: '' },
    settings: { textSize: 'normal' },
    // maxLevel gates both Today and Explore: a topic with readingLevel above
    // this never reaches him. Defaults to 3 (everything) — every article ever
    // written was readingLevel 3 until this cap existed, so an unrestricted
    // default means turning this feature on changes nothing for him unless a
    // parent deliberately narrows it.
    parent: { pin: null, pinned: [], hidden: [], maxLevel: 3, rev: 0 }
  });

  let state = blank();

  /* ── day helpers (local time, not UTC — the streak must match his day) ── */
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = Object.assign(blank(), saved);
        state.settings = Object.assign(blank().settings, saved.settings || {});
        state.parent = Object.assign(blank().parent, saved.parent || {});
        state.streak = Object.assign(blank().streak, saved.streak || {});
        state.daily = Object.assign(blank().daily, saved.daily || {});
      }
    } catch (e) {
      // A corrupt save must never block the app — start clean rather than crash.
      state = blank();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ── streak ────────────────────────────────────────────────────────────
     Called when he finishes an article, not when he opens the app: the
     streak should mean "I learned something", not "I tapped the icon". */
  function touchStreak() {
    const t = today();
    const last = state.streak.lastDay;
    if (last === t) return state.streak;
    if (last && daysBetween(last, t) === 1) state.streak.count += 1;
    else state.streak.count = 1;
    state.streak.lastDay = t;
    if (state.streak.count > state.streak.best) state.streak.best = state.streak.count;
    save();
    return state.streak;
  }

  /* A streak shown on screen must not lie: if he missed yesterday, it is over. */
  function liveStreak() {
    const last = state.streak.lastDay;
    if (!last) return 0;
    const gap = daysBetween(last, today());
    return gap <= 1 ? state.streak.count : 0;
  }

  function isRead(id) { return !!state.read[id]; }
  function readCount() { return Object.keys(state.read).length; }

  function markRead(id, score, total) {
    const first = !state.read[id];
    state.read[id] = { day: today(), score: score, total: total };
    if (first) state.xp += 10 + (score * 5);
    touchStreak();
    save();
    return first;
  }

  function readHistory(limitDays) {
    const cutoff = limitDays ? new Date(Date.now() - limitDays * 86400000) : null;
    return Object.keys(state.read)
      .map(id => Object.assign({ id: id }, state.read[id]))
      .filter(r => !cutoff || new Date(r.day + 'T00:00:00') >= cutoff)
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }

  /* Topics he got wrong — the parent panel's most useful signal. */
  function shaky() {
    return readHistory().filter(r => r.total && r.score < r.total);
  }

  function level() { return Math.floor(state.xp / 100) + 1; }
  function xpInLevel() { return state.xp % 100; }

  /* ── parent settings ─────────────────────────────────────────────────── */
  function parent() { return state.parent; }
  function setPin(pin) { state.parent.pin = pin ? String(pin) : null; save(); }
  function checkPin(pin) { return state.parent.pin && String(pin) === state.parent.pin; }

  /* `rev` counts deliberate parent edits. Today's frozen card list is keyed to
     it, so a parent's pin takes effect immediately — while housekeeping such as
     dropping an already-read pin (unpinSilently) leaves the day undisturbed. */
  function togglePinned(id) {
    const i = state.parent.pinned.indexOf(id);
    if (i === -1) state.parent.pinned.push(id); else state.parent.pinned.splice(i, 1);
    state.parent.rev = (state.parent.rev || 0) + 1;
    save();
  }
  function toggleHidden(id) {
    const i = state.parent.hidden.indexOf(id);
    if (i === -1) state.parent.hidden.push(id); else state.parent.hidden.splice(i, 1);
    state.parent.rev = (state.parent.rev || 0) + 1;
    save();
  }
  function unpinSilently(id) {
    const i = state.parent.pinned.indexOf(id);
    if (i !== -1) { state.parent.pinned.splice(i, 1); save(); }
  }
  function isHidden(id) { return state.parent.hidden.indexOf(id) !== -1; }

  function setMaxLevel(n) {
    state.parent.maxLevel = n;
    state.parent.rev = (state.parent.rev || 0) + 1;
    save();
  }

  /* ── today's frozen pick ─────────────────────────────────────────────── */
  function dailyPick() { return state.daily; }
  function setDailyPick(ids, pinSig) {
    state.daily = { day: today(), ids: ids.slice(), pinSig: pinSig };
    save();
  }

  function settings() { return state.settings; }
  function setSetting(k, v) { state.settings[k] = v; save(); }

  /* ── export / import — the manual bridge between iPad and phone ─────── */
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    const incoming = JSON.parse(text);
    if (!incoming || typeof incoming !== 'object' || !incoming.read) throw new Error('That file is not a WonderQuest backup.');
    state = Object.assign(blank(), incoming);
    save();
    return true;
  }

  function reset() { state = blank(); save(); }

  return {
    load, save, today, isRead, readCount, markRead, readHistory, shaky,
    liveStreak, streakBest: () => state.streak.best,
    xp: () => state.xp, level, xpInLevel,
    parent, setPin, checkPin, togglePinned, toggleHidden, unpinSilently, isHidden, setMaxLevel,
    dailyPick, setDailyPick,
    settings, setSetting, exportJSON, importJSON, reset
  };
})();
