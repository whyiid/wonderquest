#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — merge-batch.js
   Appends a batch of new articles into the live per-category files.

   Writing straight into content/<category>.json means rewriting a file of
   hundreds of articles every time a handful are added. Instead, batches are
   dropped into content/_incoming/ as plain arrays and merged here, with
   duplicate ids refused rather than silently overwritten.

   Usage:  node tools/merge-batch.js                 (merges every file in _incoming)
           node tools/merge-batch.js batch-05.json   (merges just one)
   =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const INCOMING = path.join(CONTENT, '_incoming');
const DONE = path.join(INCOMING, '_merged');

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

if (!fs.existsSync(INCOMING)) {
  console.log('Nothing to merge — content/_incoming/ does not exist.');
  process.exit(0);
}

const only = process.argv[2];
const files = fs.readdirSync(INCOMING)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .filter(f => !only || f === only);

if (!files.length) { console.log('Nothing to merge.'); process.exit(0); }

const categories = readJSON(path.join(CONTENT, 'categories.json')).map(c => c.id);
const existing = new Set();
for (const cat of categories) {
  const p = path.join(CONTENT, cat + '.json');
  if (fs.existsSync(p)) readJSON(p).forEach(a => existing.add(a.id));
}

let added = 0;
const problems = [];

for (const file of files) {
  const batch = readJSON(path.join(INCOMING, file));
  const byCategory = {};

  for (const a of batch) {
    if (!categories.includes(a.category)) { problems.push(file + ': unknown category "' + a.category + '" on ' + a.id); continue; }
    if (existing.has(a.id)) { problems.push(file + ': id "' + a.id + '" already live — skipped'); continue; }
    existing.add(a.id);
    (byCategory[a.category] = byCategory[a.category] || []).push(a);
  }

  for (const [cat, articles] of Object.entries(byCategory)) {
    const p = path.join(CONTENT, cat + '.json');
    const live = fs.existsSync(p) ? readJSON(p) : [];
    writeJSON(p, live.concat(articles));
    console.log('  + ' + articles.length + ' → ' + cat + '.json');
    added += articles.length;
  }

  fs.mkdirSync(DONE, { recursive: true });
  fs.renameSync(path.join(INCOMING, file), path.join(DONE, file));
}

problems.forEach(p => console.log('  ! ' + p));
execFileSync(process.execPath, [path.join(__dirname, 'build-index.js')], { stdio: 'inherit' });
console.log(added + ' article(s) merged.');
