// Class Card Component
const ClassCard = {
    render(classData) {
        const letterGrade = classData.letterGrade || '—';
        const percentage = classData.currentGrade !== null ? Formatters.percentage(classData.currentGrade) : '—';
        const colorClass = Formatters.gradeColorClass(letterGrade);
        
        return `
            <div class="card class-card" data-class-id="${classData.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${classData.name}</h3>
                        <p class="card-subtitle">${classData.creditHours} credit hour${classData.creditHours !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <div class="grade-display">
                    <span class="letter-grade ${colorClass}">${letterGrade}</span>
                    <span class="percentage">${percentage}</span>
                </div>
            </div>
        `;
    },
    
    renderAddButton() {
        return `
            <button class="btn-add" id="addClassBtn">
                <span class="plus-icon">+</span>
                <span>Add Class</span>
            </button>
        `;
    }
};
