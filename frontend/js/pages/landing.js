// Landing Page
const LandingPage = {
    classes: [],
    currentSemesterId: null,
    currentSemester: null,

    async init(params = {}) {
        const semesterId = params.semesterId || SemesterService.getCurrentSemesterId();
        this.currentSemesterId = semesterId;

        if (!AuthService.isLoggedIn()) {
            this.renderLoginPrompt();
            return;
        }

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
    //  Logged-out marketing page — CHUNKY, full-bleed colored bands
    // ============================================================
    renderLoginPrompt() {
        document.querySelector('.header')?.classList.add('hidden');
        const mainContent = document.getElementById('mainContent');

        const ck = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const arrow = `<svg class="lp-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        mainContent.innerHTML = `
        <div class="lp" id="lp">
            <!-- drifting space stickers -->
            <div class="lp-orbits" aria-hidden="true">
                <div class="lp-sticker lp-st-1"><b>4.33</b><span>scale</span></div>
                <div class="lp-sticker lp-st-2">${this._icon('star')}</div>
                <div class="lp-sticker lp-st-3">A+</div>
                <div class="lp-ring-orbit lp-st-4"></div>
            </div>

            <!-- ====== BAND 1 — HERO (cream) ====== -->
            <section class="lp-band lp-hero-band">
                <nav class="lp-nav">
                    <div class="lp-logo">
                        <div class="lp-logo-mark">GPA</div>
                        <span class="lp-logo-name"><b>Calc</b>Your<b>GPA</b></span>
                    </div>
                    <div class="lp-nav-cta">
                        <button class="lp-btn lp-btn-line" id="signInBtn">Sign in</button>
                        <button class="lp-btn lp-btn-dark" id="guestBtn1">Open the app ${arrow}</button>
                    </div>
                </nav>

                <div class="lp-hero">
                    <div class="lp-badge"><span class="lp-badge-dot"></span> Built for students who sweat the decimals <span class="lp-pill">v2.0</span></div>
                    <h1 class="lp-title">Know your grade <em class="lp-mk">before</em> the curve.</h1>
                    <p class="lp-sub">Paste a syllabus and CalcYourGPA reads the grading breakdown for you, then tracks every class, every category, and your live GPA in real time.</p>
                    <div class="lp-actions">
                        <button class="lp-btn lp-btn-big lp-btn-indigo" id="guestBtn2">Try it now — free ${arrow}</button>
                        <button class="lp-btn lp-btn-big lp-btn-line" id="signInBtn4">Sign in with Google</button>
                    </div>
                    <div class="lp-note"><span class="lp-note-ck">${ck}</span> No account needed · Your data stays in your browser</div>
                    <div id="googleSignInButton" style="margin-top:14px;display:flex;justify-content:center;"></div>
                </div>
                ${this._zig('var(--lp-cream)', 'lp-zig-down')}
            </section>

            <!-- ====== BAND 2 — SPACE / CALCULATOR (deep indigo) ====== -->
            <section class="lp-band lp-space-band">
                <div class="lp-stars" aria-hidden="true"></div>
                <div class="lp-band-inner">
                    <div class="lp-kicker lp-kicker-light">${this._icon('bolt')} Live · tap to play</div>
                    <h2 class="lp-band-title lp-title-light">A calculator that <em>actually</em> calculates.</h2>
                    <div class="lp-window">
                        <div class="lp-winbar">
                            <span class="lp-dots"><i></i><i></i><i></i></span>
                            <span class="lp-url">calcyourgpa.app/fall-2025</span>
                            <span class="lp-live"><i></i> live</span>
                        </div>
                        ${this.renderCalc()}
                    </div>
                    <div class="lp-chip-row">
                        <div class="lp-chip"><span class="lp-chip-ic lp-chip-green">${this._icon('spark')}</span> Syllabus parsed · 4 categories</div>
                        <div class="lp-chip"><span class="lp-chip-ic lp-chip-amber">${this._icon('target')}</span> On track for Dean's List</div>
                    </div>
                </div>
                ${this._zig('var(--lp-indigo)', 'lp-zig-down')}
            </section>

            <!-- ====== BAND 3 — FEATURES (paper) ====== -->
            <section class="lp-band lp-feat-band">
                <div class="lp-band-inner">
                    <div class="lp-feat-head">
                        <span class="lp-kicker">${this._icon('star')} Everything in one place</span>
                        <h2 class="lp-band-title">Grades are messy. Your <em>GPA</em> shouldn't be.</h2>
                    </div>
                    <div class="lp-feat-grid">
                        ${this._featureCard('doc', 'indigo', 'Paste your syllabus', 'Our parser pulls out every category and weight automatically. No data entry, no spreadsheet.', ['Detects categories &amp; weights', 'Reads the letter-grade scale'])}
                        ${this._featureCard('bolt', 'amber', 'Simulate any grade', 'Slide a hypothetical score onto any assignment and watch your class grade and GPA move instantly.', ['Live recalculation', '"What do I need?" targets'])}
                        ${this._featureCard('chart', 'green', 'Every term, one number', 'Roll each class into a semester GPA and watch your cumulative GPA build over your whole degree.', ['Semester &amp; cumulative GPA', 'A+ / 4.33 scale toggle'])}
                    </div>
                </div>
                ${this._zig('var(--lp-paper)', 'lp-zig-down')}
            </section>

            <!-- ====== BAND 4 — STEPS (amber) ====== -->
            <section class="lp-band lp-steps-band">
                <div class="lp-band-inner">
                    <div class="lp-feat-head">
                        <span class="lp-kicker">${this._icon('star')} Three steps</span>
                        <h2 class="lp-band-title">From syllabus to certainty.</h2>
                    </div>
                    <div class="lp-steps">
                        ${this._step('01', 'Add your classes', 'Paste a syllabus or set up categories by hand. About a minute per class.')}
                        ${this._step('02', 'Log your grades', 'Enter scores as you get them, or import straight from Canvas and Blackboard.')}
                        ${this._step('03', 'Watch it add up', 'Your class grades and GPA update live, and what-if mode plans the rest.')}
                    </div>
                </div>
                ${this._zig('var(--lp-amber)', 'lp-zig-down')}
            </section>

            <!-- ====== BAND 4.5 — PRICING (paper) ====== -->
            <section class="lp-band lp-feat-band">
                <div class="lp-band-inner">
                    <div class="lp-feat-head">
                        <span class="lp-kicker">${this._icon('bolt')} Simple pricing</span>
                        <h2 class="lp-band-title">Try it free. <em>Keep it cheap.</em></h2>
                    </div>
                    <div class="lp-feat-grid" style="max-width:760px;margin:0 auto;">
                        ${this._priceCard('indigo', 'Monthly', '$4.99', '/month', [
                            'Unlimited classes &amp; semesters',
                            'AI syllabus parsing',
                            'Grade advisor + what-if planning'
                        ])}
                        ${this._priceCard('green', 'Yearly', '$29.99', '/year', [
                            'Everything in monthly',
                            'Two months free',
                            'One payment per school year'
                        ])}
                    </div>
                    <p style="text-align:center;margin-top:22px;font-weight:600;opacity:0.75;">Use it free in your browser today — accounts with cloud sync, AI syllabus parsing and the grade advisor launch soon with a 7-day free trial.</p>
                </div>
                ${this._zig('var(--lp-paper)', 'lp-zig-down')}
            </section>

            <!-- ====== BAND 5 — CTA (emerald) ====== -->
            <section class="lp-band lp-cta-band">
                <div class="lp-cta-inner">
                    <h2 class="lp-cta-title">Stop guessing.<br><em>Start knowing.</em></h2>
                    <p class="lp-cta-sub">Try it instantly, no account needed. Set up your first class in under a minute.</p>
                    <button class="lp-btn lp-btn-big lp-btn-cream" id="guestBtn3">Open CalcYourGPA ${arrow}</button>
                </div>
                ${this._zig('var(--lp-emerald)', 'lp-zig-down')}
            </section>

            <!-- ====== FOOTER (ink) ====== -->
            <footer class="lp-footer">
                <div class="lp-logo">
                    <div class="lp-logo-mark">GPA</div>
                    <span class="lp-logo-name lp-logo-name-light"><b>Calc</b>Your<b>GPA</b></span>
                </div>
                <span class="lp-foot-note">© 2026 CalcYourGPA · 7-day free trial · Your data stays private</span>
            </footer>
        </div>`;

        this.bindLoginPrompt();
        this.bindCalc();
        requestAnimationFrame(() => document.getElementById('lp')?.classList.add('is-ready'));
        setTimeout(() => document.getElementById('lp')?.classList.add('is-ready'), 60);
        this._initReveal();
    },

    _initReveal() {
        const els = document.querySelectorAll('.lp .reveal');
        if (!els.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
        }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
        els.forEach((el) => io.observe(el));
    },

    bindLoginPrompt() {
        const googleLogin = async () => {
            try {
                await AuthService.initGoogleSignIn();
                // Render the official button as a reliable fallback, then try One Tap.
                AuthService.renderGoogleButton('googleSignInButton');
                AuthService.signInWithGoogle();
                document.getElementById('googleSignInButton')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
                console.error(e);
                Modal._showToast('Google sign-in failed to load. Please try again.');
            }
        };

        // Guest mode: fully functional, no account / billing / database needed.
        const guestLogin = () => {
            AuthService.enterGuestMode();
            App.subscription = { hasAccess: true, status: 'guest', billingConfigured: false };
            document.querySelector('.header')?.classList.remove('hidden');
            App.updateAuthUI();
            App.navigate('semesterList');
        };

        ['signInBtn', 'signInBtn4'].forEach(id =>
            document.getElementById(id)?.addEventListener('click', googleLogin));
        ['guestBtn1', 'guestBtn2', 'guestBtn3'].forEach(id =>
            document.getElementById(id)?.addEventListener('click', guestLogin));

        // Local development only: bypass Google with a dev account.
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
            const nav = document.querySelector('.lp-nav-cta');
            if (nav) {
                const devBtn = document.createElement('button');
                devBtn.className = 'lp-btn lp-btn-line';
                devBtn.textContent = 'Dev login';
                devBtn.addEventListener('click', async () => {
                    try {
                        await AuthService.devLogin();
                        App.subscription = await SubscriptionService.getStatus(true);
                        document.querySelector('.header')?.classList.remove('hidden');
                        App.updateAuthUI();
                        App.navigate(App.subscription.hasAccess ? 'semesterList' : 'paywall');
                    } catch (e) {
                        console.error(e);
                        Modal._showToast('Dev login failed. Is the backend running?');
                    }
                });
                nav.prepend(devBtn);
            }
        }
    },

    _priceCard(color, name, price, per, items) {
        return `
        <div class="lp-feat-card lp-feat-${color} reveal">
            <div class="lp-feat-ic">${this._icon(color === 'green' ? 'chart' : 'bolt')}</div>
            <h3>${name} — <span style="font-family:var(--font-family-mono)">${price}</span><small style="font-weight:500;opacity:.7">${per}</small></h3>
            <ul class="lp-feat-list">
                ${items.map(li => `<li><span class="lp-feat-ck">${this._icon('star')}</span>${li}</li>`).join('')}
            </ul>
        </div>`;
    },

    // chunky zigzag rough-edge divider
    _zig(fill, cls) {
        const W = 1200, teeth = 18, step = W / teeth, depth = 26, top = 12;
        let d = `M0,0 L${W},0 L${W},${top} `;
        for (let i = teeth - 1; i >= 0; i--) {
            const peak = (i * step + step / 2).toFixed(1);
            const left = (i * step).toFixed(1);
            d += `L${peak},${top + depth} L${left},${top} `;
        }
        d += 'Z';
        return `<div class="lp-zig ${cls || ''}"><svg viewBox="0 0 ${W} ${top + depth}" preserveAspectRatio="none" width="100%" height="${top + depth}"><path d="${d}" fill="${fill}"/></svg></div>`;
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
        const mcr = document.querySelector('.lp-mcr'); if (mcr) mcr.textContent = totalCr;
        const mcl = document.querySelector('.lp-mcl'); if (mcl) mcl.textContent = classes;

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
        setTimeout(() => { numEl.textContent = gpa.toFixed(2); }, dur + 120);
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

            const g = this._calcGrades[row.gi];
            const col = this._gradeColor(g.p);
            const rowEl = calc.querySelector(`.lp-row[data-i="${i}"]`);
            if (rowEl) {
                const pill = rowEl.querySelector('.lp-pill-grade');
                pill.textContent = g.l; pill.style.color = col;
                pill.animate([{ transform: 'scale(0.8)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
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
            target: `<svg viewBox="0 0 18 18" width="15" height="15" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="3.4" stroke="currentColor" stroke-width="2"/></svg>`,
            bolt: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none"><path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" fill="currentColor"/></svg>`,
            doc: `<svg viewBox="0 0 20 20" width="22" height="22" fill="none"><path d="M5 2.5h6L15.5 7v10.5h-11v-15z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 2.5V7h4.5M7 11h6M7 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            chart: `<svg viewBox="0 0 18 18" width="22" height="22" fill="none"><path d="M3 15V3M3 15h12M6 12V9m3 3V6m3 6V8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
            star: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M8 1l1.8 4.6L14.5 6 10.9 9l1.4 4.8L8 11l-4.3 2.8L5.1 9 1.5 6l4.7-.4L8 1z" fill="currentColor"/></svg>`,
        };
        return I[name] || '';
    },

    _featureCard(icon, color, title, body, list) {
        return `
        <div class="lp-feat-card lp-feat-${color} reveal">
            <div class="lp-feat-ic">${this._icon(icon)}</div>
            <h3>${title}</h3>
            <p>${body}</p>
            <ul class="lp-feat-list">
                ${list.map(li => `<li><span class="lp-feat-ck">${this._icon('star')}</span>${li}</li>`).join('')}
            </ul>
        </div>`;
    },

    _step(n, t, d) {
        return `<div class="lp-step reveal"><div class="lp-step-num">${n}</div><div><h4>${t}</h4><p>${d}</p></div></div>`;
    },

    async loadClasses() {
        try {
            const endpoint = this.currentSemesterId
                ? `/classes?semesterId=${this.currentSemesterId}`
                : '/classes';
            const response = await Api.get(endpoint);
            // ApiResponse envelope: { success, message, data }
            const list = Array.isArray(response) ? response : response.data;
            this.classes = Array.isArray(list) ? list : [];
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
