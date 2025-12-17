// Class Detail Page - Shows categories for a class
const ClassDetailPage = {
    classData: null,
    
    async init(params = {}) {
        const { classId } = params;
        
        if (!classId) {
            App.navigate('landing');
            return;
        }
        
        try {
            this.classData = await ClassService.getById(classId);
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load class:', error);
            alert('Failed to load class');
            App.navigate('landing');
        }
    },
    
    render() {
        const mainContent = document.getElementById('mainContent');
        const currentGrade = this.classData.currentGrade;
        const letterGrade = this.classData.letterGrade || '—';
        const colorClass = Formatters.gradeColorClass(letterGrade);
        
        mainContent.innerHTML = `
            <div class="class-detail-page">
                <nav class="breadcrumb">
                    <a href="#" id="backToLanding">← My Classes</a>
                </nav>
                
                <header class="class-detail-header">
                    <div class="class-info">
                        <h1>${this.classData.name}</h1>
                        <p class="class-meta">${this.classData.creditHours} credit hours</p>
                    </div>
                    <div class="class-grade-summary">
                        <div class="current-grade ${colorClass}">
                            <span class="letter">${letterGrade}</span>
                            <span class="percentage">${currentGrade !== null ? Formatters.percentage(currentGrade) : '—'}</span>
                        </div>
                    </div>
                </header>
                
                <section class="categories-section">
                    <div class="section-header">
                        <h2>Grade Categories</h2>
                        <button class="btn btn-secondary btn-sm" id="addCategoryBtn">+ Add Category</button>
                    </div>
                    
                    <div class="categories-grid" id="categoriesGrid">
                        ${this.renderCategories()}
                    </div>
                </section>
                
                <section class="class-actions">
                    <button class="btn btn-secondary" id="editClassBtn">Edit Class Settings</button>
                    <button class="btn btn-danger" id="deleteClassBtn">Delete Class</button>
                </section>
            </div>
        `;
    },
    
    renderCategories() {
        const categories = this.classData.categories || [];
        
        if (categories.length === 0) {
            return `
                <div class="empty-categories">
                    <p>No categories yet. Add categories like "Assignments", "Exams", etc.</p>
                </div>
            `;
        }
        
        return categories.map(cat => {
            const grade = cat.currentGrade !== null ? Formatters.percentage(cat.currentGrade) : '—';
            const itemCount = cat.gradeItems?.length || 0;
            
            return `
                <div class="category-card" data-category-id="${cat.id}">
                    <div class="category-header">
                        <h3 class="category-name">${cat.name}</h3>
                        <span class="category-weight">${cat.weight}%</span>
                    </div>
                    <div class="category-body">
                        <div class="category-grade">${grade}</div>
                        <div class="category-items">${itemCount} grade${itemCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="category-footer">
                        <span class="click-hint">Click to manage grades →</span>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    bindEvents() {
        // Back to landing
        document.getElementById('backToLanding')?.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate('landing');
        });
        
        // Category clicks - go to category editor
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const categoryId = card.dataset.categoryId;
                App.navigate('category', { 
                    classId: this.classData.id, 
                    categoryId: categoryId 
                });
            });
        });
        
        // Add category
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
            this.showAddCategoryModal();
        });
        
        // Edit class
        document.getElementById('editClassBtn')?.addEventListener('click', () => {
            this.showEditClassModal();
        });
        
        // Delete class
        document.getElementById('deleteClassBtn')?.addEventListener('click', () => {
            this.deleteClass();
        });
    },
    
    async showAddCategoryModal() {
        Modal.show({
            title: 'Add Category',
            content: `
                <div class="form-group">
                    <label class="form-label">Category Name</label>
                    <input type="text" class="form-input" id="categoryName" placeholder="e.g., Homework, Exams">
                </div>
                <div class="form-group">
                    <label class="form-label">Weight (%)</label>
                    <input type="number" class="form-input" id="categoryWeight" value="20" min="0" max="100">
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" id="cancelAddCategory">Cancel</button>
                <button class="btn btn-primary" id="confirmAddCategory">Add Category</button>
            `
        });
        
        document.getElementById('cancelAddCategory').addEventListener('click', () => Modal.hide());
        document.getElementById('confirmAddCategory').addEventListener('click', async () => {
            const name = document.getElementById('categoryName').value.trim();
            const weight = parseFloat(document.getElementById('categoryWeight').value);
            
            if (!name) {
                alert('Please enter a category name');
                return;
            }
            
            try {
                await CategoryService.create({
                    classId: this.classData.id,
                    name: name,
                    weight: weight
                });
                Modal.hide();
                // Refresh the page
                await this.init({ classId: this.classData.id });
            } catch (error) {
                console.error('Failed to add category:', error);
                alert('Failed to add category');
            }
        });
    },
    
    async showEditClassModal() {
        Modal.show({
            title: 'Edit Class',
            content: `
                <div class="form-group">
                    <label class="form-label">Class Name</label>
                    <input type="text" class="form-input" id="editClassName" value="${this.classData.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Credit Hours</label>
                    <input type="number" class="form-input" id="editCreditHours" value="${this.classData.creditHours}" min="0.5" max="10" step="0.5">
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" id="cancelEditClass">Cancel</button>
                <button class="btn btn-primary" id="confirmEditClass">Save Changes</button>
            `
        });
        
        document.getElementById('cancelEditClass').addEventListener('click', () => Modal.hide());
        document.getElementById('confirmEditClass').addEventListener('click', async () => {
            const name = document.getElementById('editClassName').value.trim();
            const creditHours = parseFloat(document.getElementById('editCreditHours').value);
            
            if (!name) {
                alert('Please enter a class name');
                return;
            }
            
            try {
                await ClassService.update(this.classData.id, {
                    name: name,
                    creditHours: creditHours,
                    showOnlyCAndUp: this.classData.showOnlyCAndUp
                });
                Modal.hide();
                await this.init({ classId: this.classData.id });
            } catch (error) {
                console.error('Failed to update class:', error);
                alert('Failed to update class');
            }
        });
    },
    
    async deleteClass() {
        const confirmed = await Modal.confirm({
            title: 'Delete Class',
            message: `Are you sure you want to delete "${this.classData.name}"? This will delete all categories and grades. This cannot be undone.`,
            confirmText: 'Delete',
            danger: true
        });
        
        if (confirmed) {
            try {
                await ClassService.delete(this.classData.id);
                App.navigate('landing');
            } catch (error) {
                console.error('Failed to delete class:', error);
                alert('Failed to delete class');
            }
        }
    }
};
