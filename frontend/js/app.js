// Main Application
const App = {
    currentPage: null,
    currentParams: {},

    async init() {
        Modal.init();
        CONFIG.loadAPlusValue();
        this.updateAuthUI();
        // Logged-out visitors land on the marketing hero; members go to their semesters.
        if (AuthService.isLoggedIn()) {
            this.navigate('semesterList');
        } else {
            this.navigate('landing');
        }
    },

    updateAuthUI() {
        const userMenu = document.getElementById('userMenu');
        const currentAPlusValue = CONFIG.A_PLUS_VALUE;

        const isLoggedIn = AuthService.isLoggedIn();
        userMenu.innerHTML = `
            <div class="aplus-toggle" id="aplusToggle" title="Toggle A+ value">
                <span class="toggle-label">A+ scale</span>
                <span class="toggle-value">${currentAPlusValue === 4.33 ? '4.33' : '4.0'}</span>
            </div>
            ${isLoggedIn ? `
                <button class="btn btn-secondary btn-sm" id="semestersBtn">Semesters</button>
                <button class="btn btn-secondary btn-sm" id="historyBtn">History</button>
                <button class="btn btn-secondary btn-sm" id="logoutBtn">Sign out</button>
            ` : ''}
        `;

        document.getElementById('aplusToggle')?.addEventListener('click', () => {
            const newValue = CONFIG.A_PLUS_VALUE === 4.0 ? 4.33 : 4.0;
            CONFIG.setAPlusValue(newValue);
            this.updateAuthUI();
            this.navigate(this.currentPage, this.currentParams);
        });

        document.getElementById('semestersBtn')?.addEventListener('click', () => {
            this.navigate('semesterList');
        });

        document.getElementById('historyBtn')?.addEventListener('click', () => {
            this.navigate('semesterHistory');
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            AuthService.logout();
        });

        // Initialize Grade Advisor chat widget when logged in
        if (isLoggedIn) {
            GradeAdvisor.init(SemesterService.getCurrentSemesterId());
        } else {
            document.getElementById('grade-advisor-widget')?.remove();
        }

        // Logo click goes home
        document.getElementById('logoContainer')?.addEventListener('click', () => {
            this.navigate(AuthService.isLoggedIn() ? 'semesterList' : 'landing');
        });
    },

    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;

        // The marketing hero hides the app header; every other view shows it.
        if (page !== 'landing' || AuthService.isLoggedIn()) {
            document.querySelector('.header')?.classList.remove('hidden');
        }

        switch (page) {
            case 'landing':
                LandingPage.init(params);
                break;
            case 'classSetup':
                ClassSetupPage.init(params);
                break;
            case 'class':
                ClassDetailPage.init(params);
                break;
            case 'category':
                CategoryEditorPage.init(params);
                break;
            case 'semesterList':
                SemesterListPage.init(params);
                break;
            case 'semesterHistory':
                SemesterHistoryPage.init(params);
                break;
            default:
                LandingPage.init();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
