// Main Application
const App = {
    currentPage: null,
    currentParams: {},
    
    async init() {
        Modal.init();
        CONFIG.loadAPlusValue();
        this.updateAuthUI();
        this.navigate('landing');
    },
    
    updateAuthUI() {
        const userMenu = document.getElementById('userMenu');
        const currentAPlusValue = CONFIG.A_PLUS_VALUE;
        
        // Just show the A+ toggle, no user profile
        userMenu.innerHTML = `
            <div class="aplus-toggle" id="aplusToggle" title="Click to toggle A+ value">
                <span class="toggle-label">A+</span>
                <span class="toggle-value">${currentAPlusValue === 4.33 ? '4.33' : '4.0'}</span>
            </div>
        `;
        
        document.getElementById('aplusToggle')?.addEventListener('click', () => {
            const newValue = CONFIG.A_PLUS_VALUE === 4.0 ? 4.33 : 4.0;
            CONFIG.setAPlusValue(newValue);
            this.updateAuthUI();
            // Refresh current page to reflect changes
            this.navigate(this.currentPage, this.currentParams);
        });
    },
    
    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;
        
        switch (page) {
            case 'landing':
                LandingPage.init();
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
            default:
                LandingPage.init();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});