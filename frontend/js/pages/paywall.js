// Paywall / pricing page — shown when the trial has ended and no subscription exists.
const PaywallPage = {
    async init(params = {}) {
        const mainContent = document.getElementById('mainContent');
        const status = await SubscriptionService.getStatus(true);
        const expired = params.expired || (status && !status.hasAccess);

        const ck = `<svg class="pw-ck" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        mainContent.innerHTML = `
        <div class="pw">
            <div class="pw-kicker">${expired ? 'Your free trial has ended' : 'Go premium'}</div>
            <h1 class="pw-title">Keep your GPA <em>on track.</em></h1>
            <p class="pw-sub">Unlimited classes, AI syllabus parsing, the grade advisor, and what-if planning — everything you had${expired ? ' during your trial' : ''}, without limits.</p>

            <div class="pw-plans">
                <div class="pw-plan">
                    <div class="pw-plan-name">Monthly</div>
                    <div class="pw-price">$4.99<small>/month</small></div>
                    <ul>
                        <li>${ck} Unlimited classes &amp; semesters</li>
                        <li>${ck} AI syllabus parsing</li>
                        <li>${ck} Grade advisor chat</li>
                        <li>${ck} What-if grade planning</li>
                    </ul>
                    <button class="btn btn-secondary btn-lg btn-block" data-plan="monthly">Choose monthly</button>
                </div>
                <div class="pw-plan pw-plan--featured">
                    <div class="pw-flag">Best value</div>
                    <div class="pw-plan-name">Yearly</div>
                    <div class="pw-price">$29.99<small>/year</small></div>
                    <ul>
                        <li>${ck} Everything in monthly</li>
                        <li>${ck} Two months free</li>
                        <li>${ck} One payment per school year</li>
                        <li>${ck} Cancel anytime</li>
                    </ul>
                    <button class="btn btn-primary btn-lg btn-block" data-plan="yearly" style="background:#fff;color:var(--ink);">Choose yearly</button>
                </div>
            </div>

            <p class="pw-note">
                Secure checkout by Stripe · Cancel anytime from your billing portal.
                ${SubscriptionService.isSubscribed() ? '<br><a id="pwPortalLink">Manage existing subscription</a>' : ''}
            </p>
            <p class="pw-note" style="margin-top:var(--spacing-4)">
                <a id="pwLogout">Sign out</a>
            </p>
        </div>`;

        mainContent.querySelectorAll('[data-plan]').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Opening checkout…';
                try {
                    await SubscriptionService.startCheckout(btn.dataset.plan);
                } catch (e) {
                    console.error(e);
                    btn.disabled = false;
                    btn.textContent = btn.dataset.plan === 'yearly' ? 'Choose yearly' : 'Choose monthly';
                    Modal._showToast(e.message?.includes('configured')
                        ? 'Billing is not set up yet — check back soon.'
                        : 'Could not open checkout. Please try again.');
                }
            });
        });

        document.getElementById('pwPortalLink')?.addEventListener('click', () =>
            SubscriptionService.openPortal().catch(() => Modal._showToast('Could not open the billing portal.')));

        document.getElementById('pwLogout')?.addEventListener('click', () => AuthService.logout());
    }
};
