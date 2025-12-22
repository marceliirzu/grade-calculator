// Modal Component
const Modal = {
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
    
    // Syllabus paste modal
    showSyllabusPaste() {
        return new Promise((resolve) => {
            this.show({
                title: '📄 Add Class from Syllabus',
                content: `
                    <div class="syllabus-paste-modal">
                        <p class="modal-description">
                            Paste your syllabus text below and our AI will automatically extract 
                            the grading breakdown, categories, and weights.
                        </p>
                        <div class="paste-options">
                            <button class="btn btn-secondary" id="pasteSyllabusBtn">
                                📋 Paste from Clipboard
                            </button>
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
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" id="skipSyllabusBtn">Skip - I'll enter manually</button>
                    <button class="btn btn-primary" id="parseSyllabusBtn">
                        ✨ Parse with AI
                    </button>
                `
            });

            // Paste from clipboard
            document.getElementById('pasteSyllabusBtn')?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    document.getElementById('syllabusContent').value = text;
                } catch (err) {
                    alert('Could not access clipboard. Please paste manually (Ctrl+V).');
                }
            });

            // Skip button
            document.getElementById('skipSyllabusBtn')?.addEventListener('click', () => {
                this.hide();
                resolve(null);
            });

            // Parse button
            document.getElementById('parseSyllabusBtn')?.addEventListener('click', async () => {
                const content = document.getElementById('syllabusContent').value.trim();
                
                if (!content) {
                    this.hide();
                    resolve(null);
                    return;
                }

                const parseBtn = document.getElementById('parseSyllabusBtn');
                const originalText = parseBtn.innerHTML;
                parseBtn.innerHTML = '⏳ Parsing...';
                parseBtn.disabled = true;

                try {
                    const data = await SyllabusService.parse(content);
                    this.hide();
                    resolve(data);
                } catch (error) {
                    alert('Failed to parse syllabus. Please try again or enter manually.');
                    parseBtn.innerHTML = originalText;
                    parseBtn.disabled = false;
                }
            });
        });
    },
    
    // Gradebook paste modal
    showGradebookPaste() {
        return new Promise((resolve) => {
            this.show({
                title: '📊 Import Grades from Gradebook',
                content: `
                    <div class="syllabus-paste-modal">
                        <p class="modal-description">
                            Paste your gradebook data from Canvas, Blackboard, or any LMS. 
                            Our AI will automatically extract your assignments and grades.
                        </p>
                        <div class="paste-options">
                            <button class="btn btn-secondary" id="pasteGradebookBtn">
                                📋 Paste from Clipboard
                            </button>
                        </div>
                        <textarea 
                            id="gradebookContent" 
                            class="syllabus-textarea"
                            placeholder="Paste your gradebook here...

Example formats that work:
- Canvas gradebook (copy the grades table)
- Blackboard grades
- Any text with assignment names and scores

Example:
Homework 1          95/100
Homework 2          88/100
Quiz 1              18/20
Quiz 2              19/20
Midterm Exam        82/100
Lab Report 1        45/50"
                            rows="12"
                        ></textarea>
                        <div class="modal-tip">
                            <strong>💡 Tip:</strong> Go to your LMS gradebook, select all the grades (Ctrl+A), copy (Ctrl+C), then paste here.
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" id="skipGradebookBtn">Skip - I'll enter grades later</button>
                    <button class="btn btn-primary" id="parseGradebookBtn">
                        ✨ Parse with AI
                    </button>
                `
            });

            // Paste from clipboard
            document.getElementById('pasteGradebookBtn')?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    document.getElementById('gradebookContent').value = text;
                } catch (err) {
                    alert('Could not access clipboard. Please paste manually (Ctrl+V).');
                }
            });

            // Skip button
            document.getElementById('skipGradebookBtn')?.addEventListener('click', () => {
                this.hide();
                resolve(null);
            });

            // Parse button
            document.getElementById('parseGradebookBtn')?.addEventListener('click', async () => {
                const content = document.getElementById('gradebookContent').value.trim();
                
                if (!content) {
                    this.hide();
                    resolve(null);
                    return;
                }

                const parseBtn = document.getElementById('parseGradebookBtn');
                const originalText = parseBtn.innerHTML;
                parseBtn.innerHTML = '⏳ Parsing...';
                parseBtn.disabled = true;

                try {
                    const data = await GradebookService.parse(content);
                    this.hide();
                    resolve(data);
                } catch (error) {
                    alert('Failed to parse gradebook. Please try again or enter grades manually.');
                    parseBtn.innerHTML = originalText;
                    parseBtn.disabled = false;
                }
            });
        });
    },
    
    // Confirmation modal
    confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
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
