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
            // Use local storage if not Google user
            if (!Storage.isGoogleUser()) {
                this.classData = LocalDataService.getClass(parseInt(classId));
                if (!this.classData) {
                    throw new Error('Class not found');
                }
            } else {
                this.classData = await ClassService.getById(classId);
            }
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
        const currentGrade = this.calculateClassGrade();
        const letterGrade = this.getLetterGrade(currentGrade);
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
    
    calculateClassGrade() {
        const categories = this.classData.categories || [];
        
        // Filter categories that have grades and positive weight
        const gradedCategories = categories.filter(cat => {
            const catGrade = this.calculateCategoryGrade(cat);
            return catGrade !== null && cat.weight > 0;
        });
        
        if (gradedCategories.length === 0) return null;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        gradedCategories.forEach(cat => {
            const catGrade = this.calculateCategoryGrade(cat);
            if (catGrade !== null) {
                weightedSum += catGrade * cat.weight;
                totalWeight += cat.weight;
            }
        });
        
        // Handle extra credit categories (weight = 0 or negative, or named "extra credit")
        const extraCreditCategories = categories.filter(cat => {
            const name = cat.name.toLowerCase();
            return name.includes('extra credit') || name.includes('extracredit') || cat.weight === 0;
        });
        
        // Add extra credit bonus on top
        let extraCreditBonus = 0;
        extraCreditCategories.forEach(cat => {
            const items = cat.items || cat.gradeItems || [];
            items.forEach(item => {
                if (item.pointsEarned !== null && item.pointsEarned !== undefined) {
                    // Extra credit adds percentage points directly
                    if (item.pointsPossible > 0) {
                        extraCreditBonus += (item.pointsEarned / item.pointsPossible) * (cat.weight || 1);
                    } else {
                        extraCreditBonus += item.pointsEarned;
                    }
                }
            });
        });
        
        const baseGrade = totalWeight > 0 ? weightedSum / totalWeight : null;
        return baseGrade !== null ? baseGrade + extraCreditBonus : null;
    },
    
    calculateCategoryGrade(category) {
        const items = category.items || category.gradeItems || [];
        if (items.length === 0) return null;
        
        // Only include items with grades
        const gradedItems = items.filter(item => 
            item.pointsEarned !== null && item.pointsEarned !== undefined
        );
        
        if (gradedItems.length === 0) return null;
        
        // Separate regular items from extra credit items
        const regularItems = gradedItems.filter(item => item.pointsPossible > 0);
        const extraCreditItems = gradedItems.filter(item => item.pointsPossible === 0);
        
        // Get rules for this category
        const rules = category.rules || [];
        
        // Apply rules to regular items
        let processedItems = [...regularItems];
        
        // Calculate percentages for rule application
        processedItems = processedItems.map(item => ({
            ...item,
            percentage: (item.pointsEarned / item.pointsPossible) * 100
        }));
        
        // Check for drop lowest rule
        const dropLowestRule = rules.find(r => r.type === 'DropLowest');
        if (dropLowestRule && dropLowestRule.value > 0 && processedItems.length > dropLowestRule.value) {
            processedItems.sort((a, b) => a.percentage - b.percentage);
            processedItems = processedItems.slice(dropLowestRule.value);
        }
        
        // Check for keep highest rule
        const keepHighestRule = rules.find(r => r.type === 'KeepHighest' || r.type === 'CountHighest');
        if (keepHighestRule && keepHighestRule.value > 0 && processedItems.length > 0) {
            processedItems.sort((a, b) => b.percentage - a.percentage);
            processedItems = processedItems.slice(0, keepHighestRule.value);
        }
        
        // Point-based calculation
        let totalEarned = 0;
        let totalPossible = 0;
        
        processedItems.forEach(item => {
            totalEarned += item.pointsEarned;
            totalPossible += item.pointsPossible;
        });
        
        // Add extra credit points (adds to earned but not possible)
        extraCreditItems.forEach(item => {
            totalEarned += item.pointsEarned;
        });
        
        return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
    },
    
    getLetterGrade(percentage) {
        if (percentage === null) return '—';
        const scale = this.classData.gradeScale || {};
        
        if (percentage >= (scale.aPlus || 97)) return 'A+';
        if (percentage >= (scale.a || 93)) return 'A';
        if (percentage >= (scale.aMinus || 90)) return 'A-';
        if (percentage >= (scale.bPlus || 87)) return 'B+';
        if (percentage >= (scale.b || 83)) return 'B';
        if (percentage >= (scale.bMinus || 80)) return 'B-';
        if (percentage >= (scale.cPlus || 77)) return 'C+';
        if (percentage >= (scale.c || 73)) return 'C';
        if (percentage >= (scale.cMinus || 70)) return 'C-';
        if (percentage >= (scale.dPlus || 67)) return 'D+';
        if (percentage >= (scale.d || 63)) return 'D';
        if (percentage >= (scale.dMinus || 60)) return 'D-';
        return 'F';
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
            const catGrade = this.calculateCategoryGrade(cat);
            const grade = catGrade !== null ? Formatters.percentage(catGrade) : '—';
            const items = cat.items || cat.gradeItems || [];
            const itemCount = items.length;
            
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
                    categoryId: parseInt(categoryId)
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
                    <p class="form-help">Use 0% for extra credit categories</p>
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
                if (!Storage.isGoogleUser()) {
                    LocalDataService.addCategory(this.classData.id, { name, weight });
                } else {
                    await CategoryService.create({
                        classId: this.classData.id,
                        name: name,
                        weight: weight
                    });
                }
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
                if (!Storage.isGoogleUser()) {
                    LocalDataService.updateClass(this.classData.id, { name, creditHours });
                } else {
                    await ClassService.update(this.classData.id, {
                        name: name,
                        creditHours: creditHours,
                        showOnlyCAndUp: this.classData.showOnlyCAndUp
                    });
                }
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
                if (!Storage.isGoogleUser()) {
                    LocalDataService.deleteClass(this.classData.id);
                } else {
                    await ClassService.delete(this.classData.id);
                }
                App.navigate('landing');
            } catch (error) {
                console.error('Failed to delete class:', error);
                alert('Failed to delete class');
            }
        }
    }
};
