function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function _gpaToLetter(gpa) {
    if (gpa == null) return '—';
    if (gpa >= 3.67) return 'A';
    if (gpa >= 3.33) return 'A-';
    if (gpa >= 3.0) return 'B+';
    if (gpa >= 2.67) return 'B';
    if (gpa >= 2.33) return 'B-';
    if (gpa >= 2.0) return 'C+';
    if (gpa >= 1.67) return 'C';
    if (gpa >= 1.0) return 'D';
    return 'F';
}

function _gpaColorClass(gpa) {
    if (gpa == null) return '';
    if (gpa >= 3.67) return 'grade-a';
    if (gpa >= 2.67) return 'grade-b';
    if (gpa >= 1.67) return 'grade-c';
    if (gpa >= 1.0) return 'grade-d';
    return 'grade-f';
}

const SemesterHistoryPage = {
    semesters: [],

    async init() {
        if (!AuthService.isLoggedIn()) { App.navigate('landing'); return; }

        document.getElementById('mainContent').innerHTML = `
            <div class="semester-history-page">
                <nav class="breadcrumb"><a href="#" id="backToSemesters">← Semesters</a></nav>
                <h1>GPA History</h1>
                <div style="height:200px;animation:shimmer 1.5s infinite;background-image:linear-gradient(90deg,var(--color-bg-card) 0%,var(--color-bg-elevated) 50%,var(--color-bg-card) 100%);background-size:200% 100%;border-radius:12px;"></div>
            </div>`;
        document.getElementById('backToSemesters')?.addEventListener('click', e => { e.preventDefault(); App.navigate('semesterList'); });

        try {
            this.semesters = await SemesterService.getAll();
        } catch (e) {
            this.semesters = [];
        }
        this.render();
        this.bindEvents();
    },

    render() {
        const sorted = [...this.semesters].sort((a, b) => a.year !== b.year ? a.year - b.year : (a.term.charCodeAt(0) - b.term.charCodeAt(0)));
        const withGpa = sorted.filter(s => s.semesterGpa != null);
        const cumulative = this.semesters.find(s => s.cumulativeGpa != null)?.cumulativeGpa;

        const maxGpa = 4.33;
        const chartWidth = 100 / Math.max(withGpa.length, 1);

        document.getElementById('mainContent').innerHTML = `
            <div class="semester-history-page">
                <nav class="breadcrumb"><a href="#" id="backToSemesters">← Semesters</a></nav>
                <h1>GPA History</h1>

                ${cumulative != null ? `
                <div class="history-summary-card">
                    <div class="history-stat">
                        <span class="history-stat-label">Cumulative GPA</span>
                        <span class="history-stat-value ${_gpaColorClass(cumulative)}">${cumulative.toFixed(2)}</span>
                    </div>
                    <div class="history-stat">
                        <span class="history-stat-label">Semesters Tracked</span>
                        <span class="history-stat-value">${this.semesters.length}</span>
                    </div>
                    <div class="history-stat">
                        <span class="history-stat-label">Best Semester</span>
                        <span class="history-stat-value ${_gpaColorClass(Math.max(...withGpa.map(s=>s.semesterGpa)))}">
                            ${withGpa.length > 0 ? Math.max(...withGpa.map(s=>s.semesterGpa)).toFixed(2) : '—'}
                        </span>
                    </div>
                </div>` : ''}

                ${withGpa.length > 0 ? `
                <div class="history-chart-card">
                    <h2 class="history-chart-title">Semester GPA Trend</h2>
                    <div class="history-chart">
                        ${withGpa.map((s, i) => {
                            const pct = (s.semesterGpa / maxGpa) * 100;
                            return `
                            <div class="history-bar-group" style="width:${chartWidth}%">
                                <div class="history-bar-wrap">
                                    <div class="history-bar-value">${s.semesterGpa.toFixed(2)}</div>
                                    <div class="history-bar ${_gpaColorClass(s.semesterGpa)}" style="height:${pct.toFixed(0)}%"></div>
                                </div>
                                <div class="history-bar-label">${_escHtml(s.term.substring(0,2))} '${String(s.year).slice(-2)}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                <div class="history-table-card">
                    <h2>All Semesters</h2>
                    <div class="history-table">
                        <div class="history-table-header">
                            <span>Semester</span>
                            <span>Classes</span>
                            <span>GPA</span>
                            <span>Goal</span>
                            <span></span>
                        </div>
                        ${sorted.length === 0 ? '<div class="history-empty">No semesters yet.</div>' :
                            sorted.map(s => `
                            <div class="history-table-row" data-semester-id="${s.id}">
                                <span class="history-sem-name">${_escHtml(s.name)}</span>
                                <span class="history-classes">${s.classCount} class${s.classCount !== 1 ? 'es' : ''}</span>
                                <span class="history-gpa ${_gpaColorClass(s.semesterGpa)}">${s.semesterGpa != null ? s.semesterGpa.toFixed(2) : '—'}</span>
                                <span class="history-goal">${s.gpaGoal != null ? s.gpaGoal.toFixed(2) : '—'}</span>
                                <span><button class="btn btn-secondary btn-sm view-sem-btn" data-id="${s.id}">View</button></span>
                            </div>`).join('')
                        }
                    </div>
                </div>
            </div>`;
    },

    bindEvents() {
        document.getElementById('backToSemesters')?.addEventListener('click', e => { e.preventDefault(); App.navigate('semesterList'); });
        document.querySelectorAll('.view-sem-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                SemesterService.setCurrentSemesterId(id);
                App.navigate('landing', { semesterId: id });
            });
        });
    }
};
