// Category Editor Page - Add/edit grades in a category
const CategoryEditorPage = {
    classData: null,
    categoryData: null,
    
    async init(params = {}) {
        const { classId, categoryId } = params;
        
        if (!classId || !categoryId) {
            App.navigate('landing');
            return;
        }
        
        try {
            // Use local storage if not Google user
            if (!Storage.isGoogleUser()) {
                this.classData = LocalDataService.getClass(parseInt(classId));
                if (!this.classData) {
                    throw new Error('Class not found');
                }
            } else {
                this.classData = await ClassService.getById(classId);
            }
            
            const categories = this.classData.categories || [];
            this.categoryData = categories.find(c => c.id === parseInt(categoryId));
            
            if (!this.categoryData) {
                alert('Category not found');
                App.navigate('class', { classId });
                return;
            }
            
            // Ensure items array exists
            if (!this.categoryData.items) {
                this.categoryData.items = this.categoryData.gradeItems || [];
            }
            
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load category:', error);
            App.navigate('landing');
        }
    },
    
    calculateCategoryGrade() {
        const items = this.categoryData.items || this.categoryData.gradeItems || [];
        if (items.length === 0) return null;
        
        let totalEarned = 0;
        let totalPossible = 0;
        
        items.forEach(item => {
            if (item.pointsEarned !== null && item.pointsEarned !== undefined) {
                totalEarned += item.pointsEarned;
                // Extra credit: don't add to possible if pointsPossible is 0
                if (item.pointsPossible > 0) {
                    totalPossible += item.pointsPossible;
                }
            }
        });
        
        return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
    },
    
    render() {
        const mainContent = document.getElementById('mainContent');
        const currentGrade = this.calculateCategoryGrade();
        const percentage = currentGrade !== null 
            ? Formatters.percentage(currentGrade) 
            : '—';
        
        const items = this.categoryData.items || this.categoryData.gradeItems || [];
        
        mainContent.innerHTML = `
            <div class="category-editor-page">
                <nav class="breadcrumb">
                    <a href="#" id="backToLanding">My Classes</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#" id="backToClass">${this.classData.name}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.categoryData.name}</span>
                </nav>
                
                <header class="category-header">
                    <div class="category-info">
                        <h1>${this.categoryData.name}</h1>
                        <div class="category-meta">
                            <span>Weight: ${this.categoryData.weight}%</span>
                            <span>•</span>
                            <span>${items.length} items</span>
                        </div>
                    </div>
                    <div class="category-grade-display">
                        <div class="category-percentage">${percentage}</div>
                    </div>
                </header>
                
                <section class="grade-items-section">
                    <div class="grade-items-header">
                        <span class="grade-items-title">Grade Items</span>
                        <button class="btn btn-primary btn-sm" id="addGradeBtn">+ Add Grade</button>
                    </div>
                    <div id="gradeItemsList">
                        ${this.renderGradeItems()}
                    </div>
                </section>
                
                <section class="category-actions">
                    <button class="btn btn-secondary" id="editCategoryBtn">Edit Category</button>
                    <button class="btn btn-danger" id="deleteCategoryBtn">Delete Category</button>
                </section>
            </div>
        `;
    },
    
    renderGradeItems() {
        const items = this.categoryData.items || this.categoryData.gradeItems || [];
        
        if (items.length === 0) {
            return `
                <div class="empty-grades">
                    <p>No grades yet. Click "+ Add Grade" to add your first grade.</p>
                </div>
            `;
        }
        
        return items.map(item => this.renderGradeItem(item)).join('');
    },
    
    renderGradeItem(item) {
        const percentage = (item.pointsEarned !== null && item.pointsPossible > 0) 
            ? Formatters.percentage((item.pointsEarned / item.pointsPossible) * 100)
            : '—';
        const whatIfClass = item.isWhatIf ? 'what-if' : '';
        const earnedValue = item.pointsEarned !== null ? item.pointsEarned : '';
        
        return `
            <div class="grade-item ${whatIfClass}" data-grade-id="${item.id}">
                <div class="grade-item-name">
                    <input type="text" class="name-input" value="${item.name}" placeholder="Grade name">
                    ${item.isWhatIf ? '<span class="what-if-badge">What If</span>' : ''}
                </div>
                <div class="grade-item-score">
                    <input type="number" class="earned-input" value="${earnedValue}" placeholder="—" step="0.1" min="0">
                    <span class="divider">/</span>
                    <input type="number" class="possible-input" value="${item.pointsPossible}" step="0.1" min="0">
                </div>
                <div class="grade-item-percentage">${percentage}</div>
                <div class="grade-item-actions">
                    <button class="btn btn-ghost btn-icon what-if-btn" title="Toggle What-If">🔮</button>
                    <button class="btn btn-ghost btn-icon delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    },
    
    bindEvents() {
        // Navigation
        document.getElementById('backToLanding')?.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate('landing');
        });
        
        document.getElementById('backToClass')?.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate('class', { classId: this.classData.id });
        });
        
        // Add grade
        document.getElementById('addGradeBtn')?.addEventListener('click', () => this.addGrade());
        
        // Edit category
        document.getElementById('editCategoryBtn')?.addEventListener('click', () => this.showEditCategoryModal());
        
        // Delete category
        document.getElementById('deleteCategoryBtn')?.addEventListener('click', () => this.deleteCategory());
        
        // Grade item events - use event delegation
        const gradeList = document.getElementById('gradeItemsList');
        
        // Input changes
        gradeList?.addEventListener('change', async (e) => {
            const gradeItem = e.target.closest('.grade-item');
            if (!gradeItem) return;
            
            const gradeId = parseInt(gradeItem.dataset.gradeId);
            
            if (e.target.classList.contains('name-input') || 
                e.target.classList.contains('earned-input') || 
                e.target.classList.contains('possible-input')) {
                await this.updateGrade(gradeId, gradeItem);
            }
        });
        
        // Button clicks
        gradeList?.addEventListener('click', async (e) => {
            const gradeItem = e.target.closest('.grade-item');
            if (!gradeItem) return;
            
            const gradeId = parseInt(gradeItem.dataset.gradeId);
            
            if (e.target.closest('.what-if-btn')) {
                await this.toggleWhatIf(gradeId);
            }
            if (e.target.closest('.delete-btn')) {
                await this.deleteGrade(gradeId);
            }
        });
    },
    
    async addGrade() {
        const items = this.categoryData.items || this.categoryData.gradeItems || [];
        const itemCount = items.length;
        
        try {
            if (!Storage.isGoogleUser()) {
                LocalDataService.addGradeItem(this.classData.id, this.categoryData.id, {
                    name: `Grade ${itemCount + 1}`,
                    pointsEarned: null,
                    pointsPossible: 100,
                    isWhatIf: false
                });
            } else {
                await GradeService.create({
                    categoryId: this.categoryData.id,
                    name: `Grade ${itemCount + 1}`,
                    pointsEarned: null,
                    pointsPossible: 100,
                    isWhatIf: false
                });
            }
            
            await this.refresh();
        } catch (error) {
            console.error('Failed to add grade:', error);
            alert('Failed to add grade');
        }
    },
    
    async updateGrade(gradeId, gradeElement) {
        const nameInput = gradeElement.querySelector('.name-input');
        const earnedInput = gradeElement.querySelector('.earned-input');
        const possibleInput = gradeElement.querySelector('.possible-input');
        
        const name = nameInput.value;
        const earned = earnedInput.value !== '' ? parseFloat(earnedInput.value) : null;
        const possible = parseFloat(possibleInput.value) || 100;
        
        try {
            if (!Storage.isGoogleUser()) {
                LocalDataService.updateGradeItem(this.classData.id, this.categoryData.id, gradeId, {
                    name: name,
                    pointsEarned: earned,
                    pointsPossible: possible
                });
            } else {
                const item = this.categoryData.gradeItems.find(g => g.id === gradeId);
                await GradeService.update(gradeId, {
                    categoryId: this.categoryData.id,
                    name: name,
                    pointsEarned: earned,
                    pointsPossible: possible,
                    isWhatIf: item?.isWhatIf || false
                });
            }
            
            await this.refresh();
        } catch (error) {
            console.error('Failed to update grade:', error);
            alert('Failed to update grade');
        }
    },
    
    async toggleWhatIf(gradeId) {
        try {
            if (!Storage.isGoogleUser()) {
                const items = this.categoryData.items || this.categoryData.gradeItems || [];
                const item = items.find(g => g.id === gradeId);
                if (item) {
                    LocalDataService.updateGradeItem(this.classData.id, this.categoryData.id, gradeId, {
                        isWhatIf: !item.isWhatIf
                    });
                }
            } else {
                await GradeService.toggleWhatIf(gradeId);
            }
            await this.refresh();
        } catch (error) {
            console.error('Failed to toggle what-if:', error);
        }
    },
    
    async deleteGrade(gradeId) {
        const confirmed = await Modal.confirm({
            title: 'Delete Grade',
            message: 'Are you sure you want to delete this grade?',
            confirmText: 'Delete',
            danger: true
        });
        
        if (confirmed) {
            try {
                if (!Storage.isGoogleUser()) {
                    LocalDataService.deleteGradeItem(this.classData.id, this.categoryData.id, gradeId);
                } else {
                    await GradeService.delete(gradeId);
                }
                await this.refresh();
            } catch (error) {
                console.error('Failed to delete grade:', error);
                alert('Failed to delete grade');
            }
        }
    },
    
    async showEditCategoryModal() {
        Modal.show({
            title: 'Edit Category',
            content: `
                <div class="form-group">
                    <label class="form-label">Category Name</label>
                    <input type="text" class="form-input" id="editCategoryName" value="${this.categoryData.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Weight (%)</label>
                    <input type="number" class="form-input" id="editCategoryWeight" value="${this.categoryData.weight}" min="0" max="100">
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" id="cancelEditCategory">Cancel</button>
                <button class="btn btn-primary" id="saveEditCategory">Save</button>
            `
        });
        
        document.getElementById('cancelEditCategory').addEventListener('click', () => Modal.hide());
        document.getElementById('saveEditCategory').addEventListener('click', async () => {
            const name = document.getElementById('editCategoryName').value.trim();
            const weight = parseFloat(document.getElementById('editCategoryWeight').value);
            
            if (!name) {
                alert('Please enter a category name');
                return;
            }
            
            try {
                if (!Storage.isGoogleUser()) {
                    LocalDataService.updateCategory(this.classData.id, this.categoryData.id, { name, weight });
                } else {
                    await CategoryService.update(this.categoryData.id, {
                        classId: this.classData.id,
                        name: name,
                        weight: weight
                    });
                }
                Modal.hide();
                await this.refresh();
            } catch (error) {
                console.error('Failed to update category:', error);
                alert('Failed to update category');
            }
        });
    },
    
    async deleteCategory() {
        const confirmed = await Modal.confirm({
            title: 'Delete Category',
            message: `Are you sure you want to delete "${this.categoryData.name}"? All grades in this category will be deleted.`,
            confirmText: 'Delete',
            danger: true
        });
        
        if (confirmed) {
            try {
                if (!Storage.isGoogleUser()) {
                    LocalDataService.deleteCategory(this.classData.id, this.categoryData.id);
                } else {
                    await CategoryService.delete(this.categoryData.id);
                }
                App.navigate('class', { classId: this.classData.id });
            } catch (error) {
                console.error('Failed to delete category:', error);
                alert('Failed to delete category');
            }
        }
    },
    
    async refresh() {
        await this.init({ 
            classId: this.classData.id, 
            categoryId: this.categoryData.id 
        });
    }
};
