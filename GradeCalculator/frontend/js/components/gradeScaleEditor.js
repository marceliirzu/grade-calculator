// Grade Scale Editor Component
const GradeScaleEditor = {
    render(gradeScale, onChange) {
        const scale = gradeScale || CONFIG.DEFAULT_GRADE_SCALE;
        
        return `
            <div class="grade-scale-editor">
                <div class="grade-scale-header">
                    <h3 class="grade-scale-title">Grade Scale</h3>
                </div>
                <table class="grade-scale-table">
                    <thead>
                        <tr>
                            <th>Grade</th>
                            <th>Min %</th>
                            <th>GPA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderRow('A+', 'aPlus', scale.aPlus, 4.0)}
                        ${this.renderRow('A', 'a', scale.a, 4.0)}
                        ${this.renderRow('A-', 'aMinus', scale.aMinus, 3.7)}
                        ${this.renderRow('B+', 'bPlus', scale.bPlus, 3.3)}
                        ${this.renderRow('B', 'b', scale.b, 3.0)}
                        ${this.renderRow('B-', 'bMinus', scale.bMinus, 2.7)}
                        ${this.renderRow('C+', 'cPlus', scale.cPlus, 2.3)}
                        ${this.renderRow('C', 'c', scale.c, 2.0)}
                        ${this.renderRow('C-', 'cMinus', scale.cMinus, 1.7)}
                        ${this.renderRow('D+', 'dPlus', scale.dPlus, 1.3)}
                        ${this.renderRow('D', 'd', scale.d, 1.0)}
                        ${this.renderRow('D-', 'dMinus', scale.dMinus, 0.7)}
                        <tr>
                            <td class="grade-letter grade-f">F</td>
                            <td>&lt; ${scale.dMinus}%</td>
                            <td class="gpa-points">0.0</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },
    
    renderRow(letter, key, value, gpa) {
        const colorClass = Formatters.gradeColorClass(letter);
        return `
            <tr>
                <td class="grade-letter ${colorClass}">${letter}</td>
                <td>
                    <input type="number" class="grade-input" 
                           data-grade="${key}" 
                           value="${value}" 
                           min="0" max="100" step="0.1">
                </td>
                <td class="gpa-points">${gpa.toFixed(1)}</td>
            </tr>
        `;
    },
    
    getValues(container) {
        const inputs = container.querySelectorAll('.grade-input');
        const scale = {};
        inputs.forEach(input => {
            scale[input.dataset.grade] = parseFloat(input.value);
        });
        return scale;
    }
};
