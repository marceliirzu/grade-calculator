// Grade Advisor - Floating AI chat component
const GradeAdvisor = {
    isOpen: false,
    isLoading: false,
    currentSemesterId: null,

    init(semesterId = null) {
        this.currentSemesterId = semesterId;
        // Remove existing if any
        document.getElementById('grade-advisor-widget')?.remove();

        const widget = document.createElement('div');
        widget.id = 'grade-advisor-widget';
        widget.innerHTML = this._renderWidget();
        document.body.appendChild(widget);
        this._bindEvents();
    },

    _renderWidget() {
        return `
            <button class="ga-fab" id="ga-fab-btn" title="Grade Advisor">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
                </svg>
                <span class="ga-fab-label">Grade Advisor</span>
            </button>

            <div class="ga-panel" id="ga-panel" style="display:none">
                <div class="ga-panel-header">
                    <div class="ga-panel-title">
                        <span class="ga-panel-icon">🎓</span>
                        <span>Grade Advisor</span>
                    </div>
                    <div class="ga-panel-actions">
                        <button class="ga-btn-icon" id="ga-clear-btn" title="Clear chat">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </button>
                        <button class="ga-btn-icon" id="ga-close-btn" title="Close">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                </div>
                <div class="ga-messages" id="ga-messages">
                    <div class="ga-message ga-message--assistant">
                        <div class="ga-message-bubble">👋 Hi! I'm your Grade Advisor. Ask me anything about your grades — like "What do I need to get an A in MATH 101?" or "What's my GPA if I get a B in all my classes?"</div>
                    </div>
                </div>
                <div class="ga-input-row">
                    <input type="text" class="ga-input" id="ga-input" placeholder="Ask about your grades..." maxlength="500">
                    <button class="ga-send-btn" id="ga-send-btn">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 9L2 2l3 7-3 7 14-7z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>`;
    },

    _bindEvents() {
        document.getElementById('ga-fab-btn')?.addEventListener('click', () => this.toggle());
        document.getElementById('ga-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('ga-clear-btn')?.addEventListener('click', () => this.clearChat());

        const input = document.getElementById('ga-input');
        const sendBtn = document.getElementById('ga-send-btn');

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        sendBtn?.addEventListener('click', () => this.sendMessage());
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
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
        if (messages) {
            messages.innerHTML = `
                <div class="ga-message ga-message--assistant">
                    <div class="ga-message-bubble">Chat cleared! What would you like to know about your grades?</div>
                </div>`;
        }
    },

    async sendMessage() {
        if (this.isLoading) return;
        const input = document.getElementById('ga-input');
        const message = input?.value.trim();
        if (!message) return;

        // Clear input
        if (input) input.value = '';

        // Show user message
        this._appendMessage('user', message);

        // Show loading
        this.isLoading = true;
        const loadingId = 'ga-loading-' + Date.now();
        this._appendLoading(loadingId);
        document.getElementById('ga-send-btn')?.setAttribute('disabled', 'true');

        try {
            const response = await GradeAdvisorService.chat(message, this.currentSemesterId);
            document.getElementById(loadingId)?.remove();
            this._appendMessage('assistant', response);
        } catch (err) {
            document.getElementById(loadingId)?.remove();
            this._appendMessage('assistant', 'Sorry, I had trouble connecting. Please try again.');
            console.error('Grade Advisor error:', err);
        } finally {
            this.isLoading = false;
            document.getElementById('ga-send-btn')?.removeAttribute('disabled');
            document.getElementById('ga-input')?.focus();
        }
    },

    _appendMessage(role, content) {
        const messages = document.getElementById('ga-messages');
        if (!messages) return;
        const div = document.createElement('div');
        div.className = `ga-message ga-message--${role}`;
        // Basic XSS-safe text rendering
        const bubble = document.createElement('div');
        bubble.className = 'ga-message-bubble';
        bubble.textContent = content;
        div.appendChild(bubble);
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    },

    _appendLoading(id) {
        const messages = document.getElementById('ga-messages');
        if (!messages) return;
        const div = document.createElement('div');
        div.id = id;
        div.className = 'ga-message ga-message--assistant';
        div.innerHTML = '<div class="ga-message-bubble ga-loading"><span></span><span></span><span></span></div>';
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }
};
