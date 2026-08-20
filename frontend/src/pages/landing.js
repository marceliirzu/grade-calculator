import { escapeHtml } from '../core/formatters.js';
import { AuthService } from '../services/auth.js';
import { ClassService, SemesterService } from '../services/dataServices.js';
import { ClassCard } from '../components/cards.js';
import { GpaDisplay } from '../components/gpaDisplay.js';
import { Modal } from '../components/modal.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';

/**
 * Two pages in one module, matching the original structure:
 *  - signed out: the marketing page
 *  - signed in / guest: the class grid for the current semester
 */
export const LandingPage = {
  classes: [],
  currentSemesterId: null,
  currentSemester: null,

  async init(params = {}) {
    this.currentSemesterId = params.semesterId ?? SemesterService.getCurrentSemesterId();

    if (!AuthService.isAuthenticated()) {
      this.renderMarketing();
      return;
    }

    this.renderSkeleton();

    await Promise.all([this.loadClasses(), this.loadCurrentSemester()]);

    this.render();
    this.bindEvents();
  },

  /** Shown while the first fetch is in flight so the page never flashes empty. */
  renderSkeleton() {
    document.getElementById('mainContent').innerHTML = `
      <div class="landing-page">
        <section class="classes-section">
          <div class="classes-header"><h2 class="classes-title">My Classes</h2></div>
          <div class="classes-grid">
            ${[1, 2, 3].map(() => '<div class="card skeleton-card"></div>').join('')}
          </div>
        </section>
        <aside class="gpa-sidebar"><div class="gpa-card skeleton-card" style="height:220px;"></div></aside>
      </div>
    `;
  },

  // =====================================================================
  // Signed-out marketing page
  // =====================================================================

  renderMarketing() {
    document.querySelector('.header')?.classList.add('hidden');

    const check = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const arrow = '<svg class="lp-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Sign-in controls are hidden entirely when Clerk is not configured, rather than rendered
    // as buttons that throw when clicked.
    const signInButton = CONFIG.AUTH_ENABLED
      ? '<button class="lp-btn lp-btn-line" id="signInBtn">Sign in</button>'
      : '';

    const heroSignIn = CONFIG.AUTH_ENABLED
      ? '<button class="lp-btn lp-btn-big lp-btn-line" id="signInBtnHero">Create a free account</button>'
      : '';

    document.getElementById('mainContent').innerHTML = `
      <div class="lp" id="lp">
        <div class="lp-orbits" aria-hidden="true">
          <div class="lp-sticker lp-st-1"><b>4.33</b><span>scale</span></div>
          <div class="lp-sticker lp-st-2">${this.icon('star')}</div>
          <div class="lp-sticker lp-st-3">A+</div>
          <div class="lp-ring-orbit lp-st-4"></div>
        </div>

        <section class="lp-band lp-hero-band">
          <nav class="lp-nav">
            <div class="lp-logo">
              <div class="lp-logo-mark">GPA</div>
              <span class="lp-logo-name"><b>Calc</b>Your<b>GPA</b></span>
            </div>
            <div class="lp-nav-cta">
              ${signInButton}
              <button class="lp-btn lp-btn-dark" id="guestBtn1">Open the app ${arrow}</button>
            </div>
          </nav>

          <div class="lp-hero">
            <div class="lp-badge"><span class="lp-badge-dot"></span> Built for students who sweat the decimals <span class="lp-pill">v2.0</span></div>
            <h1 class="lp-title">Know your grade <em class="lp-mk">before</em> the curve.</h1>
            <p class="lp-sub">Paste a syllabus and CalcYourGPA reads the grading breakdown for you, then tracks every class, every category, and your live GPA in real time.</p>
            <div class="lp-actions">
              <button class="lp-btn lp-btn-big lp-btn-indigo" id="guestBtn2">Try it now — free ${arrow}</button>
              ${heroSignIn}
            </div>
            <div class="lp-note"><span class="lp-note-ck">${check}</span> No account needed · Your data stays in your browser</div>
          </div>
          ${this.zigzag('var(--lp-cream)', 'lp-zig-down')}
        </section>

        <section class="lp-band lp-space-band">
          <div class="lp-stars" aria-hidden="true"></div>
          <div class="lp-band-inner">
            <div class="lp-kicker lp-kicker-light">${this.icon('bolt')} Live · tap to play</div>
            <h2 class="lp-band-title lp-title-light">A calculator that <em>actually</em> calculates.</h2>
            <div class="lp-window">
              <div class="lp-winbar">
                <span class="lp-dots"><i></i><i></i><i></i></span>
                <span class="lp-url">calcyourgpa.com/fall-2025</span>
                <span class="lp-live"><i></i> live</span>
              </div>
              ${this.renderCalc()}
            </div>
            <div class="lp-chip-row">
              <div class="lp-chip"><span class="lp-chip-ic lp-chip-green">${this.icon('spark')}</span> Syllabus parsed · 4 categories</div>
              <div class="lp-chip"><span class="lp-chip-ic lp-chip-amber">${this.icon('target')}</span> On track for Dean's List</div>
            </div>
          </div>
          ${this.zigzag('var(--lp-indigo)', 'lp-zig-down')}
        </section>

        <section class="lp-band lp-feat-band">
          <div class="lp-band-inner">
            <div class="lp-feat-head">
              <span class="lp-kicker">${this.icon('star')} Everything in one place</span>
              <h2 class="lp-band-title">Grades are messy. Your <em>GPA</em> shouldn't be.</h2>
            </div>
            <div class="lp-feat-grid">
              ${this.featureCard('doc', 'indigo', 'Paste your syllabus', 'The parser pulls out every category and weight automatically. No data entry, no spreadsheet.', ['Detects categories &amp; weights', 'Reads the letter-grade scale'])}
              ${this.featureCard('bolt', 'amber', 'Simulate any grade', 'Drop a hypothetical score onto any assignment and watch your class grade and GPA move instantly.', ['Live recalculation', '"What do I need?" targets'])}
              ${this.featureCard('chart', 'green', 'Every term, one number', 'Roll each class into a semester GPA and watch your cumulative GPA build across your whole degree.', ['Semester &amp; cumulative GPA', 'A+ / 4.33 scale toggle'])}
            </div>
          </div>
          ${this.zigzag('var(--lp-paper)', 'lp-zig-down')}
        </section>

        <section class="lp-band lp-steps-band">
          <div class="lp-band-inner">
            <div class="lp-feat-head">
              <span class="lp-kicker">${this.icon('star')} Three steps</span>
              <h2 class="lp-band-title">From syllabus to certainty.</h2>
            </div>
            <div class="lp-steps">
              ${this.step('01', 'Add your classes', 'Paste a syllabus or set up categories by hand. About a minute per class.')}
              ${this.step('02', 'Log your grades', 'Enter scores as you get them, or import straight from Canvas and Blackboard.')}
              ${this.step('03', 'Watch it add up', 'Your class grades and GPA update live, and what-if mode plans the rest.')}
            </div>
          </div>
          ${this.zigzag('var(--lp-amber)', 'lp-zig-down')}
        </section>

        <section class="lp-band lp-feat-band">
          <div class="lp-band-inner">
            <div class="lp-feat-head">
              <span class="lp-kicker">${this.icon('bolt')} Pricing</span>
              <h2 class="lp-band-title">It's <em>free</em>. All of it.</h2>
            </div>
            <div class="lp-feat-grid" style="max-width:760px;margin:0 auto;">
              ${this.featureCard('star', 'green', 'Free, no card', 'Every feature, every class, every semester. There is no paid tier and nothing to unlock.', ['Unlimited classes &amp; semesters', 'Syllabus parsing included'])}
              ${this.featureCard('chart', 'indigo', 'Your data, your call', 'Use it signed out and everything stays in this browser. Sign in only if you want it synced across devices.', ['Guest mode needs no account', 'Sign in for cloud sync'])}
            </div>
          </div>
          ${this.zigzag('var(--lp-paper)', 'lp-zig-down')}
        </section>

        <section class="lp-band lp-cta-band">
          <div class="lp-cta-inner">
            <h2 class="lp-cta-title">Stop guessing.<br><em>Start knowing.</em></h2>
            <p class="lp-cta-sub">Try it instantly, no account needed. Set up your first class in under a minute.</p>
            <button class="lp-btn lp-btn-big lp-btn-cream" id="guestBtn3">Open CalcYourGPA ${arrow}</button>
          </div>
          ${this.zigzag('var(--lp-emerald)', 'lp-zig-down')}
        </section>

        <footer class="lp-footer">
          <div class="lp-logo">
            <div class="lp-logo-mark">GPA</div>
            <span class="lp-logo-name lp-logo-name-light"><b>Calc</b>Your<b>GPA</b></span>
          </div>
          <span class="lp-foot-note">© ${new Date().getFullYear()} CalcYourGPA · Free · Your data stays private</span>
        </footer>
      </div>
    `;

    this.bindMarketing();
    this.bindCalc();

    requestAnimationFrame(() => document.getElementById('lp')?.classList.add('is-ready'));
    this.initReveal();
  },

  initReveal() {
    const elements = document.querySelectorAll('.lp .reveal');
    if (elements.length === 0) return;

    // Reveal everything immediately when scroll-triggered animation is unavailable or
    // unwanted: a reduced-motion preference, or an environment with no IntersectionObserver.
    // Without the second check the content would stay permanently invisible, which is a far
    // worse failure than simply skipping the animation.
    const canObserve = typeof IntersectionObserver !== 'undefined';
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!canObserve || prefersReducedMotion) {
      elements.forEach((element) => element.classList.add('in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );

    elements.forEach((element) => observer.observe(element));
  },

  bindMarketing() {
    const signIn = () => {
      try {
        AuthService.openSignIn();
      } catch (error) {
        Modal.toast(error.message ?? 'Sign-in is unavailable right now.');
      }
    };

    const enterGuest = () => {
      AuthService.enterGuestMode();
      document.querySelector('.header')?.classList.remove('hidden');
      navigate('semesterList');
    };

    ['signInBtn', 'signInBtnHero'].forEach((id) =>
      document.getElementById(id)?.addEventListener('click', signIn));

    ['guestBtn1', 'guestBtn2', 'guestBtn3'].forEach((id) =>
      document.getElementById(id)?.addEventListener('click', enterGuest));
  },

  // ---- decorative helpers (unchanged visuals) ----

  zigzag(fill, className) {
    const width = 1200;
    const teeth = 18;
    const step = width / teeth;
    const depth = 26;
    const top = 12;

    let path = `M0,0 L${width},0 L${width},${top} `;

    for (let i = teeth - 1; i >= 0; i -= 1) {
      const peak = (i * step + step / 2).toFixed(1);
      const left = (i * step).toFixed(1);
      path += `L${peak},${top + depth} L${left},${top} `;
    }

    path += 'Z';

    return `<div class="lp-zig ${className ?? ''}"><svg viewBox="0 0 ${width} ${top + depth}" preserveAspectRatio="none" width="100%" height="${top + depth}" aria-hidden="true"><path d="${path}" fill="${fill}"/></svg></div>`;
  },

  icon(name) {
    const icons = {
      spark: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><path d="M8 1.5l1.6 4.3 4.4 1.6-4.4 1.6L8 13.5 6.4 9 2 7.4l4.4-1.6L8 1.5z" fill="currentColor"/></svg>',
      target: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="3.4" stroke="currentColor" stroke-width="2"/></svg>',
      bolt: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" fill="currentColor"/></svg>',
      doc: '<svg viewBox="0 0 20 20" width="22" height="22" fill="none" aria-hidden="true"><path d="M5 2.5h6L15.5 7v10.5h-11v-15z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 2.5V7h4.5M7 11h6M7 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      chart: '<svg viewBox="0 0 18 18" width="22" height="22" fill="none" aria-hidden="true"><path d="M3 15V3M3 15h12M6 12V9m3 3V6m3 6V8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
      star: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><path d="M8 1l1.8 4.6L14.5 6 10.9 9l1.4 4.8L8 11l-4.3 2.8L5.1 9 1.5 6l4.7-.4L8 1z" fill="currentColor"/></svg>',
    };

    return icons[name] ?? '';
  },

  featureCard(icon, color, title, body, list) {
    return `
      <div class="lp-feat-card lp-feat-${color} reveal">
        <div class="lp-feat-ic">${this.icon(icon)}</div>
        <h3>${title}</h3>
        <p>${body}</p>
        <ul class="lp-feat-list">
          ${list.map((item) => `<li><span class="lp-feat-ck">${this.icon('star')}</span>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  },

  step(number, title, description) {
    return `<div class="lp-step reveal"><div class="lp-step-num">${number}</div><div><h4>${title}</h4><p>${description}</p></div></div>`;
  },

  // ---- interactive hero calculator ----

  calcGrades: [
    { l: 'A', p: 4.0 }, { l: 'A-', p: 3.67 }, { l: 'B+', p: 3.33 }, { l: 'B', p: 3.0 },
    { l: 'B-', p: 2.67 }, { l: 'C+', p: 2.33 }, { l: 'C', p: 2.0 }, { l: 'D', p: 1.0 }, { l: 'F', p: 0 },
  ],

  calcRows: [
    { name: 'Organic Chem II', gi: 1, credits: 4 },
    { name: 'Linear Algebra', gi: 0, credits: 3 },
    { name: 'Cognitive Psych', gi: 4, credits: 3 },
    { name: 'Philosophy', gi: 1, credits: 3 },
  ],

  gradeColor(points) {
    if (points >= 3.67) return 'var(--color-grade-a)';
    if (points >= 2.67) return 'var(--color-grade-b)';
    if (points >= 1.67) return 'var(--color-grade-c)';
    if (points >= 1) return 'var(--color-grade-d)';
    return 'var(--color-grade-f)';
  },

  renderCalc() {
    const rows = this.calcRows.map((row, index) => {
      const grade = this.calcGrades[row.gi];
      const color = this.gradeColor(grade.p);

      return `
        <div class="lp-row" data-i="${index}">
          <span class="lp-rdot" style="background:${color}"></span>
          <span class="lp-rname">${escapeHtml(row.name)}</span>
          <button class="lp-pill-grade" data-act="grade" data-i="${index}" style="color:${color}" title="Tap to change grade">${grade.l}</button>
          <div class="lp-cr">
            <button data-act="minus" data-i="${index}" aria-label="fewer credits">–</button>
            <span>${row.credits}<i>cr</i></span>
            <button data-act="plus" data-i="${index}" aria-label="more credits">+</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="lp-calc">
        <div class="lp-calc-rows">
          ${rows}
          <div class="lp-calc-hint">${this.icon('bolt')} Tap a letter grade, or step the credits</div>
        </div>
        <div class="lp-gauge">
          <div class="lp-gauge-wrap">
            <svg viewBox="0 0 120 120" class="lp-ring" aria-hidden="true">
              <circle cx="60" cy="60" r="52" class="lp-ring-track"/>
              <circle cx="60" cy="60" r="52" class="lp-ring-fill"/>
            </svg>
            <div class="lp-gauge-center">
              <div class="lp-gauge-num">0.00</div>
              <div class="lp-gauge-scale">/ 4.0 GPA</div>
            </div>
          </div>
          <div class="lp-gauge-meta">
            <div><span class="lp-mcr">0</span> credits</div>
            <div><span class="lp-mcl">0</span> classes</div>
          </div>
        </div>
      </div>
    `;
  },

  computeCalc() {
    const totalCredits = this.calcRows.reduce((sum, row) => sum + row.credits, 0);

    const gpa = totalCredits === 0
      ? 0
      : this.calcRows.reduce((sum, row) => sum + this.calcGrades[row.gi].p * row.credits, 0) / totalCredits;

    return { gpa, totalCredits, classes: this.calcRows.length };
  },

  updateCalc(animate) {
    const { gpa, totalCredits, classes } = this.computeCalc();

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const fraction = Math.max(0, Math.min(1, gpa / 4));

    const fill = document.querySelector('.lp-ring-fill');
    if (fill) {
      fill.style.strokeDasharray = circumference;
      fill.style.strokeDashoffset = circumference * (1 - fraction);
    }

    const credits = document.querySelector('.lp-mcr');
    if (credits) credits.textContent = totalCredits;

    const classCount = document.querySelector('.lp-mcl');
    if (classCount) classCount.textContent = classes;

    const number = document.querySelector('.lp-gauge-num');
    if (!number) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!animate || reduceMotion) {
      number.textContent = gpa.toFixed(2);
      return;
    }

    const from = Number.parseFloat(number.textContent) || 0;
    const start = performance.now();
    const duration = 600;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;

      number.textContent = (from + (gpa - from) * eased).toFixed(2);

      if (t < 1) requestAnimationFrame(tick);
      else number.textContent = gpa.toFixed(2);
    };

    requestAnimationFrame(tick);
  },

  bindCalc() {
    const calc = document.querySelector('.lp-calc');
    if (!calc) return;

    calc.addEventListener('click', (event) => {
      const button = event.target.closest('[data-act]');
      if (!button) return;

      const index = Number.parseInt(button.dataset.i, 10);
      const row = this.calcRows[index];
      if (!row) return;

      const action = button.dataset.act;

      if (action === 'grade') row.gi = (row.gi + 1) % this.calcGrades.length;
      else if (action === 'minus') row.credits = Math.max(1, row.credits - 1);
      else if (action === 'plus') row.credits = Math.min(6, row.credits + 1);

      const grade = this.calcGrades[row.gi];
      const color = this.gradeColor(grade.p);
      const rowElement = calc.querySelector(`.lp-row[data-i="${index}"]`);

      if (rowElement) {
        const pill = rowElement.querySelector('.lp-pill-grade');
        pill.textContent = grade.l;
        pill.style.color = color;

        pill.animate?.(
          [{ transform: 'scale(0.8)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
          { duration: 320, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
        );

        rowElement.querySelector('.lp-rdot').style.background = color;
        rowElement.querySelector('.lp-cr span').firstChild.textContent = row.credits;
      }

      this.updateCalc(true);
    });

    this.updateCalc(true);
  },

  // =====================================================================
  // Signed-in class grid
  // =====================================================================

  async loadClasses() {
    try {
      this.classes = (await ClassService.getAll(this.currentSemesterId)) ?? [];
    } catch (error) {
      console.error('Failed to load classes:', error);
      this.classes = [];
      Modal.toast(error.message ?? 'Could not load your classes.');
    }
  },

  async loadCurrentSemester() {
    if (!this.currentSemesterId) {
      this.currentSemester = null;
      return;
    }

    try {
      this.currentSemester = await SemesterService.getById(this.currentSemesterId);
    } catch {
      // A stale semester id (deleted on another device) must not block the page.
      this.currentSemester = null;
      SemesterService.setCurrentSemesterId(null);
    }
  },

  render() {
    document.querySelector('.header')?.classList.remove('hidden');

    const title = this.currentSemester
      ? `${escapeHtml(this.currentSemester.name)} Classes`
      : 'My Classes';

    document.getElementById('mainContent').innerHTML = `
      <div class="landing-page">
        <section class="classes-section">
          <div class="classes-header">
            <div>
              ${this.currentSemesterId ? '<a href="#" id="backToSemesters" class="breadcrumb-link">← Semesters</a>' : ''}
              <h2 class="classes-title">${title}</h2>
            </div>
          </div>
          <div class="classes-grid" id="classesGrid">${this.renderClasses()}</div>
        </section>

        <aside class="gpa-sidebar">${GpaDisplay.render(this.classes, this.currentSemester)}</aside>
      </div>
    `;
  },

  renderClasses() {
    if (this.classes.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="6" y="10" width="16" height="28" rx="2" stroke="currentColor" stroke-width="2"/>
              <rect x="26" y="10" width="16" height="28" rx="2" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <h3 class="empty-state-title">No classes yet</h3>
          <p class="empty-state-text">${this.currentSemesterId ? 'No classes in this semester yet. Add your first class.' : 'Add your first class to start tracking grades.'}</p>
          <button class="btn btn-primary btn-lg" id="emptyAddBtn">Add Class</button>
        </div>
      `;
    }

    return this.classes.map((cls) => ClassCard.render(cls)).join('') + ClassCard.renderAddButton();
  },

  bindEvents() {
    document.getElementById('addClassBtn')?.addEventListener('click', () => this.startAddClass());
    document.getElementById('emptyAddBtn')?.addEventListener('click', () => this.startAddClass());

    document.getElementById('backToSemesters')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('semesterList');
    });

    document.querySelectorAll('.class-card').forEach((card) => {
      const open = () => navigate('class', { classId: Number(card.dataset.classId) });

      card.addEventListener('click', open);
      // The card is a div with role="button", so it needs keyboard activation wired manually.
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  },

  async startAddClass() {
    const syllabusData = await Modal.showSyllabusPaste({ canUseServer: AuthService.isSignedIn() });
    navigate('classSetup', { syllabusData, semesterId: this.currentSemesterId });
  },
};
