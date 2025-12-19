// Landing Page
const LandingPage = {
    classes: [],
    
    async init() {
        // Only skip landing page if logged in with Google (not dev login)
        const user = Storage.getUser();
        const isGoogleUser = user && user.googleId && !user.googleId.startsWith('dev-');
        
        if (!isGoogleUser) {
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
                        <button class="google-btn" id="googleSignInBtn">
                            <svg viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                        </button>
                        <button class="btn btn-secondary btn-lg" id="devLoginBtn" style="margin-top: 16px;">
                            Continue without logging in
                        </button>
                        <p class="login-note">Free to use • Your data stays private</p>
                    </div>
                </div>
            </div>
        `;
        
        // Animate the hero logo
        this.animateHeroLogo();
        
        // Google Sign-in
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
            AuthService.signInWithGoogle();
        });
        
        // Dev login (continue without signing in) - goes directly to app
        document.getElementById('devLoginBtn')?.addEventListener('click', async () => {
            try {
                await AuthService.devLogin();
                App.updateAuthUI();
                // Load classes and show main app
                await this.loadClasses();
                this.render();
                this.bindEvents();
            } catch (e) {
                console.error(e);
                alert('Login failed. Is the backend running?');
            }
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
