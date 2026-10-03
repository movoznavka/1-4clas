/* =========================================================
   LessonKit — маленькі інтерактивні "конструктори" вправ,
   спільні для всіх 36 уроків. Підключай на кожній сторінці
   уроку після style.css і викликай потрібні функції з даними
   конкретного уроку.
   ========================================================= */
(function (global) {
  const LessonKit = {};

  // ---- прогрес / зірочки -----------------------------------
  LessonKit.progress = { earned: 0, total: 0 };

  LessonKit.setTotalStars = function (n) {
    LessonKit.progress.total = n;
    LessonKit.renderProgress();
  };

  LessonKit.renderProgress = function () {
    const fill = document.querySelector('.progress-fill');
    const starsEl = document.querySelector('.progress-bar .stars');
    const { earned, total } = LessonKit.progress;
    if (fill) fill.style.width = total ? Math.round((earned / total) * 100) + '%' : '0%';
    if (starsEl) starsEl.textContent = '★'.repeat(earned) + '☆'.repeat(Math.max(total - earned, 0));
  };

  LessonKit.addStar = function (x, y) {
    LessonKit.progress.earned += 1;
    LessonKit.renderProgress();
    if (x !== undefined) LessonKit.burst(x, y);
  };

  LessonKit.burst = function (x, y) {
    const el = document.createElement('div');
    el.className = 'burst';
    el.textContent = '⭐';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  };

  // ---- закладки-навігація по секціях -------------------------
  LessonKit.initTabs = function () {
    const tabs = document.querySelectorAll('.tab');
    const sections = Array.from(tabs).map(t => document.querySelector(t.dataset.target));
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelector(tab.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tabs.forEach(t => t.classList.remove('active'));
          const idx = sections.indexOf(entry.target);
          if (idx > -1) tabs[idx].classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    sections.forEach(s => s && obs.observe(s));
  };

  // ---- флеш-картки словника -----------------------------------
  // items: [{img?, icon?, word, translation, example}]
  LessonKit.initFlashcards = function (containerSel, items) {
    const root = document.querySelector(containerSel);
    if (!root) return;
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'flip-card';
      const media = item.svg
        ? `<div class="icon-wrap svg-wrap">${item.svg}</div>`
        : item.img
        ? `<img src="${item.img}" alt="${item.word}" loading="lazy"
             onerror="this.outerHTML='<div class=&quot;icon-wrap&quot;>${item.icon || '🖼️'}</div>'">`
        : `<div class="icon-wrap">${item.icon || '🖼️'}</div>`;
      card.innerHTML = `
        <div class="flip-inner">
          <div class="flip-face flip-front">
            ${media}
            <div class="word">${item.word}</div>
          </div>
          <div class="flip-face flip-back">
            <div class="tr">${item.translation}</div>
            <div class="ex">${item.example}</div>
          </div>
        </div>`;
      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
        if (!card.dataset.seen) {
          card.dataset.seen = '1';
          card.classList.add('learned');
        }
      });
      root.appendChild(card);
    });
  };

  // ---- конструктор речення (клікни слова по порядку) ----------
  // container: DOM node з дітьми .order-pool та .order-answer (порожні)
  // words: масив слів у ПРАВИЛЬНОМУ порядку (перемішаємо самі)
  LessonKit.initOrderBuilder = function (container, correctWords, onSolved) {
    const pool = container.querySelector('.order-pool');
    const answer = container.querySelector('.order-answer');
    const feedback = container.querySelector('.feedback');
    const shuffled = [...correctWords].sort(() => Math.random() - 0.5);
    const chosen = [];

    function renderPool() {
      pool.innerHTML = '';
      shuffled.forEach((w, i) => {
        const btn = document.createElement('button');
        btn.className = 'order-word';
        btn.textContent = w;
        btn.disabled = chosen.includes(i);
        btn.addEventListener('click', () => {
          chosen.push(i);
          renderPool();
          renderAnswer();
        });
        pool.appendChild(btn);
      });
    }

    function renderAnswer() {
      answer.innerHTML = '';
      chosen.forEach(i => {
        const span = document.createElement('button');
        span.className = 'order-word';
        span.textContent = shuffled[i];
        span.title = 'Прибрати слово';
        span.addEventListener('click', () => {
          chosen.splice(chosen.indexOf(i), 1);
          renderPool();
          renderAnswer();
        });
        answer.appendChild(span);
      });
      if (chosen.length === correctWords.length) {
        const built = chosen.map(i => shuffled[i]).join(' ');
        const target = correctWords.join(' ');
        if (built.toLowerCase() === target.toLowerCase()) {
          feedback.textContent = '✓ Так! Речення побудовано правильно.';
          feedback.className = 'feedback ok';
          const rect = answer.getBoundingClientRect();
          LessonKit.addStar(rect.left + rect.width / 2, rect.top);
          onSolved && onSolved(true);
        } else {
          feedback.textContent = '✗ Порядок слів ще не той. Спробуй ще раз — прибери слово і постав інакше.';
          feedback.className = 'feedback no';
          onSolved && onSolved(false);
        }
      } else {
        feedback.textContent = '';
      }
    }
    renderPool();
    renderAnswer();
  };

  // ---- вправа з варіантами відповіді ----------------------------
  // container: DOM-вузол .exercise з .choices та .feedback усередині
  // options: [{text, correct:boolean}]
  LessonKit.initChoice = function (container, options, okMsg, noMsg) {
    const choicesEl = container.querySelector('.choices');
    const feedback = container.querySelector('.feedback');
    let answered = false;
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', (e) => {
        if (answered) return;
        answered = true;
        Array.from(choicesEl.children).forEach(b => b.disabled = true);
        if (opt.correct) {
          btn.classList.add('correct');
          feedback.textContent = okMsg || '✓ Правильно!';
          feedback.className = 'feedback ok';
          LessonKit.addStar(e.clientX, e.clientY);
        } else {
          btn.classList.add('wrong');
          feedback.textContent = noMsg || '✗ Не зовсім. Спробуй наступного разу уважніше.';
          feedback.className = 'feedback no';
          const correctBtn = Array.from(choicesEl.children).find((b, i) => options[i].correct);
          if (correctBtn) correctBtn.classList.add('correct');
        }
      });
      choicesEl.appendChild(btn);
    });
  };

  // ---- чек-лист домашнього завдання ------------------------------
  LessonKit.initChecklist = function (containerSel) {
    document.querySelectorAll(containerSel + ' input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('li').classList.toggle('done', cb.checked);
      });
    });
  };

  // ---- клікабельні слова в міні-тексті ---------------------------
  LessonKit.initStoryHighlight = function (containerSel) {
    document.querySelectorAll(containerSel + ' .clickable-word').forEach(w => {
      w.addEventListener('click', () => w.classList.toggle('marked'));
    });
  };

  global.LessonKit = LessonKit;
})(window);
