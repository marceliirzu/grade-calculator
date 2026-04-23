// Semester List Page - Shows all semesters, GPA summary, and allows creating/editing semesters
function _escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function _gpaToLetter(gpa) {
    if (gpa >= 3.67) return 'A';
    if (gpa >= 3.33) return 'A-';
    if (gpa >= 3.0)  return 'B+';
    if (gpa >= 2.67) return 'B';
    if (gpa >= 2.33) return 'B-';
    if (gpa >= 2.0)  return 'C+';
    if (gpa >= 1.67) return 'C';
    if (gpa >= 1.0)  return 'D';
    return 'F';
}

const SemesterListPage = {
    semesters: [],

    async init() {
        if (!AuthService.isLoggedIn()) {
            App.navigate('landing');
            return;
        }

        // Show loading skeleton
        document.getElementById('mainContent').innerHTML = `
            <div class="semester-list-page">
                <div class="page-header">
                    <h1>My Semesters</h1>
                    <button class="btn btn-primary" id="addSemesterBtn">+ New Semester</button>
                </div>
                <div class="semesters-grid">
                    ${[1,2].map(() => `<div class="card skeleton-card" style="height:160px;animation:shimmer 1.5s infinite;background-image:linear-gradient(90deg,var(--color-bg-card) 0%,var(--color-bg-elevated) 50%,var(--color-bg-card) 100%);background-size:200% 100%;"></div>`).join('')}
                </div>
            </div>`;
        document.getElementById('addSemesterBtn')?.addEventListener('click', () => this.showAddModal());

        await this.loadSemesters();
        this.render();
        this.bindEvents();
    },

    async loadSemesters() {
        try {
            this.semesters = await SemesterService.getAll();
        } catch (e) {
            console.error('Failed to load semesters:', e);
            this.semesters = [];
        }
    },

    render() {
        const currentId = SemesterService.getCurrentSemesterId();
        // Cumulative GPA: show from most recent semester that has it
        const semWithCumulative = this.semesters.find(s => s.cumulativeGpa != null);
        const cumulativeGpa = semWithCumulative?.cumulativeGpa;

        document.getElementById('mainContent').innerHTML = `
            <div class="semester-list-page">
                <div class="page-header">
                    <h1>My Semesters</h1>
                    <button class="btn btn-primary" id="addSemesterBtn">+ New Semester</button>
                </div>

                ${cumulativeGpa != null ? `
                <div class="cumulative-gpa-banner">
                    <span class="cumulative-label">Cumulative GPA</span>
                    <span class="cumulative-value ${Formatters.gradeColorClass(_gpaToLetter(cumulativeGpa))}">${cumulativeGpa.toFixed(2)}</span>
                </div>` : ''}

                <div class="semesters-grid" id="semestersGrid">
                    ${this.semesters.length === 0 ? this.renderEmpty() : this.semesters.map(s => this.renderSemesterCard(s, s.id === currentId)).join('')}
                </div>
            </div>`;
    },

    renderEmpty() {
        return `
            <div class="empty-state" style="grid-column:1/-1">
                <h3 class="empty-state-title">No semesters yet</h3>
                <p class="empty-state-text">Create your first semester to start tracking your GPA.</p>
                <button class="btn btn-primary btn-lg" id="emptyAddBtn">Create Semester</button>
            </div>`;
    },

    renderSemesterCard(s, isCurrent) {
        const gpaText = s.semesterGpa != null ? s.semesterGpa.toFixed(2) : '—';
        const goalBar = s.gpaGoal != null && s.gpaGoalProgress != null ? `
            <div class="goal-bar-wrap">
                <div class="goal-bar-track">
                    <div class="goal-bar-fill" style="width:${Math.min(100, s.gpaGoalProgress * 100).toFixed(0)}%"></div>
                </div>
                <span class="goal-label">Goal: ${s.gpaGoal.toFixed(2)}</span>
            </div>` : '';

        return `
            <div class="semester-card ${isCurrent ? 'semester-card--active' : ''}" data-semester-id="${s.id}">
                <div class="semester-card-header">
                    <div>
                        <h3 class="semester-name">${_escHtml(s.name)}</h3>
                        <span class="semester-meta">${_escHtml(s.term)} ${s.year} · ${s.classCount} class${s.classCount !== 1 ? 'es' : ''}</span>
                    </div>
                    <div class="semester-gpa ${s.semesterGpa != null ? Formatters.gradeColorClass(_gpaToLetter(s.semesterGpa)) : ''}">${gpaText}</div>
                </div>
                ${goalBar}
                <div class="semester-card-actions">
                    <button class="btn btn-secondary btn-sm edit-semester-btn" data-id="${s.id}">Edit</button>
                    <button class="btn btn-danger btn-sm delete-semester-btn" data-id="${s.id}">Delete</button>
                    <button class="btn btn-primary btn-sm select-semester-btn" data-id="${s.id}">
                        ${isCurrent ? 'Selected' : 'View Classes'}
                    </button>
                </div>
            </div>`;
    },

    bindEvents() {
        document.getElementById('addSemesterBtn')?.addEventListener('click', () => this.showAddModal());
        document.getElementById('emptyAddBtn')?.addEventListener('click', () => this.showAddModal());

        document.querySelectorAll('.edit-semester-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const s = this.semesters.find(x => x.id === id);
                if (s) this.showEditModal(s);
            });
        });

        document.querySelectorAll('.delete-semester-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const s = this.semesters.find(x => x.id === id);
                if (!s) return;
                const confirmed = await Modal.confirm({
                    title: 'Delete Semester',
                    message: `Delete "${_escHtml(s.name)}"? All classes and grades will be permanently deleted.`,
                    confirmText: 'Delete',
                    danger: true
                });
                if (confirmed) {
                    try {
                        await SemesterService.delete(id);
                        if (SemesterService.getCurrentSemesterId() === id) SemesterService.setCurrentSemesterId(null);
                        await this.loadSemesters();
                        this.render();
                        this.bindEvents();
                    } catch (err) {
                        Modal._showToast('Failed to delete semester');
                    }
                }
            });
        });

        document.querySelectorAll('.select-semester-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                SemesterService.setCurrentSemesterId(id);
                App.navigate('landing', { semesterId: id });
            });
        });
    },

    showAddModal() {
        const currentYear = new Date().getFullYear();
        Modal.show({
            title: 'New Semester',
            content: `
                <div class="form-group">
                    <label class="form-label">Semester Name</label>
                    <input type="text" class="form-input" id="semName" placeholder="e.g., Fall 2025" value="Fall ${currentYear}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Term</label>
                        <select class="form-input" id="semTerm">
                            <option value="Fall">Fall</option>
                            <option value="Spring">Spring</option>
                            <option value="Summer">Summer</option>
                            <option value="Winter">Winter</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Year</label>
                        <input type="number" class="form-input" id="semYear" value="${currentYear}" min="2000" max="2100">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">GPA Goal <span class="form-label-hint">(optional)</span></label>
                    <input type="number" class="form-input" id="semGoal" placeholder="e.g., 3.5" min="0" max="4.33" step="0.01">
                </div>`,
            footer: `
                <button class="btn btn-secondary" id="cancelSem">Cancel</button>
                <button class="btn btn-primary" id="confirmSem">Create</button>`
        });

        document.getElementById('cancelSem')?.addEventListener('click', () => Modal.hide());
        document.getElementById('confirmSem')?.addEventListener('click', async () => {
            const name = document.getElementById('semName').value.trim();
            const term = document.getElementById('semTerm').value;
            const year = parseInt(document.getElementById('semYear').value);
            const goalVal = document.getElementById('semGoal').value;
            const gpaGoal = goalVal ? parseFloat(goalVal) : null;

            if (!name) { Modal._showToast('Please enter a semester name'); return; }
            if (isNaN(year) || year < 2000 || year > 2100) { Modal._showToast('Invalid year'); return; }

            try {
                const sem = await SemesterService.create({ name, year, term, gpaGoal });
                Modal.hide();
                SemesterService.setCurrentSemesterId(sem.id);
                await this.loadSemesters();
                this.render();
                this.bindEvents();
            } catch (err) {
                Modal._showToast('Failed to create semester');
            }
        });
    },

    showEditModal(s) {
        Modal.show({
            title: 'Edit Semester',
            content: `
                <div class="form-group">
                    <label class="form-label">Semester Name</label>
                    <input type="text" class="form-input" id="editSemName" value="${_escHtml(s.name)}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Term</label>
                        <select class="form-input" id="editSemTerm">
                            ${['Fall','Spring','Summer','Winter'].map(t => `<option value="${t}" ${s.term === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Year</label>
                        <input type="number" class="form-input" id="editSemYear" value="${s.year}" min="2000" max="2100">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">GPA Goal <span class="form-label-hint">(optional)</span></label>
                    <input type="number" class="form-input" id="editSemGoal" value="${s.gpaGoal ?? ''}" placeholder="e.g., 3.5" min="0" max="4.33" step="0.01">
                </div>`,
            footer: `
                <button class="btn btn-secondary" id="cancelEditSem">Cancel</button>
                <button class="btn btn-primary" id="confirmEditSem">Save</button>`
        });

        document.getElementById('cancelEditSem')?.addEventListener('click', () => Modal.hide());
        document.getElementById('confirmEditSem')?.addEventListener('click', async () => {
            const name = document.getElementById('editSemName').value.trim();
            const term = document.getElementById('editSemTerm').value;
            const year = parseInt(document.getElementById('editSemYear').value);
            const goalVal = document.getElementById('editSemGoal').value;
            const gpaGoal = goalVal ? parseFloat(goalVal) : null;

            if (!name) { Modal._showToast('Please enter a semester name'); return; }

            try {
                await SemesterService.update(s.id, { name, year, term, gpaGoal });
                Modal.hide();
                await this.loadSemesters();
                this.render();
                this.bindEvents();
            } catch (err) {
                Modal._showToast('Failed to update semester');
            }
        });
    }
};
