// Modal Component with Syllabus Parsing & Gradebook Import
const Modal = {
    container: null,

    init() {
        this.container = document.getElementById('modalContainer');
    },

    show({ title, content, footer }) {
        this.container.innerHTML = `
            <div class="modal-backdrop">
                <div class="modal">
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                </div>
            </div>
        `;
        this.container.style.display = 'block';

        // Close on backdrop click
        this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hide();
        });
    },

    hide() {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
    },

    async confirm({ title, message, confirmText = 'Confirm', danger = false }) {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p class="confirm-message">${message}</p>`,
                footer: `
                    <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmBtn">${confirmText}</button>
                `
            });

            document.getElementById('cancelBtn').addEventListener('click', () => {
                this.hide();
                resolve(false);
            });
            document.getElementById('confirmBtn').addEventListener('click', () => {
                this.hide();
                resolve(true);
            });
        });
    },

    // ==================== Syllabus Paste Modal ====================
    async showSyllabusPaste() {
        return new Promise((resolve) => {
            let activeTab = 'smart'; // 'smart' or 'ai'

            const renderModal = () => {
                this.container.innerHTML = `
                    <div class="modal-backdrop">
                        <div class="modal modal-lg">
                            <div class="modal-header">
                                <h2 class="modal-title">Import from Syllabus</h2>
                            </div>
                            <div class="modal-body" id="syllabusModalBody">
                                <div class="parser-tabs">
                                    <button class="parser-tab ${activeTab === 'smart' ? 'active' : ''}" data-tab="smart">
                                        Smart Parse
                                    </button>
                                    <button class="parser-tab ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai">
                                        AI Parse
                                    </button>
                                </div>

                                <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                                    ${activeTab === 'smart'
                                        ? 'Paste your syllabus text and we\'ll instantly extract grading info. No API needed.'
                                        : 'Uses AI to analyze your syllabus. Requires backend to be running with an OpenAI API key.'
                                    }
                                </p>

                                <textarea
                                    class="syllabus-textarea"
                                    id="syllabusText"
                                    placeholder="Paste your syllabus here...

Example:
MATH 101 - Introduction to Calculus
3 Credit Hours

Grading:
- Homework: 25%
- Quizzes: 15%
- Midterm Exam: 25%
- Final Exam: 35%

Grade Scale:
A: 90-100%
B: 80-89%
C: 70-79%
D: 60-69%
F: Below 60%"
                                ></textarea>

                                <div id="parsePreview"></div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" id="skipSyllabus">Skip</button>
                                <button class="btn btn-primary" id="parseSyllabus">
                                    ${activeTab === 'smart' ? 'Parse & Continue' : 'Analyze with AI'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                this.container.style.display = 'block';

                // Tab switching
                this.container.querySelectorAll('.parser-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        activeTab = tab.dataset.tab;
                        renderModal();
                    });
                });

                // Live preview for smart parse
                if (activeTab === 'smart') {
                    const textarea = document.getElementById('syllabusText');
                    let debounceTimer;
                    textarea.addEventListener('input', () => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            this._showParsePreview(textarea.value);
                        }, 400);
                    });
                }

                // Skip
                document.getElementById('skipSyllabus').addEventListener('click', () => {
                    this.hide();
                    resolve(null);
                });

                // Parse
                document.getElementById('parseSyllabus').addEventListener('click', async () => {
                    const text = document.getElementById('syllabusText').value.trim();
                    if (!text) {
                        this._showToast('Please paste your syllabus text first');
                        return;
                    }

                    if (activeTab === 'smart') {
                        // Client-side parse
                        const result = SyllabusParser.parse(text);
                        if (result && result.categories.length > 0) {
                            this.hide();
                            resolve(result);
                        } else {
                            this._showToast('Could not detect grading categories. Try AI Parse or enter manually.');
                        }
                    } else {
                        // AI parse
                        this._showAILoading();
                        try {
                            const result = await SyllabusService.parse(text);
                            this.hide();
                            resolve(result);
                        } catch (error) {
                            console.error('AI parse failed:', error);
                            this._showAIError(error, resolve, renderModal);
                        }
                    }
                });

                // Backdrop close
                this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
                    if (e.target === e.currentTarget) {
                        this.hide();
                        resolve(null);
                    }
                });
            };

            renderModal();
        });
    },

    _showParsePreview(text) {
        const preview = document.getElementById('parsePreview');
        if (!preview || !text.trim()) {
            if (preview) preview.innerHTML = '';
            return;
        }

        const result = SyllabusParser.parse(text);
        if (!result || result.categories.length === 0) {
            preview.innerHTML = '';
            return;
        }

        let html = `<div class="parse-preview">
            <div class="parse-preview-title">Detected Info</div>`;

        if (result.className) {
            html += `<div class="parse-preview-item">
                <span>Class</span>
                <span class="parse-preview-value">${result.className}</span>
            </div>`;
        }

        html += `<div class="parse-preview-item">
            <span>Credits</span>
            <span class="parse-preview-value">${result.creditHours}</span>
        </div>`;

        for (const cat of result.categories) {
            html += `<div class="parse-preview-item">
                <span>${cat.name}</span>
                <span class="parse-preview-value">${cat.weight}%</span>
            </div>`;
        }

        if (result.gradeScale) {
            html += `<div class="parse-preview-item">
                <span>Grade Scale</span>
                <span class="parse-preview-value">Custom detected</span>
            </div>`;
        }

        html += '</div>';
        preview.innerHTML = html;
    },

    _showAILoading() {
        const body = document.getElementById('syllabusModalBody');
        if (body) {
            body.innerHTML = `
                <div class="ai-processing">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: var(--spacing-4);">Analyzing your syllabus...</p>
                    <p style="color: var(--color-text-muted); font-size: var(--font-size-xs); margin-top: var(--spacing-2);">This may take a few seconds</p>
                </div>
            `;
        }
        const footer = this.container.querySelector('.modal-footer');
        if (footer) footer.style.display = 'none';
    },

    _showAIError(error, resolve, renderModal) {
        const body = document.getElementById('syllabusModalBody');
        if (body) {
            body.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-8);">
                    <p style="color: var(--color-danger); font-size: var(--font-size-lg); margin-bottom: var(--spacing-3);">Analysis failed</p>
                    <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-4);">
                        ${error.message || 'Check your API key in appsettings.json or try Smart Parse instead.'}
                    </p>
                </div>
            `;
        }
        const footer = this.container.querySelector('.modal-footer');
        if (footer) {
            footer.style.display = 'flex';
            footer.innerHTML = `
                <button class="btn btn-secondary" id="skipAfterError">Enter Manually</button>
                <button class="btn btn-primary" id="retrySyllabus">Try Again</button>
            `;
            document.getElementById('skipAfterError').addEventListener('click', () => {
                this.hide();
                resolve(null);
            });
            document.getElementById('retrySyllabus').addEventListener('click', () => {
                this.hide();
                this.showSyllabusPaste().then(resolve);
            });
        }
    },

    _showToast(message) {
        // Simple inline toast
        const existing = document.querySelector('.modal-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'modal-toast';
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            background: var(--color-zinc-800); color: var(--color-text-primary);
            padding: 10px 20px; border-radius: var(--radius-lg);
            font-size: var(--font-size-sm); z-index: 9999;
            border: 1px solid var(--color-border);
            box-shadow: var(--shadow-lg);
            animation: fadeInUp 0.2s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // ==================== Gradebook Import Modal ====================
    async showGradebookImport() {
        return new Promise((resolve) => {
            this.container.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal modal-lg">
                        <div class="modal-header">
                            <h2 class="modal-title">Import Grades</h2>
                        </div>
                        <div class="modal-body">
                            <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                                Paste grades from Canvas, Blackboard, or any spreadsheet. Supports CSV, tab-separated, or "Name: score/total" format.
                            </p>
                            <textarea
                                class="syllabus-textarea"
                                id="gradebookText"
                                style="min-height: 220px;"
                                placeholder="Paste your grades here...

Examples:
Homework 1: 85/100
Homework 2: 92/100
Quiz 1: 18/20

Or CSV:
Assignment, Score, Possible
Homework 1, 85, 100
Quiz 1, 18, 20"
                            ></textarea>
                            <div id="gradebookPreview"></div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="cancelImport">Cancel</button>
                            <button class="btn btn-primary" id="importGrades">Import Grades</button>
                        </div>
                    </div>
                </div>
            `;
            this.container.style.display = 'block';

            // Live preview
            const textarea = document.getElementById('gradebookText');
            let debounceTimer;
            textarea.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const grades = GradebookParser.parse(textarea.value);
                    const preview = document.getElementById('gradebookPreview');
                    if (grades.length > 0) {
                        preview.innerHTML = `
                            <div class="parse-preview">
                                <div class="parse-preview-title">Found ${grades.length} grade${grades.length !== 1 ? 's' : ''}</div>
                                ${grades.slice(0, 8).map(g => `
                                    <div class="parse-preview-item">
                                        <span>${g.name}</span>
                                        <span class="parse-preview-value">${g.pointsEarned !== null ? g.pointsEarned : '—'}/${g.pointsPossible}</span>
                                    </div>
                                `).join('')}
                                ${grades.length > 8 ? `<div class="parse-preview-item"><span style="color: var(--color-text-muted);">...and ${grades.length - 8} more</span><span></span></div>` : ''}
                            </div>
                        `;
                    } else {
                        preview.innerHTML = '';
                    }
                }, 400);
            });

            // Cancel
            document.getElementById('cancelImport').addEventListener('click', () => {
                this.hide();
                resolve([]);
            });

            // Import
            document.getElementById('importGrades').addEventListener('click', () => {
                const grades = GradebookParser.parse(textarea.value);
                if (grades.length > 0) {
                    this.hide();
                    resolve(grades);
                } else {
                    this._showToast('No grades detected. Check your format and try again.');
                }
            });

            // Backdrop close
            this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this.hide();
                    resolve([]);
                }
            });
        });
    }
};
