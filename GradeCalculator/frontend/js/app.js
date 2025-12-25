// Main App - Navigation and State Management
const App = {
    currentPage: null,
    
    init() {
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
        document.querySelector('.header-logo')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('landing');
        });
        
        document.querySelector('.gpa-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('landing');
        });
    },
    
    async navigate(page, params = {}) {
        this.currentPage = page;
        
        const header = document.querySelector('.app-header');
        if (page === 'start') {
            header?.classList.add('hidden');
        } else {
            header?.classList.remove('hidden');
        }
        
        switch (page) {
            case 'start':
                await StartPage.init();
                break;
            case 'landing':
                await LandingPage.init();
                break;
            case 'setup':
                await ClassSetupPage.init(params);
                break;
            case 'class':
                await ClassDetailPage.init(params);
                break;
            case 'category':
                await CategoryEditorPage.init(params);
                break;
            default:
                await LandingPage.init();
        }
    }
};

const StartPage = {
    init() {
        const mainContent = document.getElementById('mainContent');
        
        mainContent.innerHTML = `
            <div class="start-page">
                <div class="start-content">
                    <div class="start-logo">
                        <span class="logo-text">
                            <span class="logo-g">G</span><span class="logo-dot">.</span><span class="logo-pa">PA</span>
                        </span>
                    </div>
                    <h1 class="start-title">Track Your Academic Progress</h1>
                    <p class="start-subtitle">Calculate your GPA, track grades by category, and plan for success.</p>
                    
                    <div class="start-features">
                        <div class="feature">
                            <span class="feature-icon">📊</span>
                            <span class="feature-text">Real-time GPA calculation</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">🤖</span>
                            <span class="feature-text">AI-powered syllabus parsing</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">🎯</span>
                            <span class="feature-text">What-if grade planning</span>
                        </div>
                    </div>
                    
                    <div class="start-actions">
                        <div id="googleSignInDiv" class="google-signin-container"></div>
                        <div class="divider"><span>or</span></div>
                        <button class="btn btn-secondary btn-lg" id="continueWithoutLogin">
                            Continue without signing in
                        </button>
                        <p class="local-mode-note">Your data will be saved locally on this device</p>
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
        this.initGoogleSignIn();
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
            } else {
                alert('Sign in failed. Please try again.');
            }
        } catch (error) {
            console.error('Google sign in error:', error);
            alert('Sign in failed. Please try again.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    if (typeof CONFIG !== 'undefined' && CONFIG.loadAPlusValue) {
        CONFIG.loadAPlusValue();
    }
    App.init();
    document.body.classList.add('loaded');
});
