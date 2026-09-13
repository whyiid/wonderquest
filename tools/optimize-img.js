#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — optimize-img.js
   Turns raw generated illustrations into web-sized WebP files.

   Drop the raw images into tools/_raw/<category>/<article-id>.png (or .jpg),
   run this, and each one lands at img/<category>/<article-id>.webp at 1200px
   wide. Then set "image": "img/<category>/<article-id>.webp" on the article.

   Uses cwebp if installed (best), otherwise falls back to macOS sips, which
   can also write WebP on recent macOS. If neither can produce WebP the script
   says so plainly rather than silently copying a 4 MB PNG into the repo —
   image weight is the one thing that will make this app feel slow.

   Usage:  node tools/optimize-img.js
   =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(__dirname, '_raw');
const OUT = path.join(ROOT, 'img');
const WIDTH = 1200;
const QUALITY = 80;

const has = (cmd) => spawnSync('which', [cmd], { stdio: 'pipe' }).status === 0;
const HAS_CWEBP = has('cwebp');
const HAS_SIPS = has('sips');

if (!HAS_CWEBP && !HAS_SIPS) {
  console.error('Neither cwebp nor sips is available. Install cwebp:  brew install webp');
  process.exit(1);
}

if (!fs.existsSync(RAW)) {
  console.log('Nothing to do — create tools/_raw/<category>/ and put raw images there.');
  process.exit(0);
}

let done = 0, failed = 0;

for (const cat of fs.readdirSync(RAW)) {
  const dir = path.join(RAW, cat);
  if (!fs.statSync(dir).isDirectory()) continue;

  const outDir = path.join(OUT, cat);
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of fs.readdirSync(dir)) {
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const src = path.join(dir, file);
    const dest = path.join(outDir, path.basename(file).replace(/\.[^.]+$/, '') + '.webp');

    try {
      if (HAS_CWEBP) {
        execFileSync('cwebp', ['-quiet', '-resize', String(WIDTH), '0', '-q', String(QUALITY), src, '-o', dest]);
      } else {
        execFileSync('sips', ['-Z', String(WIDTH), '-s', 'format', 'webp', src, '--out', dest], { stdio: 'pipe' });
      }
      const kb = Math.round(fs.statSync(dest).size / 1024);
      console.log('  ✓ ' + cat + '/' + path.basename(dest) + '  ' + kb + ' KB' +
        (kb > 250 ? '   ← heavy, consider a simpler illustration' : ''));
      done++;
    } catch (e) {
      console.error('  ✗ ' + file + ' — ' + e.message.split('\n')[0]);
      failed++;
    }
  }
}

console.log('\n' + done + ' image(s) written to img/' + (failed ? ', ' + failed + ' failed' : ''));
if (done) console.log('Remember to set "image" on each article, then run: node tools/validate-content.js');
