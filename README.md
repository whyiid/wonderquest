# WonderQuest 🔭

A daily-discovery encyclopedia for Matthew. Three short topics a day, a light
quiz, a streak, and a collection to fill. English, ages ~7–10.

Fourth app in the personal PWA series after MandoQuest, JadeDragonQuest and
HanaTalk: vanilla JS, no framework, no build step, works offline, hosted on
GitHub Pages.

Design spec: `../docs/superpowers/specs/2026-09-13-wonderquest-design.md`

---

## Run it locally

```bash
python3 -m http.server 7796 --directory .
```

Then open http://localhost:7796 . It must be served over http — opening
`index.html` from disk fails, because the content loads with `fetch`.

## Adding articles

1. Pick titles from `content/topics-queue.md`.
2. Write the drafts into `content/_staging/<category>.json` with
   `"reviewed": false`. One article is `{ id, category, title, emoji, hook,
   story, wow, image, quiz, readingLevel, factRisk, reviewed }`.
3. Generate the illustrations, drop the raw files into
   `tools/_raw/<category>/<article-id>.png`, then:
   ```bash
   node tools/optimize-img.js
   ```
   and set `"image": "img/<category>/<article-id>.webp"` on the article.
4. Review and approve:
   ```bash
   node tools/review-server.js
   ```
   → http://localhost:7797/tools/review.html — edit the text in place if needed,
   then Approve. That writes the article into `content/<category>.json`, sets
   `reviewed: true`, and rebuilds `index.json`.
5. Check and commit:
   ```bash
   node tools/validate-content.js
   ```

**Nothing with `reviewed: false` ever reaches Matthew.** That flag is the whole
safety gate for AI-written text and AI illustrations — the app, the index
builder and the review server all honour it.

Topics marked `"factRisk": true` (anatomy, planets, maps, size comparisons) get
a warning banner in the review page. Check those illustrations properly; an
image that is merely pretty but wrong is worse than no image in an app whose
whole point is learning true things.

## Hard rules

- **≤600 words per article**, currently 358–431, average 394. The validator
  enforces the ceiling and warns below 350.
- An article has five parts:
  - `hook` — one surprising sentence
  - `story` — an array of **three paragraphs**: what the fact is → how it works
    → what follows from it
  - `wow` — one retellable closing fact
  - `discovery` — **How We Found Out**: the history, and the people who did it
  - `unknown` — **Still a Mystery**: what nobody has worked out yet
- Every article ends with at least one question.

`discovery` and `unknown` matter as much as the fact itself: they show that
knowledge was made by people, often slowly and against opposition, and that the
work is not finished. Where possible, name the person and the year.

The limit was 150 words, then 350, now 600 — raised twice on 2026-09-13 after
Wahyu read real articles and judged them too thin.

## Deploying

Push to GitHub and enable Pages on the repo. After any change to the **app
files** (html/css/js), bump `CACHE` in `sw.js` — otherwise returning devices
keep serving the old cached version. Adding **articles** needs no bump: the
service worker fetches `content/` network-first and only falls back to the
cache when offline.

## Files

| File | Purpose |
|---|---|
| `index.html` | shell, script order |
| `data.js` | index + lazy per-category article loading, search |
| `progress.js` | localStorage: read topics, streak, XP, settings, parent config |
| `daily.js` | picks today's three, frozen for the day |
| `ui.js` | shared card/screen rendering |
| `article.js` | article view + quiz |
| `explore.js` | categories, category listing, search |
| `collection.js` | album, level bar, badges |
| `parent.js` | settings and the PIN-gated parent panel |
| `app.js` | router, Today screen, header stats |
| `tools/build-index.js` | rebuilds `content/index.json` |
| `tools/validate-content.js` | the pre-commit content check |
| `tools/review-server.js` + `tools/review.html` | the approval gate |
| `tools/optimize-img.js` | raw illustrations → 1200px WebP |

## Known limits

- The parent PIN keeps a child out. It is stored in plain text on the device
  and is not security — nothing sensitive belongs in that panel.
- Progress is per device. Moving iPad → phone is a manual export/import from
  the parent panel.
- Article accuracy rests on the human review step, not on the generator.
