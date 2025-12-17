// GPA Display Component
const GpaDisplay = {
    render(classes) {
        const overallGpa = ClassService.calculateOverallGpa(classes);
        const totalCredits = classes.reduce((sum, c) => sum + (c.gpa !== null ? c.creditHours : 0), 0);
        
        return `
            <div class="gpa-card">
                <div class="gpa-card-title">OVERALL GPA</div>
                <div class="gpa-value">
                    ${overallGpa !== null ? Formatters.gpa(overallGpa) : '—'}
                    <span class="gpa-scale">/ 4.0</span>
                </div>
                
                <div class="gpa-details">
                    <div class="gpa-detail-row">
                        <span>Total Credits</span>
                        <span>${totalCredits}</span>
                    </div>
                    <div class="gpa-detail-row">
                        <span>Classes</span>
                        <span>${classes.length}</span>
                    </div>
                </div>
                
                ${classes.length > 0 ? this.renderClassList(classes) : ''}
            </div>
        `;
    },
    
    renderClassList(classes) {
        const items = classes.map(c => {
            const colorClass = Formatters.gradeColorClass(c.letterGrade);
            const gpa = c.gpa !== null ? Formatters.gpa(c.gpa) : '—';
            
            return `
                <div class="class-summary-item">
                    <span class="class-summary-name">${Formatters.truncate(c.name, 20)}</span>
                    <span class="class-summary-grade ${colorClass}">${c.letterGrade || '—'}</span>
                </div>
            `;
        }).join('');
        
        return `<div class="class-summary-list">${items}</div>`;
    }
};
