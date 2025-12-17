// Category Card Component
const CategoryCard = {
    render(category) {
        const grade = category.currentGrade !== null ? Formatters.percentage(category.currentGrade) : '—';
        
        return `
            <div class="category-card" data-category-id="${category.id}">
                <div class="category-header">
                    <span class="category-name">${category.name}</span>
                    <span class="category-weight">${category.weight}%</span>
                </div>
                <div class="category-grade">
                    Current: <strong>${grade}</strong>
                </div>
                <div class="category-items-count">
                    ${category.gradeItems?.length || 0} items
                </div>
            </div>
        `;
    }
};
