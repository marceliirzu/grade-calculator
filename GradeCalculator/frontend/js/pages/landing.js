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
                    <div class="hero-logo-animation" id="heroLogo">
                        <span class="digit" id="heroDigit1">0</span>
                        <span class="dot">.</span>
                        <span class="digit" id="heroDigit2">0</span>
                        <span class="digit" id="heroDigit3">0</span>
                    </div>
                    <h1 class="hero-title">Welcome to the Best GPA Calculator</h1>
                    <p class="hero-subtitle">The smart grade calculator that helps with the math so you have more time to stress</p>
                    
                    <div class="features-list">
                        <div class="feature-item">
                            <span class="feature-icon">✨</span>
                            <span>AI automatically extracts grading info from your syllabus</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">📈</span>
                            <span>Track your GPA across all your classes</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🎯</span>
                            <span>What-if mode to plan your grades</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">⚡</span>
                            <span>Special grading rules (ex. drop lowest exam)</span>
                        </div>
                    </div>
                    
                    <div class="login-cta">
                        <button class="btn btn-primary btn-xl" id="devLoginBtn">
                            🚀 Get Started
                        </button>
                        <button class="btn btn-secondary btn-lg" id="comingSoonBtn" style="margin-top: 16px;">
                            🔐 Sign in to Save Data
                        </button>
                        <p class="login-note">Free to use • Your data stays private</p>
                    </div>
                </div>
            </div>
        `;
        
        // Animate the hero logo
        this.animateHeroLogo();
        
        document.getElementById('devLoginBtn')?.addEventListener('click', async () => {
            try {
                await AuthService.devLogin();
                App.updateAuthUI();
                App.navigate('landing');
            } catch (e) {
                console.error(e);
                alert('Login failed. Is the backend running?');
            }
        });
        
        document.getElementById('comingSoonBtn')?.addEventListener('click', () => {
            Modal.show({
                title: '🚧 Coming Soon!',
                content: `
                    <p style="font-size: var(--font-size-lg); color: var(--color-gray-200); line-height: 1.6;">
                        We're working on account sign-in so you can <strong>save your data across devices</strong> and <strong>access it anytime</strong>.
                    </p>
                    <p style="font-size: var(--font-size-base); color: var(--color-gray-400); margin-top: var(--spacing-4);">
                        For now, your grades are saved for the current session. Perfect for tracking this semester!
                    </p>
                `,
                footer: `<button class="btn btn-primary" id="closeComingSoon">Got it!</button>`
            });
            document.getElementById('closeComingSoon')?.addEventListener('click', () => Modal.hide());
        });
    },
    
    animateHeroLogo() {
        const digit1 = document.getElementById('heroDigit1');
        const digit2 = document.getElementById('heroDigit2');
        const digit3 = document.getElementById('heroDigit3');
        
        if (!digit1 || !digit2 || !digit3) return;
        
        const chars = '0123456789';
        let frame = 0;
        const totalFrames = 20;
        
        const interval = setInterval(() => {
            frame++;
            
            if (frame < totalFrames) {
                digit1.textContent = chars[Math.floor(Math.random() * 10)];
                digit2.textContent = chars[Math.floor(Math.random() * 10)];
                digit3.textContent = chars[Math.floor(Math.random() * 10)];
            } else {
                clearInterval(interval);
                digit1.textContent = 'G';
                digit2.textContent = 'P';
                digit3.textContent = 'A';
            }
        }, 50);
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
                    <div class="empty-state-icon">📚</div>
                    <h3 class="empty-state-title">No Classes Yet</h3>
                    <p class="empty-state-text">Add your first class to start tracking your grades.</p>
                    <button class="btn btn-primary btn-lg" id="emptyAddBtn">+ Add Class</button>
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
