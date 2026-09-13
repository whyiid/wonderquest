#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — validate-content.js
   The one automated check in this app. Run it before every commit.

   It guards the failure class that actually threatens WonderQuest: broken
   content. Logic bugs are caught by using the app; a malformed article or a
   stale index.json is invisible until Matthew taps a card and gets nothing.

   Usage:  node tools/validate-content.js
   Exits 1 on any error.
   =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const MAX_WORDS = 600;   // hook + story + wow + discovery + unknown
// Articles come in two shapes: the original ones carry optional discovery and
// unknown sections, the newer categories are hook + story + wow only. 250 is
// the floor that flags genuinely thin writing without nagging about either.
const MIN_WORDS = 250;

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(path.relative(ROOT, file) + ': not valid JSON — ' + e.message);
    return null;
  }
}

/* `story` is an array of paragraphs (a plain string is still accepted). */
function words(s) {
  const text = Array.isArray(s) ? s.join(' ') : s;
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/* ── categories ──────────────────────────────────────────────────────── */
const categories = readJSON(path.join(CONTENT, 'categories.json')) || [];
const catIds = new Set(categories.map(c => c.id));

for (const c of categories) {
  for (const f of ['id', 'name', 'emoji', 'blurb', 'c1', 'c2']) {
    if (!c[f]) fail('categories.json: category "' + (c.id || '?') + '" missing "' + f + '"');
  }
}

/* ── articles ────────────────────────────────────────────────────────── */
const seenIds = new Set();
const reviewed = [];
let total = 0;

for (const cat of categories) {
  const file = path.join(CONTENT, cat.id + '.json');
  if (!fs.existsSync(file)) { warn('no article file for category "' + cat.id + '"'); continue; }

  const articles = readJSON(file);
  if (!Array.isArray(articles)) { fail(cat.id + '.json: expected an array of articles'); continue; }

  for (const a of articles) {
    total++;
    const where = cat.id + '.json → "' + (a.id || a.title || '?') + '"';

    for (const f of ['id', 'category', 'title', 'hook', 'story', 'wow', 'quiz']) {
      if (a[f] === undefined || a[f] === null || a[f] === '') fail(where + ': missing "' + f + '"');
    }

    if (a.id) {
      if (seenIds.has(a.id)) fail(where + ': duplicate id "' + a.id + '"');
      seenIds.add(a.id);
      if (!/^[a-z0-9-]+$/.test(a.id)) fail(where + ': id must be lowercase letters, digits and dashes only');
    }

    if (a.category !== cat.id) fail(where + ': category "' + a.category + '" does not match its file');
    if (a.category && !catIds.has(a.category)) fail(where + ': unknown category "' + a.category + '"');

    const wc = words(a.hook) + words(a.story) + words(a.wow) + words(a.discovery) + words(a.unknown);
    if (wc > MAX_WORDS) fail(where + ': ' + wc + ' words — over the ' + MAX_WORDS + '-word limit (split it into two articles)');
    else if (wc < MIN_WORDS) warn(where + ': only ' + wc + ' words — thinner than the ' + MIN_WORDS + '-word target');

    // `discovery` and `unknown` are optional on purpose: plenty of topics have
    // no named discoverer or no open question worth a child's attention, and a
    // forced section would be padding. The Great Discoveries, How We Got Here,
    // People and Nobody Knows Yet categories carry that material instead.

    if (Array.isArray(a.story) && a.story.length > 4) {
      warn(where + ': ' + a.story.length + ' paragraphs — three is the house shape, four at most');
    }

    if (!Array.isArray(a.quiz) || a.quiz.length < 1) {
      fail(where + ': needs at least one quiz question');
    } else {
      a.quiz.forEach((q, i) => {
        const qw = where + ' quiz[' + i + ']';
        if (!q.q) fail(qw + ': missing question text');
        if (!Array.isArray(q.a) || q.a.length < 2) fail(qw + ': needs at least two answers');
        else if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.a.length) {
          fail(qw + ': "correct" must be a valid index into the answers');
        }
      });
    }

    if (a.image) {
      const img = path.join(ROOT, a.image);
      if (!fs.existsSync(img)) fail(where + ': image file not found — ' + a.image);
    } else if (!a.emoji) {
      fail(where + ': needs either an "image" or an "emoji" to show on its card');
    }

    if (a.reviewed !== true && a.reviewed !== false) fail(where + ': "reviewed" must be true or false');
    if (a.reviewed === true) reviewed.push(a);
    if (a.reviewed === true && a.factRisk === true && !a.image) {
      warn(where + ': marked factRisk with no illustration yet — check the image carefully when one is added');
    }
  }
}

/* ── index.json must match ───────────────────────────────────────────── */
const indexPath = path.join(CONTENT, 'index.json');
if (!fs.existsSync(indexPath)) {
  fail('content/index.json missing — run: node tools/build-index.js');
} else {
  const index = readJSON(indexPath);
  if (index) {
    const inIndex = new Set((index.topics || []).map(t => t.id));
    const shouldBe = new Set(reviewed.map(a => a.id));

    for (const id of shouldBe) {
      if (!inIndex.has(id)) fail('index.json is stale: "' + id + '" is reviewed but not indexed — run: node tools/build-index.js');
    }
    for (const id of inIndex) {
      if (!shouldBe.has(id)) fail('index.json is stale: "' + id + '" is indexed but not a reviewed article — run: node tools/build-index.js');
    }
    if ((index.categories || []).length !== categories.length) {
      fail('index.json is stale: category count differs — run: node tools/build-index.js');
    }
  }
}

/* ── report ──────────────────────────────────────────────────────────── */
console.log('WonderQuest content check');
console.log('  articles: ' + total + '  (reviewed and live: ' + reviewed.length + ')');
warnings.forEach(w => console.log('  ⚠ ' + w));

if (errors.length) {
  console.log('\n  ' + errors.length + ' problem(s):');
  errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('  ✓ all checks passed');
