// Main Application
const App = {
    currentPage: null,
    currentParams: {},
    subscription: null,

    async init() {
        Modal.init();
        CONFIG.loadAPlusValue();

        // Returning from Stripe Checkout?
        const query = new URLSearchParams(window.location.search);
        const checkout = query.get('checkout');
        if (checkout) {
            history.replaceState(null, '', window.location.pathname);
        }

        if (!AuthService.isLoggedIn()) {
            this.updateAuthUI();
            this.navigate('landing');
            return;
        }

        // Logged in — resolve subscription before rendering the app.
        this.subscription = await SubscriptionService.getStatus(true);

        if (checkout === 'success') {
            // Webhooks can lag a second or two behind the redirect.
            if (!this.subscription.hasAccess) {
                await new Promise(r => setTimeout(r, 1500));
                this.subscription = await SubscriptionService.getStatus(true);
            }
            Modal._showToast('Subscription active — welcome aboard!');
        }

        this.updateAuthUI();

        if (!this.subscription.hasAccess) {
            this.navigate('paywall', { expired: true });
        } else {
            this.navigate('semesterList');
        }
    },

    updateAuthUI() {
        const userMenu = document.getElementById('userMenu');
        const currentAPlusValue = CONFIG.A_PLUS_VALUE;

        const isLoggedIn = AuthService.isLoggedIn();
        const showBilling = isLoggedIn && SubscriptionService.isSubscribed();
        userMenu.innerHTML = `
            <div class="aplus-toggle" id="aplusToggle" title="Toggle A+ value">
                <span class="toggle-label">A+ scale</span>
                <span class="toggle-value">${currentAPlusValue === 4.33 ? '4.33' : '4.0'}</span>
            </div>
            ${isLoggedIn ? `
                <button class="btn btn-secondary btn-sm" id="semestersBtn">Semesters</button>
                <button class="btn btn-secondary btn-sm" id="historyBtn">History</button>
                ${showBilling ? '<button class="btn btn-secondary btn-sm" id="billingBtn">Billing</button>' : ''}
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

        document.getElementById('billingBtn')?.addEventListener('click', () => {
            SubscriptionService.openPortal().catch(() =>
                Modal._showToast('Could not open the billing portal.'));
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            AuthService.logout();
        });

        // Initialize Grade Advisor chat widget when logged in with access
        // (needs a real account — the AI runs server-side)
        if (isLoggedIn && this.subscription?.hasAccess && !AuthService.isGuest()) {
            GradeAdvisor.init(SemesterService.getCurrentSemesterId());
        } else {
            document.getElementById('grade-advisor-widget')?.remove();
        }

        // Logo click goes home
        document.getElementById('logoContainer')?.addEventListener('click', () => {
            this.navigate(AuthService.isLoggedIn() ? 'semesterList' : 'landing');
        });
    },

    // Renders a dismissable trial countdown above app pages while on trial.
    renderTrialBanner() {
        const s = this.subscription;
        if (s && s.status === 'guest') {
            return `
            <div class="trial-banner" style="background:var(--chunk-emerald);">
                <span>Guest mode — your data is saved in this browser only.</span>
            </div>`;
        }
        if (!s || s.status !== 'trial' || !s.trialEndsAt) return '';
        const days = SubscriptionService.trialDaysLeft();
        if (days === null) return '';
        return `
            <div class="trial-banner">
                <span>${days > 0 ? `${days} day${days === 1 ? '' : 's'} left in your free trial` : 'Your free trial ends today'}</span>
                <button class="btn btn-primary btn-sm" onclick="App.navigate('paywall')">Subscribe now</button>
            </div>`;
    },

    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;

        // The marketing hero hides the app header; every other view shows it.
        if (page !== 'landing' || AuthService.isLoggedIn()) {
            document.querySelector('.header')?.classList.remove('hidden');
        }

        // Hard gate: no access -> only the paywall is reachable.
        if (AuthService.isLoggedIn() && this.subscription && !this.subscription.hasAccess && page !== 'paywall') {
            page = 'paywall';
            params = { expired: true };
            this.currentPage = page;
            this.currentParams = params;
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
            case 'paywall':
                PaywallPage.init(params);
                break;
            default:
                LandingPage.init();
        }

        // Trial banner lives in its own host so async page renders can't wipe it.
        const bannerHost = document.getElementById('trialBannerHost');
        if (bannerHost) {
            const showBanner = page !== 'paywall' && page !== 'landing' && AuthService.isLoggedIn();
            bannerHost.innerHTML = showBanner ? this.renderTrialBanner() : '';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
