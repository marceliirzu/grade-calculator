// Subscription / billing service (Stripe via backend)
const SubscriptionService = {
    _status: null,

    // Cached access snapshot: { hasAccess, status, trialEndsAt, currentPeriodEnd, billingConfigured }
    async getStatus(force = false) {
        if (this._status && !force) return this._status;
        try {
            const res = await Api.get('/payments/subscription');
            this._status = res.data || res;
        } catch (e) {
            console.error('Failed to load subscription status:', e);
            // Fail open on network errors so a billing hiccup never locks the UI;
            // the backend still enforces the paywall on every API call.
            this._status = { hasAccess: true, status: 'unknown', billingConfigured: false };
        }
        return this._status;
    },

    clearCache() {
        this._status = null;
    },

    async hasAccess() {
        const s = await this.getStatus();
        return !!s.hasAccess;
    },

    // Redirect to Stripe Checkout for "monthly" | "yearly"
    async startCheckout(plan = 'monthly') {
        const res = await Api.post('/payments/checkout', { plan });
        const url = res.data?.url || res.url;
        if (!url) throw new Error('No checkout URL returned');
        window.location.href = url;
    },

    // Redirect to the Stripe billing portal (manage / cancel)
    async openPortal() {
        const res = await Api.post('/payments/portal', {});
        const url = res.data?.url || res.url;
        if (!url) throw new Error('No portal URL returned');
        window.location.href = url;
    },

    trialDaysLeft() {
        if (!this._status?.trialEndsAt) return null;
        const ms = new Date(this._status.trialEndsAt) - new Date();
        return ms > 0 ? Math.ceil(ms / 86400000) : 0;
    },

    isSubscribed() {
        return ['active', 'trialing', 'past_due'].includes(this._status?.status);
    }
};
