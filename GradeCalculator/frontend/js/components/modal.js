// Modal Component
const Modal = {
    init() {
        // Modal initialization
    },

    show({ title, content, footer, size = 'medium', closable = true }) {
        const container = document.getElementById('modalContainer');

        const sizeClass = {
            small: 'modal-sm',
            medium: 'modal-md',
            large: 'modal-lg'
        }[size] || 'modal-md';

        container.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal ${sizeClass}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    ${closable ? '<button class="modal-close" id="modalCloseBtn">&times;</button>' : ''}
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        container.classList.add('active');

        if (closable) {
            document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hide());
            container.querySelector('.modal-backdrop')?.addEventListener('click', () => this.hide());
        }
    },

    hide() {
        const container = document.getElementById('modalContainer');
        container.classList.remove('active');
        container.innerHTML = '';
    },

    _showToast(message) {
        const existing = document.querySelector('.modal-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'modal-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // Syllabus paste modal - with Smart Parse + AI Parse tabs
    showSyllabusPaste() {
        return new Promise((resolve) => {
            let activeTab = 'smart';

            const renderSyllabusModal = () => {
                this.show({
                    title: 'Add Class from Syllabus',
                    size: 'large',
                    content: `
                        <div class="parser-tabs">
                            <button class="parser-tab ${activeTab === 'smart' ? 'active' : ''}" data-tab="smart">Smart Parse</button>
                            <button class="parser-tab ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai">AI Parse</button>
                        </div>
                        <p class="modal-description">
                            ${activeTab === 'smart'
                                ? 'Paste your syllabus and we\'ll instantly extract grading info. No backend needed.'
                                : 'Uses AI to analyze your syllabus. Requires the backend to be running.'
                            }
                        </p>
                        <div class="paste-options">
                            <button class="btn btn-secondary btn-sm" id="pasteSyllabusBtn">Paste from clipboard</button>
                        </div>
                        <textarea
                            id="syllabusContent"
                            class="syllabus-textarea"
                            placeholder="Paste your syllabus here...

Example:
Grading:
- Homework (20%)
- Quizzes (15%)
- Midterm Exam (25%)
- Final Exam (40%)"
                            rows="10"
                        ></textarea>
                        <div id="parsePreviewArea"></div>
                    `,
                    footer: `
                        <button class="btn btn-secondary" id="skipSyllabusBtn">Skip</button>
                        <button class="btn btn-primary" id="parseSyllabusBtn">
                            ${activeTab === 'smart' ? 'Parse & Continue' : 'Analyze with AI'}
                        </button>
                    `
                });

                // Tab switching
                document.querySelectorAll('.parser-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        activeTab = tab.dataset.tab;
                        renderSyllabusModal();
                    });
                });

                // Live preview for smart parse
                if (activeTab === 'smart') {
                    const textarea = document.getElementById('syllabusContent');
                    let debounceTimer;
                    textarea?.addEventListener('input', () => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            this._showSyllabusPreview(textarea.value);
                        }, 400);
                    });
                }

                // Paste from clipboard
                document.getElementById('pasteSyllabusBtn')?.addEventListener('click', async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        document.getElementById('syllabusContent').value = text;
                        if (activeTab === 'smart') {
                            this._showSyllabusPreview(text);
                        }
                    } catch (err) {
                        this._showToast('Could not access clipboard. Paste manually with Ctrl+V.');
                    }
                });

                // Skip
                document.getElementById('skipSyllabusBtn')?.addEventListener('click', () => {
                    this.hide();
                    resolve(null);
                });

                // Parse
                document.getElementById('parseSyllabusBtn')?.addEventListener('click', async () => {
                    const content = document.getElementById('syllabusContent').value.trim();
                    if (!content) {
                        this.hide();
                        resolve(null);
                        return;
                    }

                    if (activeTab === 'smart') {
                        const result = SyllabusParser.parse(content);
                        if (result && result.categories.length > 0) {
                            this.hide();
                            resolve(result);
                        } else {
                            this._showToast('Could not detect categories. Try AI Parse or enter manually.');
                        }
                    } else {
                        // AI Parse
                        const parseBtn = document.getElementById('parseSyllabusBtn');
                        parseBtn.innerHTML = 'Parsing...';
                        parseBtn.disabled = true;

                        try {
                            const data = await SyllabusService.parse(content);
                            this.hide();
                            resolve(data);
                        } catch (error) {
                            this._showToast('AI parse failed. Try Smart Parse or enter manually.');
                            parseBtn.innerHTML = 'Analyze with AI';
                            parseBtn.disabled = false;
                        }
                    }
                });
            };

            renderSyllabusModal();
        });
    },

    _showSyllabusPreview(text) {
        const preview = document.getElementById('parsePreviewArea');
        if (!preview || !text.trim()) {
            if (preview) preview.innerHTML = '';
            return;
        }

        const result = SyllabusParser.parse(text);
        if (!result || result.categories.length === 0) {
            preview.innerHTML = '';
            return;
        }

        let html = `<div class="parse-preview"><div class="parse-preview-title">Detected Info</div>`;
        if (result.className) {
            html += `<div class="parse-preview-item"><span>Class</span><span class="parse-preview-value">${result.className}</span></div>`;
        }
        html += `<div class="parse-preview-item"><span>Credits</span><span class="parse-preview-value">${result.creditHours}</span></div>`;
        for (const cat of result.categories) {
            html += `<div class="parse-preview-item"><span>${cat.name}</span><span class="parse-preview-value">${cat.weight}%</span></div>`;
        }
        if (result.gradeScale) {
            html += `<div class="parse-preview-item"><span>Grade Scale</span><span class="parse-preview-value">Custom detected</span></div>`;
        }
        html += '</div>';
        preview.innerHTML = html;
    },

    // Gradebook paste modal - with Smart Parse + AI Parse tabs
    showGradebookPaste() {
        return new Promise((resolve) => {
            let activeTab = 'smart';

            const renderGradebookModal = () => {
                this.show({
                    title: 'Import Grades from Gradebook',
                    size: 'large',
                    content: `
                        <div class="parser-tabs">
                            <button class="parser-tab ${activeTab === 'smart' ? 'active' : ''}" data-tab="smart">Smart Parse</button>
                            <button class="parser-tab ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai">AI Parse</button>
                        </div>
                        <p class="modal-description">
                            ${activeTab === 'smart'
                                ? 'Paste grades from Canvas, Blackboard, or any spreadsheet. Detects CSV, tab-separated, and score formats instantly.'
                                : 'Uses AI to analyze your gradebook. Requires the backend to be running.'
                            }
                        </p>
                        <div class="paste-options">
                            <button class="btn btn-secondary btn-sm" id="pasteGradebookBtn">Paste from clipboard</button>
                        </div>
                        <textarea
                            id="gradebookContent"
                            class="syllabus-textarea"
                            placeholder="Paste your gradebook here...

Example formats:
Homework 1: 85/100
Homework 2: 92/100
Quiz 1: 18/20

Or CSV:
Assignment, Score, Possible
Homework 1, 85, 100"
                            rows="12"
                        ></textarea>
                        <div id="gradebookPreviewArea"></div>
                        <div class="modal-tip">
                            <strong>Tip:</strong> Go to your LMS gradebook, select all (Ctrl+A), copy (Ctrl+C), then paste here.
                        </div>
                    `,
                    footer: `
                        <button class="btn btn-secondary" id="skipGradebookBtn">Skip</button>
                        <button class="btn btn-primary" id="parseGradebookBtn">
                            ${activeTab === 'smart' ? 'Parse & Continue' : 'Analyze with AI'}
                        </button>
                    `
                });

                // Tab switching
                document.querySelectorAll('.parser-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        activeTab = tab.dataset.tab;
                        renderGradebookModal();
                    });
                });

                // Live preview for smart parse
                if (activeTab === 'smart') {
                    const textarea = document.getElementById('gradebookContent');
                    let debounceTimer;
                    textarea?.addEventListener('input', () => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            this._showGradebookPreview(textarea.value);
                        }, 400);
                    });
                }

                // Paste from clipboard
                document.getElementById('pasteGradebookBtn')?.addEventListener('click', async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        document.getElementById('gradebookContent').value = text;
                        if (activeTab === 'smart') {
                            this._showGradebookPreview(text);
                        }
                    } catch (err) {
                        this._showToast('Could not access clipboard. Paste manually with Ctrl+V.');
                    }
                });

                // Skip
                document.getElementById('skipGradebookBtn')?.addEventListener('click', () => {
                    this.hide();
                    resolve(null);
                });

                // Parse
                document.getElementById('parseGradebookBtn')?.addEventListener('click', async () => {
                    const content = document.getElementById('gradebookContent').value.trim();
                    if (!content) {
                        this.hide();
                        resolve(null);
                        return;
                    }

                    if (activeTab === 'smart') {
                        const grades = GradebookParser.parse(content);
                        if (grades.length > 0) {
                            // Wrap in the format the class setup expects
                            this.hide();
                            resolve({
                                categories: [{
                                    name: 'Imported Grades',
                                    weight: 100,
                                    items: grades
                                }]
                            });
                        } else {
                            this._showToast('No grades detected. Try AI Parse or check your format.');
                        }
                    } else {
                        // AI Parse
                        const parseBtn = document.getElementById('parseGradebookBtn');
                        parseBtn.innerHTML = 'Parsing...';
                        parseBtn.disabled = true;

                        try {
                            const data = await GradebookService.parse(content);
                            this.hide();
                            resolve(data);
                        } catch (error) {
                            this._showToast('AI parse failed. Try Smart Parse or enter manually.');
                            parseBtn.innerHTML = 'Analyze with AI';
                            parseBtn.disabled = false;
                        }
                    }
                });
            };

            renderGradebookModal();
        });
    },

    _showGradebookPreview(text) {
        const preview = document.getElementById('gradebookPreviewArea');
        if (!preview || !text.trim()) {
            if (preview) preview.innerHTML = '';
            return;
        }

        const grades = GradebookParser.parse(text);
        if (grades.length === 0) {
            preview.innerHTML = '';
            return;
        }

        let html = `<div class="parse-preview"><div class="parse-preview-title">Found ${grades.length} grade${grades.length !== 1 ? 's' : ''}</div>`;
        for (const g of grades.slice(0, 8)) {
            html += `<div class="parse-preview-item"><span>${g.name}</span><span class="parse-preview-value">${g.pointsEarned !== null ? g.pointsEarned : '\u2014'}/${g.pointsPossible}</span></div>`;
        }
        if (grades.length > 8) {
            html += `<div class="parse-preview-item"><span style="color: var(--color-text-muted);">...and ${grades.length - 8} more</span><span></span></div>`;
        }
        html += '</div>';
        preview.innerHTML = html;
    },

    // Confirmation modal
    confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p class="confirm-message">${message}</p>`,
                footer: `
                    <button class="btn btn-secondary" id="modalCancelBtn">${cancelText}</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modalConfirmBtn">${confirmText}</button>
                `,
                closable: false
            });

            document.getElementById('modalCancelBtn')?.addEventListener('click', () => {
                this.hide();
                resolve(false);
            });

            document.getElementById('modalConfirmBtn')?.addEventListener('click', () => {
                this.hide();
                resolve(true);
            });
        });
    },

    // Alert modal
    alert({ title, message }) {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                footer: `<button class="btn btn-primary" id="modalOkBtn">OK</button>`
            });

            document.getElementById('modalOkBtn')?.addEventListener('click', () => {
                this.hide();
                resolve();
            });
        });
    }
};
