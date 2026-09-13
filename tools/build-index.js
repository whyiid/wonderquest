#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — build-index.js
   Rebuilds content/index.json from the per-category article files.

   index.json is the ONLY content file loaded at startup. It holds just enough
   per topic to render a card and to search (no story, no quiz), so the app
   stays fast whether the library has 20 articles or 800.

   Articles with reviewed !== true are skipped on purpose: an unreviewed
   article must never reach Matthew.

   Usage:  node tools/build-index.js
   =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const categories = readJSON(path.join(CONTENT, 'categories.json'));

const topics = [];
let skipped = 0;

for (const cat of categories) {
  const file = path.join(CONTENT, cat.id + '.json');
  if (!fs.existsSync(file)) {
    console.warn('  ! no article file for category "' + cat.id + '" — skipping');
    continue;
  }
  for (const a of readJSON(file)) {
    if (a.reviewed !== true) { skipped++; continue; }
    topics.push({
      id: a.id,
      category: a.category,
      title: a.title,
      emoji: a.emoji || cat.emoji,
      hook: a.hook,
      image: a.image || null,
      readingLevel: a.readingLevel || 3,
      // searchable haystack, lowercased once here so the app never has to
      keywords: (a.title + ' ' + a.hook + ' ' + (a.wow || '')).toLowerCase()
    });
  }
}

const index = {
  version: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  categories,
  topics
};

fs.writeFileSync(path.join(CONTENT, 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log('index.json rebuilt — ' + topics.length + ' topics across ' +
  categories.length + ' categories' + (skipped ? ' (' + skipped + ' unreviewed skipped)' : ''));
