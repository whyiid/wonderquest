/* ===========================================================================
   WonderQuest — article.js
   The three-beat article (hook → story → wow) plus its two questions.

   Design rules enforced here:
   · A wrong answer never punishes. It shows the right sentence and moves on.
   · The article is marked read — and the streak advances — only after the
     questions are done, so "read" means read, not tapped.
   =========================================================================== */
'use strict';

window.WQArticle = (function () {

  const esc = (s) => WQUI.esc(s);
  let current = null;   // { article, answers: [] }

  /* `story` is an array of paragraphs. At ~300 words a single block is a wall
     of text for an eight-year-old, so each paragraph gets its own <p>. A plain
     string is still accepted, for older articles. */
  function storyHTML(story) {
    const parts = Array.isArray(story) ? story : [story];
    return parts.map(p => '<p class="art-story">' + esc(p) + '</p>').join('');
  }

  /* The history-and-people block and the open-questions block. Both optional,
     both given their own heading so the page reads as parts rather than one
     long slab. */
  function section(icon, heading, body) {
    if (!body) return '';
    return '<section class="art-extra">' +
      '<h2 class="extra-head"><span aria-hidden="true">' + icon + '</span>' + esc(heading) + '</h2>' +
      storyHTML(body) +
    '</section>';
  }

  async function render(host, id) {
    host.innerHTML = '<div class="loading">Opening…</div>';

    let a;
    try { a = await WQData.article(id); }
    catch (e) { host.innerHTML = WQUI.empty('📡', 'Could not open that', e.message); return; }
    if (!a) { host.innerHTML = WQUI.empty('🔍', 'Not found', 'That topic is not in the library.'); return; }

    current = { article: a, answers: [] };
    const c = WQUI.catOf(a);
    const art = a.image
      ? '<img class="hero-img" src="' + esc(a.image) + '" alt="" />'
      : '<span class="hero-emoji">' + esc(a.emoji) + '</span>';

    host.innerHTML = '' +
      '<article class="article">' +
        '<button class="back" data-go="#/today">‹ Back</button>' +
        '<div class="hero" style="--c1:' + esc(c.c1) + ';--c2:' + esc(c.c2) + '">' + art + '</div>' +
        '<p class="art-cat">' + esc(c.emoji) + ' ' + esc(c.name) + '</p>' +
        '<h1 class="art-title">' + esc(a.title) + '</h1>' +
        '<p class="art-hook">' + esc(a.hook) + '</p>' +
        storyHTML(a.story) +
        '<p class="art-wow"><span class="wow-tag">WOW</span>' + esc(a.wow) + '</p>' +
        section('🔍', 'How We Found Out', a.discovery) +
        section('❓', 'Still a Mystery', a.unknown) +
        '<div class="quiz" id="quiz"></div>' +
      '</article>';

    renderQuiz(WQUI.$('#quiz', host));
  }

  function renderQuiz(box) {
    const a = current.article;
    const i = current.answers.length;

    if (i >= a.quiz.length) return finish(box);

    const q = a.quiz[i];
    box.innerHTML = '' +
      '<p class="quiz-step">Question ' + (i + 1) + ' of ' + a.quiz.length + '</p>' +
      '<p class="quiz-q">' + esc(q.q) + '</p>' +
      '<div class="quiz-answers">' +
        q.a.map((ans, n) => '<button class="answer" data-answer="' + n + '">' + esc(ans) + '</button>').join('') +
      '</div>';

    WQUI.$$('.answer', box).forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = Number(btn.dataset.answer);
        const right = chosen === q.correct;

        WQUI.$$('.answer', box).forEach(b => {
          b.disabled = true;
          if (Number(b.dataset.answer) === q.correct) b.classList.add('is-right');
          else if (b === btn) b.classList.add('is-wrong');
        });

        const note = document.createElement('p');
        note.className = 'quiz-note ' + (right ? 'good' : 'soft');
        note.textContent = right ? 'Yes! ' + q.a[q.correct] : 'Close — the answer is: ' + q.a[q.correct];
        box.appendChild(note);

        current.answers.push(right);
        setTimeout(() => renderQuiz(box), right ? 700 : 1500);
      });
    });
  }

  function finish(box) {
    const a = current.article;
    const score = current.answers.filter(Boolean).length;
    const total = a.quiz.length;
    const first = WQProgress.markRead(a.id, score, total);
    WQApp.refreshStats();

    const streak = WQProgress.liveStreak();
    box.innerHTML = '' +
      '<div class="done">' +
        '<p class="done-emoji">' + (score === total ? '🎉' : '👍') + '</p>' +
        '<h3>' + (score === total ? 'Perfect!' : 'Nice work!') + '</h3>' +
        '<p class="done-line">' + score + ' of ' + total + ' right' +
          (first ? ' · +' + (10 + score * 5) + ' wonder points' : ' · already collected') + '</p>' +
        (streak > 1 ? '<p class="done-streak">🔥 ' + streak + '-day streak</p>' : '') +
        '<div class="done-actions">' +
          '<button class="btn btn-primary" data-go="#/today">Back to Today</button>' +
          '<button class="btn" data-go="#/explore">Explore more</button>' +
        '</div>' +
      '</div>';
  }

  return { render };
})();
