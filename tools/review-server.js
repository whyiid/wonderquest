#!/usr/bin/env node
/* ===========================================================================
   WonderQuest — review-server.js
   Serves the app AND the review page, and is the only thing allowed to
   promote a staged article into the live library.

   A plain static page cannot write files, and a review gate that ends in
   "now go and edit the JSON by hand" is a gate that gets skipped. So this is
   a tiny local server: Approve writes the article into content/<category>.json,
   sets reviewed: true, and rebuilds index.json in one click.

   Usage:  node tools/review-server.js        → http://localhost:7797/tools/review.html
   Local only. Never deploy this.
   =========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const STAGING = path.join(CONTENT, '_staging');
const PORT = Number(process.env.PORT || 7797);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',   '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg'
};

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');

function staged() {
  if (!fs.existsSync(STAGING)) return [];
  return fs.readdirSync(STAGING)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .flatMap(f => readJSON(path.join(STAGING, f)).map(a => Object.assign({ _file: f }, a)));
}

function removeFromStaging(file, id) {
  const p = path.join(STAGING, file);
  writeJSON(p, readJSON(p).filter(a => a.id !== id));
}

function approve(article) {
  const file = path.join(CONTENT, article.category + '.json');
  const live = fs.existsSync(file) ? readJSON(file) : [];
  if (live.some(a => a.id === article.id)) throw new Error('An article with id "' + article.id + '" is already live.');

  const clean = Object.assign({}, article);
  delete clean._file;
  clean.reviewed = true;

  live.push(clean);
  writeJSON(file, live);
  removeFromStaging(article._file, article.id);
  execFileSync(process.execPath, [path.join(__dirname, 'build-index.js')], { stdio: 'pipe' });
}

function reject(article, reason) {
  const bin = path.join(STAGING, '_rejected.json');
  const list = fs.existsSync(bin) ? readJSON(bin) : [];
  list.push(Object.assign({ rejectedAt: new Date().toISOString(), reason: reason || '' }, article));
  writeJSON(bin, list);
  removeFromStaging(article._file, article.id);
}

function body(req) {
  return new Promise((resolve, reject_) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject_(e); } });
  });
}

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/staging') return send(res, 200, { articles: staged() });

  if (url.pathname === '/api/decide' && req.method === 'POST') {
    try {
      const b = await body(req);
      if (!b.article || !b.article.id || !b.article._file) return send(res, 400, { error: 'Missing article' });
      if (b.action === 'approve') approve(b.article);
      else if (b.action === 'reject') reject(b.article, b.reason);
      else return send(res, 400, { error: 'Unknown action' });
      return send(res, 200, { ok: true, remaining: staged().length });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // static files, confined to the project directory
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }

  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log('WonderQuest review → http://localhost:' + PORT + '/tools/review.html');
  console.log('App preview        → http://localhost:' + PORT + '/index.html');
  console.log(staged().length + ' article(s) waiting for review.');
});
