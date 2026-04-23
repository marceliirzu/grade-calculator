// Main Application
const App = {
    currentPage: null,
    currentParams: {},

    async init() {
        Modal.init();
        CONFIG.loadAPlusValue();
        this.updateAuthUI();
        this.navigate('semesterList');
    },

    updateAuthUI() {
        const userMenu = document.getElementById('userMenu');
        const currentAPlusValue = CONFIG.A_PLUS_VALUE;

        const isLoggedIn = AuthService.isLoggedIn();
        userMenu.innerHTML = `
            <div class="aplus-toggle" id="aplusToggle" title="Toggle A+ value">
                <span class="toggle-label">A+</span>
                <span class="toggle-value">${currentAPlusValue === 4.33 ? '4.33' : '4.0'}</span>
            </div>
            ${isLoggedIn ? `
                <button class="btn btn-secondary btn-sm" id="semestersBtn" style="font-size:0.75rem;padding:4px 10px;">Semesters</button>
                <button class="btn btn-secondary btn-sm" id="historyBtn" style="font-size:0.75rem;padding:4px 10px;">History</button>
                <button class="btn btn-secondary btn-sm" id="logoutBtn" style="font-size:0.75rem;padding:4px 10px;">Sign out</button>
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
            this.navigate('landing');
        });
    },

    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;

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
