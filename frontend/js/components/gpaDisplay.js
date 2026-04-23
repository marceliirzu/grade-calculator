function _gpaToLetter(gpa) {
    if (gpa == null) return '—';
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

function _escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// GPA Display Component
const GpaDisplay = {
    render(classes, semester = null) {
        const overallGpa = ClassService.calculateOverallGpa(classes);
        const totalCredits = classes.reduce((sum, c) => sum + (c.gpa !== null ? c.creditHours : 0), 0);

        return `
            <div class="gpa-card">
                <div class="gpa-card-title">Overall GPA</div>
                <div class="gpa-value">
                    ${overallGpa !== null ? Formatters.gpa(overallGpa) : '\u2014'}
                    <span class="gpa-scale">/ ${CONFIG.A_PLUS_VALUE === 4.33 ? '4.33' : '4.0'}</span>
                </div>

                <div class="gpa-details">
                    <div class="gpa-detail-row">
                        <span>Credits</span>
                        <span>${totalCredits}</span>
                    </div>
                    <div class="gpa-detail-row">
                        <span>Classes</span>
                        <span>${classes.length}</span>
                    </div>
                </div>

                ${semester ? this.renderSemesterSection(semester) : ''}

                ${classes.length > 0 ? this.renderClassList(classes) : ''}
            </div>
        `;
    },

    renderSemesterSection(semester) {
        const rows = [];

        if (semester.semesterGpa != null) {
            const letter = typeof Formatters.gpaToLetter === 'function'
                ? Formatters.gpaToLetter(semester.semesterGpa)
                : _gpaToLetter(semester.semesterGpa);
            rows.push(`
                <div class="gpa-detail-row">
                    <span>Semester GPA</span>
                    <span>${_escHtml(Formatters.gpa(semester.semesterGpa))} <small>(${_escHtml(letter)})</small></span>
                </div>
            `);
        }

        if (semester.cumulativeGpa != null) {
            const letter = typeof Formatters.gpaToLetter === 'function'
                ? Formatters.gpaToLetter(semester.cumulativeGpa)
                : _gpaToLetter(semester.cumulativeGpa);
            rows.push(`
                <div class="gpa-detail-row">
                    <span>Cumulative GPA</span>
                    <span>${_escHtml(Formatters.gpa(semester.cumulativeGpa))} <small>(${_escHtml(letter)})</small></span>
                </div>
            `);
        }

        const goalBar = (semester.gpaGoal != null) ? this.renderGoalBar(semester) : '';

        if (rows.length === 0 && !goalBar) return '';

        return `
            <div class="gpa-semester-section">
                <div class="gpa-details">
                    ${rows.join('')}
                </div>
                ${goalBar}
            </div>
        `;
    },

    renderGoalBar(semester) {
        const progress   = Math.min(1, Math.max(0, semester.gpaGoalProgress != null ? semester.gpaGoalProgress : 0));
        const pct        = (progress * 100).toFixed(1);
        const colorClass = progress >= 0.9 ? 'gpa-goal-green'
                         : progress >= 0.7 ? 'gpa-goal-yellow'
                         :                   'gpa-goal-red';
        const goalLabel  = _escHtml(Formatters.gpa(semester.gpaGoal));

        return `
            <div class="gpa-goal-bar-wrapper">
                <div class="gpa-goal-label">Goal: ${goalLabel}</div>
                <div class="gpa-goal-track">
                    <div class="gpa-goal-fill ${_escHtml(colorClass)}" style="width:${pct}%"></div>
                </div>
                <div class="gpa-goal-pct">${pct}%</div>
            </div>
        `;
    },

    renderClassList(classes) {
        const items = classes.map(c => {
            const colorClass = Formatters.gradeColorClass(c.letterGrade);
            return `
                <div class="class-summary-item">
                    <span class="class-summary-name">${_escHtml(Formatters.truncate(c.name, 22))}</span>
                    <span class="class-summary-grade ${colorClass}">${c.letterGrade || '\u2014'}</span>
                </div>
            `;
        }).join('');

        return `<div class="class-summary-list">${items}</div>`;
    }
};
