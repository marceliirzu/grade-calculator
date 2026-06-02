// Landing Page
const LandingPage = {
    classes: [],
    currentSemesterId: null,
    currentSemester: null,
    _calc: null,

    async init(params = {}) {
        const semesterId = params.semesterId || SemesterService.getCurrentSemesterId();
        this.currentSemesterId = semesterId;

        if (!AuthService.isLoggedIn()) {
            this.renderLoginPrompt();
            return;
        }

        // Show loading skeleton
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
    <div class="landing-page">
        <section class="classes-section">
            <div class="classes-header">
                <h2 class="classes-title">My Classes</h2>
            </div>
            <div class="classes-grid">
                ${[1,2,3].map(() => `
                    <div class="card" style="min-height:168px;animation:shimmer 1.5s infinite;background-image:linear-gradient(90deg,var(--color-bg-secondary) 0%,var(--color-bg-tertiary) 50%,var(--color-bg-secondary) 100%);background-size:200% 100%;border:none;"></div>
                `).join('')}
            </div>
        </section>
        <aside class="gpa-sidebar">
            <div class="gpa-card" style="height:220px;"></div>
        </aside>
    </div>
`;

        await Promise.all([this.loadClasses(), this.loadCurrentSemester()]);
        this.render();
        this.bindEvents();
    },

    // ============================================================
    //  Logged-out marketing page — flashy hero + live calculator
    // ============================================================
    renderLoginPrompt() {
        document.querySelector('.header')?.classList.add('hidden');
        const mainContent = document.getElementById('mainContent');

        const ck = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const arrow = `<svg class="lp-arrow" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        mainContent.innerHTML = `
        <div class="lp" id="lp">
            <div class="lp-aurora"><span></span><span></span><span></span></div>

            <nav class="lp-nav">
                <div class="logo-container">
                    <div class="logo-mark"><span class="logo-mark-text">GPA</span></div>
                    <span class="logo-text"><b>Calc</b>Your<b>GPA</b></span>
                </div>
                <div class="lp-nav-cta">
                    <button class="btn btn-secondary" id="comingSoonBtn">Sign in</button>
                    <button class="btn btn-primary" id="devLoginBtn">Open app ${arrow}</button>
                </div>
            </nav>

            <header class="lp-hero">
                <div class="lp-badge">Built for students who sweat the decimals <span class="lp-pill">v2.0</span></div>
                <h1 class="lp-title">Know your grade <em class="lp-mk">before</em> the curve.</h1>
                <p class="lp-sub">Paste a syllabus and CalcYourGPA reads the grading breakdown for you, then tracks every class, every category, and your live GPA in real time.</p>
                <div class="lp-actions">
                    <button class="btn btn-primary btn-xl" id="devLoginBtn2">Start tracking free ${arrow}</button>
                    <button class="btn btn-secondary btn-xl" id="comingSoonBtn2">Sign in with Google</button>
                </div>
                <div class="lp-note"><span class="lp-ck">${ck}</span> No credit card · Your grades stay on your device</div>
            </header>

            <div class="lp-stage">
                <div class="lp-window">
                    <div class="lp-winbar">
                        <span class="lp-dots"><i></i><i></i><i></i></span>
                        <span class="lp-url">calcyourgpa.app/fall-2025</span>
                        <span class="lp-live"><i></i> live</span>
                    </div>
                    ${this.renderCalc()}
                </div>
                <div class="lp-float lp-float-1"><span class="lp-fic lp-fic-green">${this._icon('spark')}</span><span><small>Syllabus parsed</small><b>4 categories found</b></span></div>
                <div class="lp-float lp-float-2"><span class="lp-fic lp-fic-indigo">${this._icon('target')}</span><span><small>On track for</small><b style="color:var(--color-accent-dark)">Dean's List</b></span></div>
                <div class="lp-float lp-float-3"><span class="lp-fic lp-fic-amber">${this._icon('bolt')}</span><span><small>Tap a grade</small><b>it recalculates</b></span></div>
            </div>

            <section class="lp-features">
                <div class="lp-feat-head">
                    <span class="eyebrow">Everything in one place</span>
                    <h2>Grades are messy. Your <em>GPA</em> shouldn't be.</h2>
                    <p>From the first quiz to the final curve, CalcYourGPA does the weighting, the rounding, and the math you'd rather not do at 2am.</p>
                </div>
                <div class="lp-feat-grid">
                    ${this._featureCard('doc', 'Paste your syllabus', 'Our parser pulls out every category and weight automatically. No manual data entry, no spreadsheet.', ['Detects categories &amp; weights', 'Reads the letter-grade scale', 'Editable before you confirm'])}
                    ${this._featureCard('bolt', 'Simulate any grade', 'Slide a hypothetical score onto any assignment and watch your class grade and GPA move instantly.', ['Live recalculation', '"What do I need?" targets'])}
                    ${this._featureCard('chart', 'Every semester, one number', 'Track each class, roll it into a semester GPA, and watch your cumulative GPA build over your whole degree.', ['Semester &amp; cumulative GPA', 'Goal tracking with progress', 'A+ / 4.33 scale toggle'])}
                </div>
            </section>

            <section class="lp-steps-wrap">
                <div class="lp-feat-head">
                    <span class="eyebrow">Three steps</span>
                    <h2>From syllabus to certainty.</h2>
                </div>
                <div class="lp-steps">
                    ${this._step('01', 'Add your classes', 'Paste a syllabus or set up categories by hand. About a minute per class.')}
                    ${this._step('02', 'Log your grades', 'Enter scores as you get them, or import straight from Canvas and Blackboard.')}
                    ${this._step('03', 'Watch it add up', 'Your class grades and GPA update live, and what-if mode plans the rest.')}
                </div>
            </section>

            <section class="lp-cta">
                <div class="lp-cta-card">
                    <h2>Stop guessing. <em>Start knowing.</em></h2>
                    <p>Free forever for students. Set up your first class in under a minute.</p>
                    <button class="btn btn-xl lp-btn-white" id="devLoginBtn3">Open CalcYourGPA ${arrow}</button>
                </div>
            </section>

            <footer class="lp-footer">
                <div class="logo-container">
                    <div class="logo-mark"><span class="logo-mark-text">GPA</span></div>
                    <span class="logo-text"><b>Calc</b>Your<b>GPA</b></span>
                </div>
                <span class="lp-foot-note">© 2026 CalcYourGPA · Free to use · Your data stays private</span>
            </footer>
        </div>`;

        this.bindLoginPrompt();
        this.bindCalc();
        requestAnimationFrame(() => document.getElementById('lp')?.classList.add('is-ready'));
        setTimeout(() => document.getElementById('lp')?.classList.add('is-ready'), 60);
    },

    bindLoginPrompt() {
        const devLogin = async () => {
            try {
                await AuthService.devLogin();
                document.querySelector('.header')?.classList.remove('hidden');
                App.updateAuthUI();
                App.navigate('semesterList');
            } catch (e) {
                console.error(e);
                Modal._showToast('Login failed. Is the backend running?');
            }
        };
        const googleLogin = async () => {
            try {
                await AuthService.initGoogleSignIn();
                AuthService.signInWithGoogle();
            } catch (e) {
                console.error(e);
                Modal._showToast('Google sign-in failed to load. Please try again.');
            }
        };
        ['devLoginBtn', 'devLoginBtn2', 'devLoginBtn3'].forEach(id =>
            document.getElementById(id)?.addEventListener('click', devLogin));
        ['comingSoonBtn', 'comingSoonBtn2'].forEach(id =>
            document.getElementById(id)?.addEventListener('click', googleLogin));
    },

    // ---- interactive hero calculator ----
    _calcGrades: [
        { l: 'A', p: 4.0 }, { l: 'A-', p: 3.67 }, { l: 'B+', p: 3.33 }, { l: 'B', p: 3.0 },
        { l: 'B-', p: 2.67 }, { l: 'C+', p: 2.33 }, { l: 'C', p: 2.0 }, { l: 'D', p: 1.0 }, { l: 'F', p: 0 },
    ],
    _calcRows: [
        { name: 'Organic Chem II', gi: 1, credits: 4 },
        { name: 'Linear Algebra', gi: 0, credits: 3 },
        { name: 'Cognitive Psych', gi: 4, credits: 3 },
        { name: 'Philosophy', gi: 1, credits: 3 },
    ],

    _gradeColor(p) {
        if (p >= 3.67) return 'var(--color-grade-a)';
        if (p >= 2.67) return 'var(--color-grade-b)';
        if (p >= 1.67) return 'var(--color-grade-c)';
        if (p >= 1) return 'var(--color-grade-d)';
        return 'var(--color-grade-f)';
    },

    renderCalc() {
        const rows = this._calcRows.map((r, i) => {
            const g = this._calcGrades[r.gi];
            const col = this._gradeColor(g.p);
            return `
            <div class="lp-row" data-i="${i}">
                <span class="lp-rdot" style="background:${col}"></span>
                <span class="lp-rname">${r.name}</span>
                <button class="lp-pill-grade" data-act="grade" data-i="${i}" style="color:${col}" title="Tap to change grade">${g.l}</button>
                <div class="lp-cr">
                    <button data-act="minus" data-i="${i}" aria-label="fewer credits">–</button>
                    <span>${r.credits}<i>cr</i></span>
                    <button data-act="plus" data-i="${i}" aria-label="more credits">+</button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="lp-calc">
            <div class="lp-calc-rows">
                ${rows}
                <div class="lp-calc-hint">${this._icon('bolt')} Tap a letter grade, or step the credits</div>
            </div>
            <div class="lp-gauge">
                <div class="lp-gauge-wrap">
                    <svg viewBox="0 0 120 120" class="lp-ring">
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
        </div>`;
    },

    _computeCalc() {
        const totalCr = this._calcRows.reduce((a, r) => a + r.credits, 0);
        const gpa = totalCr ? this._calcRows.reduce((a, r) => a + this._calcGrades[r.gi].p * r.credits, 0) / totalCr : 0;
        return { gpa, totalCr, classes: this._calcRows.length };
    },

    _updateCalc(animateNum) {
        const { gpa, totalCr, classes } = this._computeCalc();
        const R = 52, C = 2 * Math.PI * R;
        const frac = Math.max(0, Math.min(1, gpa / 4));
        const fill = document.querySelector('.lp-ring-fill');
        if (fill) {
            fill.style.strokeDasharray = C;
            fill.style.strokeDashoffset = C * (1 - frac);
        }
        document.querySelector('.lp-mcr').textContent = totalCr;
        document.querySelector('.lp-mcl').textContent = classes;

        const numEl = document.querySelector('.lp-gauge-num');
        if (!numEl) return;
        if (!animateNum) { numEl.textContent = gpa.toFixed(2); return; }
        const from = parseFloat(numEl.textContent) || 0;
        const start = performance.now(), dur = 600;
        const tick = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const e = 1 - Math.pow(1 - t, 3);
            numEl.textContent = (from + (gpa - from) * e).toFixed(2);
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    },

    bindCalc() {
        const calc = document.querySelector('.lp-calc');
        if (!calc) return;
        calc.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const i = parseInt(btn.dataset.i);
            const row = this._calcRows[i];
            const act = btn.dataset.act;
            if (act === 'grade') row.gi = (row.gi + 1) % this._calcGrades.length;
            else if (act === 'minus') row.credits = Math.max(1, row.credits - 1);
            else if (act === 'plus') row.credits = Math.min(6, row.credits + 1);

            // update just this row's pill + dot
            const g = this._calcGrades[row.gi];
            const col = this._gradeColor(g.p);
            const rowEl = calc.querySelector(`.lp-row[data-i="${i}"]`);
            if (rowEl) {
                const pill = rowEl.querySelector('.lp-pill-grade');
                pill.textContent = g.l; pill.style.color = col;
                pill.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
                rowEl.querySelector('.lp-rdot').style.background = col;
                rowEl.querySelector('.lp-cr span').firstChild.textContent = row.credits;
            }
            this._updateCalc(true);
        });
        this._updateCalc(true);
    },

    _icon(name) {
        const I = {
            spark: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none"><path d="M8 1.5l1.6 4.3 4.4 1.6-4.4 1.6L8 13.5 6.4 9 2 7.4l4.4-1.6L8 1.5z" fill="currentColor"/></svg>`,
            target: `<svg viewBox="0 0 18 18" width="16" height="16" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="3.5" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="0.6" fill="currentColor"/></svg>`,
            bolt: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none"><path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" fill="currentColor"/></svg>`,
            doc: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M5 2.5h6L15.5 7v10.5h-11v-15z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 2.5V7h4.5M7 11h6M7 14h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
            chart: `<svg viewBox="0 0 18 18" width="18" height="18" fill="none"><path d="M3 15V3M3 15h12M6 12V9m3 3V6m3 6V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
        };
        return I[name] || '';
    },

    _featureCard(icon, title, body, list) {
        return `
        <div class="lp-feat-card">
            <div class="lp-feat-ic">${this._icon(icon)}</div>
            <h3>${title}</h3>
            <p>${body}</p>
            <ul class="lp-feat-list">
                ${list.map(li => `<li><span class="lp-feat-ck">${this._icon('spark')}</span>${li}</li>`).join('')}
            </ul>
        </div>`;
    },

    _step(n, t, d) {
        return `<div class="lp-step"><div class="lp-step-num">${n}</div><h4>${t}</h4><p>${d}</p></div>`;
    },

    async loadClasses() {
        try {
            const endpoint = this.currentSemesterId
                ? `classes?semesterId=${this.currentSemesterId}`
                : 'classes';
            this.classes = await Api.get(endpoint);
        } catch (error) {
            console.error('Failed to load classes:', error);
            this.classes = [];
        }
    },

    async loadCurrentSemester() {
        if (!this.currentSemesterId) { this.currentSemester = null; return; }
        try {
            this.currentSemester = await SemesterService.getById(this.currentSemesterId);
        } catch (e) {
            this.currentSemester = null;
        }
    },

    render() {
        document.querySelector('.header')?.classList.remove('hidden');
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="landing-page">
                <section class="classes-section">
                    <div class="classes-header">
                        <div>
                            ${this.currentSemesterId ? `<a href="#" id="backToSemesters" class="breadcrumb-link">← Semesters</a>` : ''}
                            <h2 class="classes-title">${this.currentSemester ? _escHtml(this.currentSemester.name) + ' Classes' : 'My Classes'}</h2>
                        </div>
                    </div>
                    <div class="classes-grid" id="classesGrid">
                        ${this.renderClasses()}
                    </div>
                </section>

                <aside class="gpa-sidebar">
                    ${GpaDisplay.render(this.classes, this.currentSemester)}
                </aside>
            </div>
        `;
    },

    renderClasses() {
        if (this.classes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="16" height="28" rx="2" stroke="currentColor" stroke-width="2"/><rect x="26" y="10" width="16" height="28" rx="2" stroke="currentColor" stroke-width="2"/></svg></div>
                    <h3 class="empty-state-title">No classes yet</h3>
                    <p class="empty-state-text">${this.currentSemesterId ? 'No classes in this semester yet. Add your first class.' : 'Add your first class to start tracking grades.'}</p>
                    <button class="btn btn-primary btn-lg" id="emptyAddBtn">Add Class</button>
                </div>
            `;
        }

        const cards = this.classes.map(c => ClassCard.render(c)).join('');
        return cards + ClassCard.renderAddButton();
    },

    bindEvents() {
        const addBtn = document.getElementById('addClassBtn');
        const emptyAddBtn = document.getElementById('emptyAddBtn');

        if (addBtn) addBtn.addEventListener('click', () => this.startAddClass());
        if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.startAddClass());

        document.getElementById('backToSemesters')?.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate('semesterList');
        });

        document.querySelectorAll('.class-card').forEach(card => {
            card.addEventListener('click', () => {
                const classId = card.dataset.classId;
                App.navigate('class', { classId: parseInt(classId) });
            });
        });
    },

    async startAddClass() {
        const syllabusData = await Modal.showSyllabusPaste();
        App.navigate('classSetup', { syllabusData, semesterId: this.currentSemesterId });
    }
};
