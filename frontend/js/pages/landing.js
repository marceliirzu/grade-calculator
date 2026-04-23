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
                    <div class="card" style="min-height:180px;background:var(--color-bg-card);animation:shimmer 1.5s infinite;background-image:linear-gradient(90deg,var(--color-bg-card) 0%,var(--color-bg-elevated) 50%,var(--color-bg-card) 100%);background-size:200% 100%;"></div>
                `).join('')}
            </div>
        </section>
        <aside class="gpa-sidebar">
            <div class="gpa-card" style="height:200px;animation:shimmer 1.5s infinite;background-image:linear-gradient(90deg,var(--color-bg-card) 0%,var(--color-bg-elevated) 50%,var(--color-bg-card) 100%);background-size:200% 100%;"></div>
        </aside>
    </div>
`;

        await Promise.all([this.loadClasses(), this.loadCurrentSemester()]);
        this.render();
        this.bindEvents();
    },

    renderLoginPrompt() {
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="login-prompt">
                <div class="login-hero">
                    <h1 class="hero-title">The smartest way to track your GPA</h1>
                    <p class="hero-subtitle">AI-powered syllabus parsing, smart grade tracking, and real-time GPA calculations. Built for students who care about their grades.</p>

                    <div class="features-list">
                        <div class="feature-item">
                            <span class="feature-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 7L5.5 10.5L12 3.5" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            <span>AI extracts grading info from your syllabus automatically</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 7L5.5 10.5L12 3.5" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            <span>Track GPA across all your classes in real-time</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 7L5.5 10.5L12 3.5" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            <span>What-if mode to simulate future grades</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 7L5.5 10.5L12 3.5" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            <span>Import grades from Canvas, Blackboard, or CSV</span>
                        </div>
                    </div>

                    <div class="login-cta">
                        <button class="btn btn-primary btn-xl" id="devLoginBtn">
                            Get Started
                        </button>
                        <button class="btn btn-secondary btn-lg" id="comingSoonBtn" style="margin-top: 8px;">
                            Sign in with Google
                        </button>
                        <p class="login-note">Free to use &middot; Your data stays private</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('devLoginBtn')?.addEventListener('click', async () => {
            try {
                await AuthService.devLogin();
                App.updateAuthUI();
                App.navigate('landing');
            } catch (e) {
                console.error(e);
                Modal._showToast('Login failed. Is the backend running?');
            }
        });

        document.getElementById('comingSoonBtn')?.addEventListener('click', async () => {
            try {
                await AuthService.initGoogleSignIn();
                AuthService.signInWithGoogle();
            } catch (e) {
                console.error(e);
                Modal._showToast('Google sign-in failed to load. Please try again.');
            }
        });
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
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="landing-page">
                <section class="classes-section">
                    <div class="classes-header">
                        <div>
                            ${this.currentSemesterId ? `<a href="#" id="backToSemesters" class="breadcrumb-link">← Semesters</a>` : ''}
                            <h2 class="classes-title">${this.currentSemester ? _escHtml(this.currentSemester.name) + ' Classes' : 'My Classes'}</h2>
                        </div>
                        ${this.currentSemesterId ? '' : ''}
                    </div>
                    <div class="classes-grid" id="classesGrid">
                        ${this.renderClasses()}
                    </div>
                </section>

                <aside class="gpa-sidebar">
                    ${GpaDisplay.render(this.classes)}
                </aside>
            </div>
        `;
    },

    renderClasses() {
        if (this.classes.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="16" height="28" rx="2" stroke="#3F3F46" stroke-width="2"/><rect x="26" y="10" width="16" height="28" rx="2" stroke="#3F3F46" stroke-width="2"/><line x1="14" y1="18" x2="14" y2="30" stroke="#52525B" stroke-width="1.5" stroke-linecap="round"/><line x1="34" y1="18" x2="34" y2="30" stroke="#52525B" stroke-width="1.5" stroke-linecap="round"/></svg></div>
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
