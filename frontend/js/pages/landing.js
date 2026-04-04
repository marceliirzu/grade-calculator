// Landing Page
const LandingPage = {
    classes: [],

    async init() {
        if (!AuthService.isLoggedIn()) {
            this.renderLoginPrompt();
            return;
        }

        await this.loadClasses();
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
                            <span class="feature-icon">&#9672;</span>
                            <span>AI extracts grading info from your syllabus automatically</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">&#9672;</span>
                            <span>Track GPA across all your classes in real-time</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">&#9672;</span>
                            <span>What-if mode to simulate future grades</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">&#9672;</span>
                            <span>Import grades from Canvas, Blackboard, or CSV</span>
                        </div>
                    </div>

                    <div class="login-cta">
                        <button class="btn btn-primary btn-xl" id="devLoginBtn">
                            Get Started
                        </button>
                        <button class="btn btn-secondary btn-lg" id="comingSoonBtn" style="margin-top: 8px;">
                            Sign in to save data
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

        document.getElementById('comingSoonBtn')?.addEventListener('click', () => {
            Modal.show({
                title: 'Coming Soon',
                content: `
                    <p style="font-size: var(--font-size-base); color: var(--color-text-secondary); line-height: 1.6;">
                        Account sign-in is coming soon so you can <strong style="color: var(--color-text-primary);">save your data across devices</strong>.
                    </p>
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: var(--spacing-3);">
                        For now, your grades are saved for the current session.
                    </p>
                `,
                footer: `<button class="btn btn-primary" id="closeComingSoon">Got it</button>`
            });
            document.getElementById('closeComingSoon')?.addEventListener('click', () => Modal.hide());
        });
    },

    async loadClasses() {
        try {
            this.classes = await ClassService.getAll();
        } catch (error) {
            console.error('Failed to load classes:', error);
            this.classes = [];
        }
    },

    render() {
        const mainContent = document.getElementById('mainContent');

        mainContent.innerHTML = `
            <div class="landing-page">
                <section class="classes-section">
                    <div class="classes-header">
                        <h2 class="classes-title">My Classes</h2>
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
                    <div class="empty-state-icon">&#9633;</div>
                    <h3 class="empty-state-title">No classes yet</h3>
                    <p class="empty-state-text">Add your first class to start tracking grades.</p>
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

        document.querySelectorAll('.class-card').forEach(card => {
            card.addEventListener('click', () => {
                const classId = card.dataset.classId;
                App.navigate('class', { classId: parseInt(classId) });
            });
        });
    },

    async startAddClass() {
        const syllabusData = await Modal.showSyllabusPaste();
        App.navigate('classSetup', { syllabusData });
    }
};
