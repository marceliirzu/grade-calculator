// Grade Entry Component
const GradeEntry = {
    render(gradeItem) {
        const percentage = gradeItem.percentage !== null ? Formatters.percentage(gradeItem.percentage) : '—';
        const whatIfClass = gradeItem.isWhatIf ? 'what-if' : '';
        
        return `
            <div class="grade-item ${whatIfClass}" data-grade-id="${gradeItem.id}">
                <div class="grade-item-name">
                    ${gradeItem.name}
                    ${gradeItem.isWhatIf ? '<span class="what-if-badge">What If</span>' : ''}
                </div>
                <div class="grade-item-input">
                    <input type="number" class="earned-input" 
                           value="${gradeItem.pointsEarned ?? ''}" 
                           placeholder="—"
                           step="0.1">
                    <span>/</span>
                </div>
                <div class="grade-item-input">
                    <input type="number" class="possible-input" 
                           value="${gradeItem.pointsPossible}" 
                           step="0.1">
                </div>
                <div class="grade-item-percentage">${percentage}</div>
                <div class="grade-item-actions">
                    <button class="btn btn-ghost btn-icon what-if-btn" title="Toggle What-If">🔮</button>
                    <button class="btn btn-ghost btn-icon delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    },
    
    renderEmpty() {
        return `
            <div class="empty-grades">
                <p>No grades yet. Click "Add Grade" to get started.</p>
            </div>
        `;
    }
};
