/* =========================================================
   Platform — облік учнів, вхід без пароля за іменем,
   збереження прогресу й ДЗ у Firestore, дані для вчительської
   панелі.
   ========================================================= */
(function (global) {
  const Platform = {};
  const KEY = 'zoshyt_current_student';

  // Перелік уроків платформи (додавайте сюди новий урок, коли створите файл)
  Platform.LESSONS = [
    { id: 'lesson-01', title: 'Урок 1. Моє повсякденне життя',     file: 'ukr-lesson-01.html' },
    { id: 'lesson-02', title: 'Урок 2. Їжа — борщ і вареники',      file: 'ukr-lesson-02.html' },
    { id: 'lesson-03', title: 'Урок 3. Зовнішність людини',        file: 'ukr-lesson-03.html' },
    { id: 'lesson-04', title: 'Урок 4. Характер людини',           file: 'ukr-lesson-04.html' }
  ];

  Platform.getStudents = function () {
    return (global.PLATFORM_STUDENTS || []).slice();
  };

  Platform.getCurrentStudent = function () {
    return localStorage.getItem(KEY) || null;
  };

  Platform.setCurrentStudent = function (name) {
    localStorage.setItem(KEY, name);
  };

  Platform.logout = function () {
    localStorage.removeItem(KEY);
    location.href = Platform.rootPath() + 'ukr-login.html';
  };

  Platform.rootPath = function () {
    return '';
  };

  // Викликати одразу на початку <body> кожної захищеної сторінки,
  // щоб неавторизованого учня одразу відправити на вхід.
  Platform.guard = function () {
    if (!Platform.getCurrentStudent()) {
      location.href = Platform.rootPath() + 'ukr-login.html?next=' + encodeURIComponent(location.pathname);
      return false;
    }
    return true;
  };

  function studentRef(name) {
    return window.db.collection('students').doc(name);
  }
  function lessonRef(name, lessonId) {
    return studentRef(name).collection('lessons').doc(lessonId);
  }

  Platform.saveProgress = function (lessonId, data) {
    const student = Platform.getCurrentStudent();
    if (!student || !window.db) return;
    lessonRef(student, lessonId).set(Object.assign({
      studentName: student,
      lessonId: lessonId,
      updatedAt: new Date().toISOString()
    }, data), { merge: true }).catch(function (e) {
      console.warn('Не вдалося зберегти прогрес онлайн:', e);
    });
  };

  Platform.getProgress = function (lessonId) {
    const student = Platform.getCurrentStudent();
    if (!student || !window.db) return Promise.resolve(null);
    return lessonRef(student, lessonId).get().then(function (doc) {
      return doc.exists ? doc.data() : null;
    }).catch(function () { return null; });
  };

  // Отримати весь прогрес усіх учнів по всіх уроках (для вчительської панелі)
  Platform.getAllProgress = function () {
    if (!window.db) return Promise.resolve({});
    const students = Platform.getStudents();
    const jobs = [];
    const result = {};
    students.forEach(function (name) {
      result[name] = {};
      Platform.LESSONS.forEach(function (l) {
        jobs.push(
          lessonRef(name, l.id).get().then(function (doc) {
            result[name][l.id] = doc.exists ? doc.data() : null;
          }).catch(function () { result[name][l.id] = null; })
        );
      });
    });
    return Promise.all(jobs).then(function () { return result; });
  };

  // Підключити сторінку уроку до платформи: бейдж учня, збереження
  // зірок і ДЗ, відновлення попереднього прогресу.
  Platform.initLessonPage = function (lessonId, lessonTitle) {
    const student = Platform.getCurrentStudent();
    if (!student) return;
    Report.name = lessonTitle;

    const bar = document.querySelector('.progress-bar');
    if (bar) {
      const badge = document.createElement('span');
      badge.className = 'student-badge';
      badge.innerHTML = '👤 ' + student + ' · <a href="#" id="platform-logout" class="back-link" style="opacity:1">Вийти</a>';
      bar.appendChild(badge);
      const lo = document.getElementById('platform-logout');
      if (lo) lo.addEventListener('click', function (e) { e.preventDefault(); Platform.logout(); });
    }

    if (global.LessonKit) {
      const originalAddStar = LessonKit.addStar;
      LessonKit.addStar = function (x, y) {
        originalAddStar(x, y);
        Platform.saveProgress(lessonId, {
          stars: LessonKit.progress.earned,
          totalStars: LessonKit.progress.total,
          lessonTitle: lessonTitle
        });
      };
    }

    const hwList = document.getElementById('hw-list');
    if (hwList) {
      const boxes = Array.from(hwList.querySelectorAll('input[type=checkbox]'));
      function saveHomework() {
        const done = boxes.filter(function (b) { return b.checked; }).length;
        Platform.saveProgress(lessonId, {
          homeworkDone: done,
          homeworkTotal: boxes.length,
          homeworkComplete: done === boxes.length && boxes.length > 0,
          lessonTitle: lessonTitle
        });
      }
      boxes.forEach(function (cb) { cb.addEventListener('change', saveHomework); });
    }

    // Відновити попередній прогрес (зірки, позначки ДЗ) на цьому пристрої
    Platform.getProgress(lessonId).then(function (data) {
      if (!data) return;
      if (typeof data.stars === 'number' && global.LessonKit) {
        LessonKit.progress.earned = data.stars;
        LessonKit.renderProgress();
      }
    });
  };

  // Підключити окрему сторінку ДЗ (без класної роботи) до платформи
  Platform.initHomeworkPage = function (lessonId, lessonTitle) {
    const student = Platform.getCurrentStudent();
    if (!student) return;
    Report.name = lessonTitle + ' · ДЗ';

    const bar = document.querySelector('.progress-bar');
    if (bar) {
      const badge = document.createElement('span');
      badge.className = 'student-badge';
      badge.innerHTML = '👤 ' + student + ' · <a href="#" id="platform-logout" class="back-link" style="opacity:1">Вийти</a>';
      bar.appendChild(badge);
      const lo = document.getElementById('platform-logout');
      if (lo) lo.addEventListener('click', function (e) { e.preventDefault(); Platform.logout(); });
    }

    // Зірки за вправи ДЗ (вибір відповіді, конструктор речень) —
    // зберігаємо окремо від зірок класної роботи (hwStars / hwTotalStars)
    if (global.LessonKit) {
      const originalAddStar = LessonKit.addStar;
      LessonKit.addStar = function (x, y) {
        originalAddStar(x, y);
        Platform.saveProgress(lessonId, {
          hwStars: LessonKit.progress.earned,
          hwTotalStars: LessonKit.progress.total,
          lessonTitle: lessonTitle
        });
      };
    }

    // Творчі пункти (чекліст) — окремо від зірок
    const hwList = document.getElementById('hw-list');
    if (hwList) {
      const boxes = Array.from(hwList.querySelectorAll('input[type=checkbox]'));
      function saveHomework() {
        const done = boxes.filter(function (b) { return b.checked; }).length;
        Platform.saveProgress(lessonId, {
          homeworkDone: done,
          homeworkTotal: boxes.length,
          homeworkComplete: done === boxes.length && boxes.length > 0,
          lessonTitle: lessonTitle
        });
      }
      boxes.forEach(function (cb) { cb.addEventListener('change', saveHomework); });
    }

    // Відновити зірки ДЗ, якщо учень заходив раніше
    Platform.getProgress(lessonId).then(function (data) {
      if (data && typeof data.hwStars === 'number' && global.LessonKit) {
        LessonKit.progress.earned = data.hwStars;
        LessonKit.renderProgress();
      }
    });
  };


  // ---------------------------------------------------------
  // Результати → Telegram-бот (Apps Script). Адреса — у students.js:
  // window.BOT_WEB_APP_URL. Без неї нічого не надсилається.
  // Рахує перші відповіді в LessonKit.initChoice / initOrderBuilder
  // і шле звіт, коли учень відповів на всі питання (або частковий — коли йде зі сторінки).
  // ---------------------------------------------------------
  const Report = { name: '', items: [], done: [], correct: 0, wrong: [], lastSent: '' };

  function reportNumber(container) {
    const sorted = Report.items.slice().sort(function (a, b) {
      return (a.compareDocumentPosition(b) & 4) ? -1 : 1;
    });
    return sorted.indexOf(container) + 1;
  }

  function reportSend() {
    const url = global.BOT_WEB_APP_URL;
    const answered = Report.done.length;
    const stars = global.LessonKit ? LessonKit.progress.earned : 0;
    const totalStars = global.LessonKit ? LessonKit.progress.total : 0;
    const sig = answered + '/' + stars;
    if (!url || !Report.name || (!answered && !stars) || sig === Report.lastSent) return;
    Report.lastSent = sig;
    const payload = {
      type: 'quiz_result',
      student: Platform.getCurrentStudent() || 'Без імені',
      testName: Report.name,
      correct: Report.correct,
      answered: answered,
      total: Report.items.length,
      stars: stars,
      totalStars: totalStars,
      wrongList: Report.wrong.slice().sort(function (a, b) { return a - b; }).map(String),
      reviewLink: '',
      flaggedList: []
    };
    try {
      fetch(url, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
  }

  function reportRecord(container, ok) {
    if (Report.done.indexOf(container) !== -1) return;
    Report.done.push(container);
    if (ok) Report.correct += 1; else Report.wrong.push(reportNumber(container));
    if (Report.done.length === Report.items.length) reportSend();
  }

  if (global.LessonKit) {
    const origChoice = LessonKit.initChoice;
    LessonKit.initChoice = function (container, options) {
      origChoice.apply(LessonKit, arguments);
      Report.items.push(container);
      container.querySelectorAll('.choice-btn').forEach(function (btn, i) {
        btn.addEventListener('click', function () { reportRecord(container, !!options[i].correct); });
      });
    };
    const origOrder = LessonKit.initOrderBuilder;
    LessonKit.initOrderBuilder = function (container, words, onSolved) {
      Report.items.push(container);
      return origOrder.call(LessonKit, container, words, function (ok) {
        reportRecord(container, !!ok);
        if (onSolved) onSolved(ok);
      });
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') reportSend();
    });
  }

  global.Platform = Platform;
})(window);
