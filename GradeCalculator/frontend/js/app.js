// Main Application
const App = {
    currentPage: null,
    
    async init() {
        Modal.init();
        CONFIG.loadAPlusValue();
        
        // Check if first visit this session
        const hasVisited = sessionStorage.getItem('gc_visited');
        const isLoggedIn = Storage.isGoogleUser() || Storage.get('gc_local_mode');
        
        if (!hasVisited && !isLoggedIn) {
            this.navigate('start');
        } else {
            this.navigate('landing');
        }
        
        this.bindGlobalEvents();
    },
    
    bindGlobalEvents() {
        // Logo click - always go to landing (not start)
        document.getElementById('headerLogo')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('landing');
        });
    },
    
    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;
        
        // Hide header on start page
        const header = document.querySelector('.header');
        if (page === 'start') {
            header?.classList.add('hidden');
        } else {
            header?.classList.remove('hidden');
        }
        
        switch (page) {
            case 'start':
                StartPage.init();
                break;
            case 'landing':
                LandingPage.init();
                break;
            case 'classSetup':
            case 'setup':
                ClassSetupPage.init(params);
                break;
            case 'class':
                ClassDetailPage.init(params);
                break;
            case 'category':
                CategoryEditorPage.init(params);
                break;
            default:
                LandingPage.init();
        }
    }
};

// Start Page with animated G.PA logo
const StartPage = {
    init() {
        const mainContent = document.getElementById('mainContent');
        
        mainContent.innerHTML = `
            <div class="start-page">
                <div class="start-content">
                    <!-- Animated G.PA Logo -->
                    <div class="hero-logo-animation" id="heroLogo">
                        <span class="digit" id="heroDigit1">0</span>
                        <span class="dot">.</span>
                        <span class="digit" id="heroDigit2">0</span>
                        <span class="digit" id="heroDigit3">0</span>
                    </div>
                    
                    <h1 class="start-title">The Smart GPA Calculator</h1>
                    <p class="start-subtitle">Track your grades, calculate your GPA, and plan for academic success.</p>
                    
                    <div class="start-features">
                        <div class="feature-item">
                            <span class="feature-icon">✨</span>
                            <span>AI extracts grading info from your syllabus</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">📊</span>
                            <span>Track grades by category with weighted calculations</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🎯</span>
                            <span>What-if mode to plan your grades</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">⚡</span>
                            <span>Special rules: drop lowest, weight by score</span>
                        </div>
                    </div>
                    
                    <div class="start-actions">
                        <div id="googleSignInDiv"></div>
                        <span class="start-divider">or</span>
                        <button class="btn btn-secondary btn-lg" id="continueWithoutLogin">
                            Continue without signing in
                        </button>
                        <p class="start-note">Your data will be saved locally on this device</p>
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
        this.initGoogleSignIn();
        
        // Run animation after a short delay
        setTimeout(() => this.animateHeroLogo(), 200);
        
        // Re-run animation when clicking the logo
        document.getElementById('heroLogo')?.addEventListener('click', () => {
            this.animateHeroLogo();
        });
    },
    
    animateHeroLogo() {
        const digit1 = document.getElementById('heroDigit1');
        const digit2 = document.getElementById('heroDigit2');
        const digit3 = document.getElementById('heroDigit3');
        
        if (!digit1 || !digit2 || !digit3) return;
        
        const chars = '0123456789';
        let frame = 0;
        const totalFrames = 25;
        
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
    
    bindEvents() {
        document.getElementById('continueWithoutLogin')?.addEventListener('click', () => {
            Storage.set('gc_local_mode', true);
            sessionStorage.setItem('gc_visited', 'true');
            App.navigate('landing');
        });
    },
    
    initGoogleSignIn() {
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.initialize({
                client_id: '131903826542-7qnjr23brvee37re47v2dcc93nknr3uf.apps.googleusercontent.com',
                callback: this.handleGoogleSignIn.bind(this)
            });
            google.accounts.id.renderButton(
                document.getElementById('googleSignInDiv'),
                { theme: 'filled_blue', size: 'large', text: 'signin_with', width: 280 }
            );
        }
    },
    
    async handleGoogleSignIn(response) {
        try {
            const result = await AuthService.googleLogin(response.credential);
            if (result.success) {
                sessionStorage.setItem('gc_visited', 'true');
                App.navigate('landing');
            }
        } catch (error) {
            console.error('Google sign in error:', error);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
