// Modal Component with AI Syllabus Parsing
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
    
    async showSyllabusPaste() {
        return new Promise((resolve) => {
            this.container.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal modal-lg">
                        <div class="modal-header">
                            <h2 class="modal-title">🤖 AI-Powered Class Setup</h2>
                        </div>
                        <div class="modal-body" id="syllabusModalBody">
                            <p style="color: var(--color-gray-300); margin-bottom: var(--spacing-4); font-size: var(--font-size-lg);">
                                Paste your syllabus below and AI will automatically extract your class info, grading categories, and grade scale!
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
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="skipSyllabus">Skip - Enter Manually</button>
                            <button class="btn btn-accent" id="parseSyllabus">✨ Analyze with AI</button>
                        </div>
                    </div>
                </div>
            `;
            this.container.style.display = 'block';
            
            document.getElementById('skipSyllabus').addEventListener('click', () => {
                this.hide();
                resolve(null);
            });
            
            document.getElementById('parseSyllabus').addEventListener('click', async () => {
                const text = document.getElementById('syllabusText').value.trim();
                
                if (!text) {
                    alert('Please paste your syllabus text first!');
                    return;
                }
                
                // Show loading state
                document.getElementById('syllabusModalBody').innerHTML = `
                    <div class="ai-processing">
                        <div class="loading-spinner"></div>
                        <p>🤖 AI is analyzing your syllabus...</p>
                        <p style="color: var(--color-gray-500); font-size: var(--font-size-sm); margin-top: var(--spacing-2);">This may take a few seconds</p>
                    </div>
                `;
                
                // Hide buttons during processing
                document.querySelector('.modal-footer').style.display = 'none';
                
                try {
                    const result = await SyllabusService.parse(text);
                    this.hide();
                    resolve(result);
                } catch (error) {
                    console.error('Failed to parse syllabus:', error);
                    
                    // Show error state with retry option
                    document.getElementById('syllabusModalBody').innerHTML = `
                        <div style="text-align: center; padding: var(--spacing-6);">
                            <p style="color: var(--color-danger); font-size: var(--font-size-xl); margin-bottom: var(--spacing-4);">❌ Failed to analyze syllabus</p>
                            <p style="color: var(--color-gray-400); margin-bottom: var(--spacing-6);">
                                ${error.message || 'Please check your API key in appsettings.json or try again.'}
                            </p>
                        </div>
                    `;
                    document.querySelector('.modal-footer').style.display = 'flex';
                    document.querySelector('.modal-footer').innerHTML = `
                        <button class="btn btn-secondary" id="skipAfterError">Enter Manually Instead</button>
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
            });
        });
    }
};
