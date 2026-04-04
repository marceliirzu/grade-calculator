// Category Card Component
const CategoryCard = {
    render(category) {
        const grade = category.currentGrade !== null ? Formatters.percentage(category.currentGrade) : '\u2014';
        const itemCount = category.gradeItems?.length || 0;

        return `
            <div class="category-card" data-category-id="${category.id}">
                <div class="category-header">
                    <h3 class="category-name">${category.name}</h3>
                    <span class="category-weight">${category.weight}%</span>
                </div>
                <div class="category-body">
                    <div class="category-grade">${grade}</div>
                    <div class="category-items">${itemCount} grade${itemCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="category-footer">
                    <span class="click-hint">Manage grades \u2192</span>
                </div>
            </div>
        `;
    }
};
