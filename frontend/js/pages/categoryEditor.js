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
            this.classData = await ClassService.getById(classId);
            this.categoryData = this.classData.categories.find(c => c.id === parseInt(categoryId));
            
            if (!this.categoryData) {
                alert('Category not found');
                App.navigate('class', { classId });
                return;
            }
            
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load category:', error);
            App.navigate('landing');
        }
    },
    
    render() {
        const mainContent = document.getElementById('mainContent');
        const percentage = this.categoryData.currentGrade !== null 
            ? Formatters.percentage(this.categoryData.currentGrade) 
            : '—';
        
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
                            <span>${this.categoryData.gradeItems?.length || 0} items</span>
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
                
                ${RulesEditor.render(this.categoryData.rules)}
            </div>
        `;
    },
    
    renderGradeItems() {
        const items = this.categoryData.gradeItems || [];
        
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
        const percentage = item.percentage !== null ? Formatters.percentage(item.percentage) : '—';
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
                    <input type="number" class="possible-input" value="${item.pointsPossible}" step="0.1" min="0.1">
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
        
        // Grade item events - use event delegation
        const gradeList = document.getElementById('gradeItemsList');
        
        // Name changes
        gradeList?.addEventListener('change', async (e) => {
            if (e.target.classList.contains('name-input')) {
                const gradeId = e.target.closest('.grade-item').dataset.gradeId;
                await this.updateGradeName(gradeId, e.target.value);
            }
            if (e.target.classList.contains('earned-input') || e.target.classList.contains('possible-input')) {
                const gradeItem = e.target.closest('.grade-item');
                const gradeId = gradeItem.dataset.gradeId;
                await this.updateGradeScore(gradeId, gradeItem);
            }
        });
        
        // Button clicks
        gradeList?.addEventListener('click', async (e) => {
            const gradeItem = e.target.closest('.grade-item');
            if (!gradeItem) return;
            
            const gradeId = gradeItem.dataset.gradeId;
            
            if (e.target.closest('.what-if-btn')) {
                await this.toggleWhatIf(gradeId);
            }
            if (e.target.closest('.delete-btn')) {
                await this.deleteGrade(gradeId);
            }
        });
        
        // Rules
        document.getElementById('addRuleBtn')?.addEventListener('click', () => this.showAddRuleModal());
    },
    
    async addGrade() {
        const itemCount = this.categoryData.gradeItems?.length || 0;
        
        try {
            await GradeService.create({
                categoryId: this.categoryData.id,
                name: `Grade ${itemCount + 1}`,
                pointsEarned: null,
                pointsPossible: 100,
                isWhatIf: false
            });
            
            await this.refresh();
        } catch (error) {
            console.error('Failed to add grade:', error);
            alert('Failed to add grade');
        }
    },
    
    async updateGradeName(gradeId, name) {
        const item = this.categoryData.gradeItems.find(g => g.id === parseInt(gradeId));
        if (!item) return;
        
        try {
            await GradeService.update(gradeId, {
                categoryId: this.categoryData.id,
                name: name,
                pointsEarned: item.pointsEarned,
                pointsPossible: item.pointsPossible,
                isWhatIf: item.isWhatIf
            });
        } catch (error) {
            console.error('Failed to update grade name:', error);
        }
    },
    
    async updateGradeScore(gradeId, gradeElement) {
        const item = this.categoryData.gradeItems.find(g => g.id === parseInt(gradeId));
        if (!item) return;
        
        const earnedInput = gradeElement.querySelector('.earned-input');
        const possibleInput = gradeElement.querySelector('.possible-input');
        const nameInput = gradeElement.querySelector('.name-input');
        
        const earned = earnedInput.value !== '' ? parseFloat(earnedInput.value) : null;
        const possible = parseFloat(possibleInput.value) || 100;
        
        try {
            await GradeService.update(gradeId, {
                categoryId: this.categoryData.id,
                name: nameInput.value,
                pointsEarned: earned,
                pointsPossible: possible,
                isWhatIf: item.isWhatIf
            });
            
            await this.refresh();
        } catch (error) {
            console.error('Failed to update grade:', error);
            alert('Failed to update grade');
        }
    },
    
    async toggleWhatIf(gradeId) {
        try {
            await GradeService.toggleWhatIf(gradeId);
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
                await GradeService.delete(gradeId);
                await this.refresh();
            } catch (error) {
                console.error('Failed to delete grade:', error);
                alert('Failed to delete grade');
            }
        }
    },
    
    async showAddRuleModal() {
        Modal.show({
            title: 'Add Grading Rule',
            content: `
                <div class="form-group">
                    <label class="form-label">Rule Type</label>
                    <select class="form-input" id="ruleType">
                        <option value="DropLowest">Drop Lowest</option>
                        <option value="CountHighest">Count Highest</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Number of Grades</label>
                    <input type="number" class="form-input" id="ruleValue" value="1" min="1">
                    <p class="form-help">How many grades to drop or count</p>
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" id="cancelRule">Cancel</button>
                <button class="btn btn-primary" id="addRule">Add Rule</button>
            `
        });
        
        document.getElementById('cancelRule').addEventListener('click', () => Modal.hide());
        document.getElementById('addRule').addEventListener('click', async () => {
            const type = document.getElementById('ruleType').value;
            const value = parseInt(document.getElementById('ruleValue').value);
            
            try {
                await CategoryService.addRule(this.categoryData.id, {
                    categoryId: this.categoryData.id,
                    type: type,
                    value: value
                });
                Modal.hide();
                await this.refresh();
            } catch (error) {
                console.error('Failed to add rule:', error);
                alert('Failed to add rule');
            }
        });
    },
    
    async refresh() {
        await this.init({ 
            classId: this.classData.id, 
            categoryId: this.categoryData.id 
        });
    }
};
