import { GradeAdvisorService, AccountService } from '../services/dataServices.js';
import { AuthService } from '../services/auth.js';

/**
 * Floating AI chat widget.
 *
 * Only mounted for signed-in users: the advisor builds its answer from server-side data and is
 * metered against the account's daily token quota, so there is no way to serve a guest without
 * an unattributable — and therefore uncapped — call.
 *
 * Messages are inserted with `textContent`, never `innerHTML`. Model output is untrusted text
 * that reaches the DOM, so treating it as markup would be an injection sink.
 */
export const GradeAdvisor = {
  isOpen: false,
  isLoading: false,
  currentSemesterId: null,
  quota: null,

  async init(semesterId = null) {
    // Never render for guests — the endpoint would reject them anyway, and offering a control
    // that always fails is worse than not offering it.
    if (!AuthService.isSignedIn()) {
      this.destroy();
      return;
    }

    this.currentSemesterId = semesterId;

    // Skip the widget entirely when the deployment has no AI key configured.
    try {
      this.quota = await AccountService.llmQuota();
      if (!this.quota?.llmConfigured) {
        this.destroy();
        return;
      }
    } catch {
      // Quota is advisory; a failed check should not remove a working feature.
      this.quota = null;
    }

    this.destroy();

    const widget = document.createElement('div');
    widget.id = 'grade-advisor-widget';
    widget.innerHTML = this.template();
    document.body.appendChild(widget);

    this.bindEvents();
  },

  destroy() {
    document.getElementById('grade-advisor-widget')?.remove();
    this.isOpen = false;
  },

  template() {
    return `
      <button class="ga-fab" id="ga-fab-btn" title="Grade Advisor" aria-label="Open Grade Advisor">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
        </svg>
        <span class="ga-fab-label">Grade Advisor</span>
      </button>

      <div class="ga-panel" id="ga-panel" style="display:none" role="dialog" aria-label="Grade Advisor">
        <div class="ga-panel-header">
          <div class="ga-panel-title">
            <span class="ga-panel-icon">🎓</span>
            <span>Grade Advisor</span>
          </div>
          <div class="ga-panel-actions">
            <button class="ga-btn-icon" id="ga-clear-btn" title="Clear chat" aria-label="Clear chat">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button class="ga-btn-icon" id="ga-close-btn" title="Close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="ga-messages" id="ga-messages" aria-live="polite"></div>

        <div class="ga-input-row">
          <input type="text" class="ga-input" id="ga-input" placeholder="Ask about your grades..." maxlength="500" aria-label="Ask about your grades">
          <button class="ga-send-btn" id="ga-send-btn" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M16 9L2 2l3 7-3 7 14-7z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('ga-fab-btn')?.addEventListener('click', () => this.toggle());
    document.getElementById('ga-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('ga-clear-btn')?.addEventListener('click', () => this.clearChat());
    document.getElementById('ga-send-btn')?.addEventListener('click', () => this.sendMessage());

    document.getElementById('ga-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });

    this.greet();
  },

  greet() {
    this.appendMessage(
      'assistant',
      "Hi! I'm your Grade Advisor. Ask me things like \"What do I need on the final to get an A in MATH 101?\" or \"Which class is hurting my GPA most?\"",
    );
  },

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  open() {
    this.isOpen = true;

    const panel = document.getElementById('ga-panel');
    if (panel) panel.style.display = 'flex';

    document.getElementById('ga-input')?.focus();
  },

  close() {
    this.isOpen = false;

    const panel = document.getElementById('ga-panel');
    if (panel) panel.style.display = 'none';
  },

  clearChat() {
    GradeAdvisorService.clearHistory();

    const messages = document.getElementById('ga-messages');
    if (messages) messages.innerHTML = '';

    this.greet();
  },

  async sendMessage() {
    if (this.isLoading) return;

    const input = document.getElementById('ga-input');
    const message = input?.value.trim();
    if (!message) return;

    input.value = '';
    this.appendMessage('user', message);

    this.isLoading = true;
    const loadingId = `ga-loading-${Date.now()}`;
    this.appendLoading(loadingId);
    document.getElementById('ga-send-btn')?.setAttribute('disabled', 'true');

    try {
      const response = await GradeAdvisorService.chat(message, this.currentSemesterId);
      document.getElementById(loadingId)?.remove();
      this.appendMessage('assistant', response.message);
    } catch (error) {
      document.getElementById(loadingId)?.remove();

      // Quota and outage are different problems with different user actions, so they get
      // different messages rather than one generic apology.
      const text = error?.isQuotaError
        ? "You've used today's AI allowance. It resets at midnight UTC — everything else still works."
        : (error?.message ?? 'I had trouble connecting. Please try again.');

      this.appendMessage('assistant', text);
    } finally {
      this.isLoading = false;
      document.getElementById('ga-send-btn')?.removeAttribute('disabled');
      document.getElementById('ga-input')?.focus();
    }
  },

  appendMessage(role, content) {
    const messages = document.getElementById('ga-messages');
    if (!messages) return;

    const wrapper = document.createElement('div');
    wrapper.className = `ga-message ga-message--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'ga-message-bubble';
    // textContent, not innerHTML: model output is untrusted.
    bubble.textContent = content ?? '';

    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  },

  appendLoading(id) {
    const messages = document.getElementById('ga-messages');
    if (!messages) return;

    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'ga-message ga-message--assistant';
    wrapper.innerHTML = '<div class="ga-message-bubble ga-loading"><span></span><span></span><span></span></div>';

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  },
};
