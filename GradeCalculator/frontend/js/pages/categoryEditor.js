// Category Editor Page - Add/edit grades in a category
const CategoryEditorPage = {
    classData: null,
    categoryData: null,
    
    async init(params = {}) {
        const { classId, categoryId } = params;
        
        console.log('CategoryEditorPage.init called with:', { classId, categoryId });
        
        if (!classId || !categoryId) {
            App.navigate('landing');
            return;
        }
        
        try {
            // Use local storage if not Google user
            if (!Storage.isGoogleUser()) {
                this.classData = LocalDataService.getClass(parseInt(classId));
                console.log('Loaded class from LocalDataService:', this.classData);
                if (!this.classData) {
                    throw new Error('Class not found');
                }
            } else {
                this.classData = await ClassService.getById(classId);
            }
            
            const categories = this.classData.categories || [];
            this.categoryData = categories.find(c => c.id === parseInt(categoryId));
            
            console.log('Found category:', this.categoryData);
            console.log('Category rules:', this.categoryData?.rules);
            
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
        let items = this.categoryData.items || this.categoryData.gradeItems || [];
        
        // Only include items with grades (not null/undefined)
        const gradedItems = items.filter(item => 
            item.pointsEarned !== null && item.pointsEarned !== undefined
        );
        
        if (gradedItems.length === 0) return null;
        
        // Separate extra credit items (pointsPossible = 0) from regular items
        const regularItems = gradedItems.filter(item => item.pointsPossible > 0);
        const extraCreditItems = gradedItems.filter(item => item.pointsPossible === 0);
        
        // Get rules
        const rules = this.categoryData.rules || [];
        
        // Apply rules only to regular items (not extra credit)
        let processedItems = [...regularItems];
        
        // Calculate percentages for sorting/rules
        processedItems = processedItems.map(item => ({
            ...item,
            percentage: (item.pointsEarned / item.pointsPossible) * 100
        }));
        
        // Check for weighted distribution rule
        const weightedRule = rules.find(r => r.type === 'WeightedDistribution' || r.type === 'WeightByScore');
        
        if (weightedRule && weightedRule.weightDistribution && processedItems.length > 0) {
            // Sort by percentage descending
            processedItems.sort((a, b) => b.percentage - a.percentage);
            
            const weights = typeof weightedRule.weightDistribution === 'string' 
                ? JSON.parse(weightedRule.weightDistribution) 
                : weightedRule.weightDistribution;
            
            // Apply weighted calculation
            let weightedSum = 0;
            let totalWeight = 0;
            
            processedItems.forEach((item, index) => {
                const weight = weights[index] || weights[weights.length - 1] || 0;
                weightedSum += item.percentage * weight;
                totalWeight += weight;
            });
            
            // Add extra credit on top
            let extraCreditBonus = 0;
            extraCreditItems.forEach(item => {
                extraCreditBonus += item.pointsEarned;
            });
            
            return totalWeight > 0 ? (weightedSum / totalWeight) + extraCreditBonus : null;
        }
        
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
        
        // Point-based calculation for regular items
        let totalEarned = 0;
        let totalPossible = 0;
        
        processedItems.forEach(item => {
            totalEarned += item.pointsEarned;
            totalPossible += item.pointsPossible;
        });
        
        // Add extra credit points to earned (but not to possible)
        extraCreditItems.forEach(item => {
            totalEarned += item.pointsEarned;
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
        const rules = this.categoryData.rules || [];
        
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
                
                <section class="rules-section">
                    <div class="section-header">
                        <h3>Grading Rules</h3>
                        <button class="btn btn-secondary btn-sm" id="addRuleBtn">+ Add Rule</button>
                    </div>
                    <div class="rules-list" id="rulesList">
                        ${this.renderRules(rules)}
                    </div>
                </section>
                
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
    
    renderRules(rules) {
        if (!rules || rules.length === 0) {
            return `<p class="empty-rules">No grading rules. Add rules like "Drop Lowest" or "Weighted by Score".</p>`;
        }
        
        return rules.map(rule => {
            let description = '';
            
            switch(rule.type) {
                case 'DropLowest':
                    description = `Drop lowest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
                    break;
                case 'KeepHighest':
                case 'CountHighest':
                    description = `Keep highest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
                    break;
                case 'WeightedDistribution':
                case 'WeightByScore':
                    const weights = typeof rule.weightDistribution === 'string' 
                        ? JSON.parse(rule.weightDistribution) 
                        : rule.weightDistribution;
                    description = `Weighted by rank: ${weights.map((w, i) => `#${i+1}: ${w}%`).join(', ')}`;
                    break;
                default:
                    description = `${rule.type}: ${rule.value}`;
            }
            
            return `
                <div class="rule-item" data-rule-id="${rule.id}">
                    <span class="rule-description">${description}</span>
                    <button class="btn btn-ghost btn-icon delete-rule-btn" title="Remove Rule">🗑️</button>
                </div>
            `;
        }).join('');
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
        
        // Add rule
        document.getElementById('addRuleBtn')?.addEventListener('click', () => this.showAddRuleModal());
        
        // Edit category
        document.getElementById('editCategoryBtn')?.addEventListener('click', () => this.showEditCategoryModal());
        
        // Delete category
        document.getElementById('deleteCategoryBtn')?.addEventListener('click', () => this.deleteCategory());
        
        // Rules list events
        document.getElementById('rulesList')?.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-rule-btn')) {
                const ruleItem = e.target.closest('.rule-item');
                const ruleId = parseInt(ruleItem.dataset.ruleId);
                await this.deleteRule(ruleId);
            }
        });
        
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
                const items = this.categoryData.items || this.categoryData.gradeItems || [];
                const item = items.find(g => g.id === gradeId);
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
    
    async showAddRuleModal() {
        Modal.show({
            title: 'Add Grading Rule',
            content: `
                <div class="form-group">
                    <label class="form-label">Rule Type</label>
                    <select class="form-input" id="ruleType">
                        <option value="DropLowest">Drop Lowest Grades</option>
                        <option value="KeepHighest">Keep Highest Grades</option>
                        <option value="WeightedDistribution">Weighted by Score Rank</option>
                    </select>
                </div>
                <div id="ruleOptions">
                    <div class="form-group" id="countOption">
                        <label class="form-label">Number of Grades</label>
                        <input type="number" class="form-input" id="ruleValue" value="1" min="1">
                        <p class="form-help">How many grades to drop or keep</p>
                    </div>
                </div>
                <div id="weightedOptions" style="display: none;">
                    <p class="form-help" style="margin-bottom: var(--spacing-3);">
                        Enter weights for each rank position. Weights should sum to 100%.
                        <br><br>
                        Example: If you have 4 exams and want the highest to count 50%, 
                        middle two at 20% each, and lowest at 10%, enter: 50, 20, 20, 10
                    </p>
                    <div class="form-group">
                        <label class="form-label">Number of Items</label>
                        <input type="number" class="form-input" id="weightedCount" value="4" min="2" max="20">
                    </div>
                    <div class="form-group" id="weightsInputGroup">
                        <label class="form-label">Weights (highest to lowest)</label>
                        <div id="weightsInputs"></div>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" id="cancelRule">Cancel</button>
                <button class="btn btn-primary" id="addRule">Add Rule</button>
            `,
            size: 'medium'
        });
        
        const ruleTypeSelect = document.getElementById('ruleType');
        const countOption = document.getElementById('countOption');
        const weightedOptions = document.getElementById('weightedOptions');
        const weightedCountInput = document.getElementById('weightedCount');
        const weightsInputsContainer = document.getElementById('weightsInputs');
        
        // Generate weight inputs
        const generateWeightInputs = (count) => {
            const defaultWeights = this.getDefaultWeights(count);
            weightsInputsContainer.innerHTML = Array.from({ length: count }, (_, i) => `
                <div class="weight-input-row" style="display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-2); align-items: center;">
                    <span style="min-width: 80px; color: var(--color-gray-400);">#${i + 1} ${i === 0 ? '(highest)' : i === count - 1 ? '(lowest)' : ''}</span>
                    <input type="number" class="form-input weight-input" value="${defaultWeights[i]}" min="0" max="100" step="1" style="width: 80px;">
                    <span style="color: var(--color-gray-400);">%</span>
                </div>
            `).join('');
        };
        
        // Initial generation
        generateWeightInputs(parseInt(weightedCountInput.value));
        
        // Toggle options based on rule type
        ruleTypeSelect.addEventListener('change', () => {
            if (ruleTypeSelect.value === 'WeightedDistribution') {
                countOption.style.display = 'none';
                weightedOptions.style.display = 'block';
            } else {
                countOption.style.display = 'block';
                weightedOptions.style.display = 'none';
            }
        });
        
        // Regenerate weight inputs when count changes
        weightedCountInput.addEventListener('change', () => {
            generateWeightInputs(parseInt(weightedCountInput.value));
        });
        
        document.getElementById('cancelRule').addEventListener('click', () => Modal.hide());
        document.getElementById('addRule').addEventListener('click', async () => {
            const type = ruleTypeSelect.value;
            
            try {
                if (type === 'WeightedDistribution') {
                    const weightInputs = document.querySelectorAll('.weight-input');
                    const weights = Array.from(weightInputs).map(input => parseInt(input.value) || 0);
                    const totalWeight = weights.reduce((a, b) => a + b, 0);
                    
                    if (totalWeight !== 100) {
                        alert(`Weights must sum to 100%. Current total: ${totalWeight}%`);
                        return;
                    }
                    
                    if (!Storage.isGoogleUser()) {
                        LocalDataService.addRule(this.classData.id, this.categoryData.id, {
                            type: 'WeightedDistribution',
                            value: weights.length,
                            weightDistribution: weights
                        });
                    } else {
                        await CategoryService.addRule(this.categoryData.id, {
                            categoryId: this.categoryData.id,
                            type: 'WeightedDistribution',
                            value: weights.length,
                            weightDistribution: JSON.stringify(weights)
                        });
                    }
                } else {
                    const value = parseInt(document.getElementById('ruleValue').value);
                    
                    console.log('Adding rule:', { type, value, classId: this.classData.id, categoryId: this.categoryData.id });
                    
                    if (!Storage.isGoogleUser()) {
                        const result = LocalDataService.addRule(this.classData.id, this.categoryData.id, {
                            type: type,
                            value: value
                        });
                        console.log('Rule added to LocalDataService:', result);
                    } else {
                        await CategoryService.addRule(this.categoryData.id, {
                            categoryId: this.categoryData.id,
                            type: type,
                            value: value
                        });
                    }
                }
                
                Modal.hide();
                await this.refresh();
            } catch (error) {
                console.error('Failed to add rule:', error);
                alert('Failed to add rule');
            }
        });
    },
    
    getDefaultWeights(count) {
        // Generate sensible default weights
        switch(count) {
            case 2: return [60, 40];
            case 3: return [50, 30, 20];
            case 4: return [50, 20, 20, 10];
            case 5: return [40, 25, 20, 10, 5];
            default:
                // Distribute weights with higher weight for top scores
                const weights = [];
                let remaining = 100;
                for (let i = 0; i < count; i++) {
                    if (i === count - 1) {
                        weights.push(remaining);
                    } else {
                        const weight = Math.round(remaining * (0.4 - (i * 0.05)));
                        weights.push(Math.max(weight, 5));
                        remaining -= weights[i];
                    }
                }
                return weights;
        }
    },
    
    async deleteRule(ruleId) {
        try {
            if (!Storage.isGoogleUser()) {
                LocalDataService.deleteRule(this.classData.id, this.categoryData.id, ruleId);
            } else {
                await CategoryService.deleteRule(ruleId);
            }
            await this.refresh();
        } catch (error) {
            console.error('Failed to delete rule:', error);
            alert('Failed to delete rule');
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
