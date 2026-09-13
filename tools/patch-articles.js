#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — patch-articles.js
   Updates named fields on existing articles, found by id.

   Rewriting a whole category file to lengthen one article means moving
   hundreds of untouched lines, which is slow and easy to get wrong. A patch is
   a plain array of objects: an id plus only the fields to replace.

       [{ "id": "how-soap-works", "story": ["...", "...", "..."] }]

   Usage:  node tools/patch-articles.js content/_patches/deepen-01.json
           node tools/patch-articles.js            (applies every file in _patches)
   Applied patches move to content/_patches/_applied/.
   =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const PATCHES = path.join(CONTENT, '_patches');
const APPLIED = path.join(PATCHES, '_applied');

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

const arg = process.argv[2];
let files;
if (arg) {
  files = [path.resolve(arg)];
} else {
  if (!fs.existsSync(PATCHES)) { console.log('No content/_patches/ directory.'); process.exit(0); }
  files = fs.readdirSync(PATCHES).filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => path.join(PATCHES, f));
}
if (!files.length) { console.log('Nothing to patch.'); process.exit(0); }

const categories = readJSON(path.join(CONTENT, 'categories.json')).map(c => c.id);

// id -> {category, index}
const where = {};
const live = {};
for (const cat of categories) {
  const p = path.join(CONTENT, cat + '.json');
  if (!fs.existsSync(p)) continue;
  live[cat] = readJSON(p);
  live[cat].forEach((a, i) => { where[a.id] = { cat, i }; });
}

let patched = 0;
const missing = [];

for (const file of files) {
  for (const change of readJSON(file)) {
    const target = where[change.id];
    if (!target) { missing.push(change.id); continue; }
    const article = live[target.cat][target.i];
    for (const [key, value] of Object.entries(change)) {
      if (key === 'id') continue;
      article[key] = value;
    }
    patched++;
  }
}

for (const cat of Object.keys(live)) writeJSON(path.join(CONTENT, cat + '.json'), live[cat]);

missing.forEach(id => console.log('  ! no article with id "' + id + '"'));
console.log(patched + ' article(s) patched.');

if (!arg) {
  fs.mkdirSync(APPLIED, { recursive: true });
  files.forEach(f => fs.renameSync(f, path.join(APPLIED, path.basename(f))));
}

execFileSync(process.execPath, [path.join(__dirname, 'build-index.js')], { stdio: 'inherit' });
