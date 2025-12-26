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
        document.querySelector('.header-logo, .logo')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('landing');
        });
        
        // GPA badge click - always go to landing
        document.querySelector('.gpa-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('landing');
        });
    },
    
    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;
        
        // Hide header on start page
        const header = document.querySelector('.header, .app-header');
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

// Start Page
const StartPage = {
    init() {
        const mainContent = document.getElementById('mainContent');
        
        mainContent.innerHTML = `
            <div class="start-page" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0D1B2A 0%, #1f2937 100%);">
                <div style="text-align: center; max-width: 400px; padding: 2rem;">
                    <div style="font-size: 4rem; font-weight: 700; color: white; margin-bottom: 2rem;">
                        G<span style="color: #C9A227;">.</span>PA
                    </div>
                    <h1 style="font-size: 1.5rem; color: white; margin-bottom: 1rem;">Track Your Academic Progress</h1>
                    <p style="color: #9ca3af; margin-bottom: 2rem;">Calculate your GPA, track grades by category, and plan for success.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div id="googleSignInDiv"></div>
                        <div style="color: #6b7280;">or</div>
                        <button class="btn btn-secondary" id="continueWithoutLogin" style="padding: 0.75rem 1.5rem;">
                            Continue without signing in
                        </button>
                        <p style="font-size: 0.875rem; color: #6b7280;">Your data will be saved locally</p>
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
