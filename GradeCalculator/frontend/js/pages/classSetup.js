// Class Setup Page
const ClassSetupPage = {
    syllabusData: null,
    gradebookData: null,
    parsedCategories: null,
    
    async init(params = {}) {
        this.syllabusData = params.syllabusData || null;
        this.gradebookData = params.gradebookData || null;
        this.parsedCategories = null;
        
        this.render();
        this.bindEvents();
        
        // Pre-fill from syllabus data if available
        if (this.syllabusData) {
            this.prefillFromSyllabus();
        }
        
        // Pre-fill from gradebook data if available
        if (this.gradebookData) {
            this.prefillFromGradebook();
        }
    },
    
    render() {
        const mainContent = document.getElementById('mainContent');
        
        mainContent.innerHTML = `
            <div class="class-setup-page">
                <div class="setup-header">
                    <button class="btn btn-secondary btn-sm" id="backBtn">← Back</button>
                    <h1 class="setup-title">New Class</h1>
                </div>
                
                <form class="setup-form" id="classSetupForm">
                    <div class="form-section">
                        <h2 class="section-title">Class Information</h2>
                        
                        <div class="form-group">
                            <label for="className">Class Name *</label>
                            <input type="text" id="className" class="form-input" placeholder="e.g., Calculus I, Biology 101" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="creditHours">Credit Hours</label>
                            <select id="creditHours" class="form-input">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3" selected>3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h2 class="section-title">Categories</h2>
                        <p class="section-description">Add your grading categories. Weights should total 100%.</p>
                        
                        <div class="categories-list" id="categoriesList">
                            <!-- Categories added dynamically -->
                        </div>
                        
                        <button type="button" class="btn btn-secondary" id="addCategoryBtn">+ Add Category</button>
                        
                        <div class="weight-total" id="weightTotal">
                            Total Weight: <span id="totalWeight">0</span>%
                        </div>
                    </div>
                    
                    <!-- Gradebook Preview -->
                    <div class="form-section" id="gradebookPreview" style="display: none;">
                        <!-- Filled by prefillFromGradebook -->
                    </div>
                    
                    <!-- Syllabus Preview (rules) -->
                    <div class="form-section" id="syllabusPreview" style="display: none;">
                        <!-- Filled by prefillFromSyllabus -->
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-lg">Create Class</button>
                    </div>
                </form>
            </div>
        `;
        
        // Add initial categories
        this.addCategory('Assignments', 30);
        this.addCategory('Quizzes', 20);
        this.addCategory('Exams', 50);
    },
    
    prefillFromSyllabus() {
        if (!this.syllabusData) return;
        
        // Set class name if found
        if (this.syllabusData.className) {
            const nameInput = document.getElementById('className');
            if (nameInput) nameInput.value = this.syllabusData.className;
        }
        
        // Set credit hours if found
        if (this.syllabusData.creditHours) {
            const creditInput = document.getElementById('creditHours');
            if (creditInput) creditInput.value = this.syllabusData.creditHours;
        }
        
        // Replace default categories with parsed ones
        if (this.syllabusData.categories && this.syllabusData.categories.length > 0) {
            const list = document.getElementById('categoriesList');
            list.innerHTML = '';
            
            // Store syllabus categories for later use (including rules)
            this.parsedCategories = this.syllabusData.categories;
            
            this.syllabusData.categories.forEach(cat => {
                this.addCategory(cat.name, cat.weight);
            });
            
            // Show preview if there are rules
            this.showSyllabusPreview();
        }
    },
    
    showSyllabusPreview() {
        if (!this.parsedCategories) return;
        
        // Check if any category has rules
        const hasRules = this.parsedCategories.some(cat => cat.rules && cat.rules.length > 0);
        if (!hasRules) return;
        
        const previewContainer = document.getElementById('syllabusPreview');
        if (!previewContainer) return;
        
        let html = '<h2 class="section-title">⚡ Detected Grading Rules</h2>';
        html += '<div class="gradebook-preview">';
        
        this.parsedCategories.forEach(cat => {
            if (cat.rules && cat.rules.length > 0) {
                html += `
                    <div class="preview-category">
                        <div class="preview-category-header">
                            <strong>${cat.name}</strong>
                        </div>
                        <ul class="preview-items">
                `;
                
                cat.rules.forEach(rule => {
                    let ruleText = '';
                    if (rule.type === 'DropLowest') {
                        ruleText = `Drop lowest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
                    } else if (rule.type === 'KeepHighest') {
                        ruleText = `Keep highest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
                    }
                    html += `<li>✅ ${ruleText}</li>`;
                });
                
                html += '</ul></div>';
            }
        });
        
        html += '</div>';
        html += `<p class="preview-note">These rules will be applied to the categories when you create the class.</p>`;
        
        previewContainer.innerHTML = html;
        previewContainer.style.display = 'block';
    },
    
    prefillFromGradebook() {
        if (!this.gradebookData) return;
        
        // Set class name if found
        if (this.gradebookData.className) {
            const nameInput = document.getElementById('className');
            if (nameInput && !nameInput.value) {
                nameInput.value = this.gradebookData.className;
            }
        }
        
        // Pre-fill categories with items
        if (this.gradebookData.categories && this.gradebookData.categories.length > 0) {
            // Store for later use when creating class
            this.parsedCategories = this.gradebookData.categories;
            
            // Replace categories in form
            const list = document.getElementById('categoriesList');
            list.innerHTML = '';
            
            this.gradebookData.categories.forEach(cat => {
                this.addCategory(cat.name, cat.weight || 0);
            });
            
            // Show preview
            this.showGradebookPreview();
        }
    },
    
    showGradebookPreview() {
        const previewContainer = document.getElementById('gradebookPreview');
        if (!previewContainer || !this.parsedCategories) return;
        
        let totalItems = 0;
        let gradedItems = 0;
        
        let html = '<h2 class="section-title">📊 Imported Grades Preview</h2>';
        html += '<div class="gradebook-preview">';
        
        this.parsedCategories.forEach((cat, catIndex) => {
            const itemCount = cat.items?.length || 0;
            totalItems += itemCount;
            
            html += `
                <div class="preview-category">
                    <div class="preview-category-header">
                        <strong>${cat.name}</strong> 
                        <span style="color: var(--color-gray-500);">(${cat.weight || 0}% • ${itemCount} items)</span>
                    </div>
                    <ul class="preview-items">
            `;
            
            cat.items?.forEach(item => {
                const earned = item.pointsEarned !== null && item.pointsEarned !== undefined 
                    ? item.pointsEarned 
                    : '—';
                if (earned !== '—') gradedItems++;
                
                const percentage = item.pointsEarned !== null && item.pointsEarned !== undefined && item.pointsPossible
                    ? Math.round((item.pointsEarned / item.pointsPossible) * 100) + '%'
                    : '';
                
                html += `<li>
                    <span>${item.name}</span>
                    <span style="color: var(--color-gray-400);">${earned}/${item.pointsPossible} ${percentage}</span>
                </li>`;
            });
            
            html += '</ul></div>';
        });
        
        html += '</div>';
        html += `<p class="preview-note">
            ✅ Found ${totalItems} assignments (${gradedItems} graded). 
            These will be added when you create the class. You can edit everything afterward.
        </p>`;
        
        previewContainer.innerHTML = html;
        previewContainer.style.display = 'block';
    },
    
    addCategory(name = '', weight = 0) {
        const list = document.getElementById('categoriesList');
        const index = list.children.length;
        
        const categoryHtml = `
            <div class="category-row" data-index="${index}">
                <input type="text" class="form-input category-name" placeholder="Category name" value="${name}">
                <div class="weight-input-group">
                    <input type="number" class="form-input category-weight" min="0" max="100" value="${weight}">
                    <span class="weight-suffix">%</span>
                </div>
                <button type="button" class="btn btn-icon btn-danger remove-category-btn">×</button>
            </div>
        `;
        
        list.insertAdjacentHTML('beforeend', categoryHtml);
        this.updateTotalWeight();
        this.bindCategoryEvents();
    },
    
    updateTotalWeight() {
        const weights = document.querySelectorAll('.category-weight');
        let total = 0;
        weights.forEach(w => {
            total += parseInt(w.value) || 0;
        });
        
        const totalSpan = document.getElementById('totalWeight');
        const totalDiv = document.getElementById('weightTotal');
        
        if (totalSpan) totalSpan.textContent = total;
        
        if (totalDiv) {
            if (total === 100) {
                totalDiv.classList.remove('error');
                totalDiv.classList.add('success');
            } else {
                totalDiv.classList.remove('success');
                totalDiv.classList.add('error');
            }
        }
    },
    
    bindEvents() {
        document.getElementById('backBtn')?.addEventListener('click', () => {
            App.navigate('landing');
        });
        
        document.getElementById('cancelBtn')?.addEventListener('click', () => {
            App.navigate('landing');
        });
        
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
            this.addCategory();
        });
        
        document.getElementById('classSetupForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveClass();
        });
        
        this.bindCategoryEvents();
    },
    
    bindCategoryEvents() {
        // Weight change listeners
        document.querySelectorAll('.category-weight').forEach(input => {
            input.removeEventListener('input', this.updateTotalWeight);
            input.addEventListener('input', () => this.updateTotalWeight());
        });
        
        // Remove category listeners
        document.querySelectorAll('.remove-category-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.target.closest('.category-row')?.remove();
                this.updateTotalWeight();
            };
        });
    },
    
    async saveClass() {
        const name = document.getElementById('className').value.trim();
        const creditHours = parseInt(document.getElementById('creditHours').value);
        
        if (!name) {
            alert('Please enter a class name');
            return;
        }
        
        // Gather categories from the form
        const categoryRows = document.querySelectorAll('.category-row');
        const categories = [];
        
        categoryRows.forEach(row => {
            const catName = row.querySelector('.category-name').value.trim();
            const weight = parseInt(row.querySelector('.category-weight').value) || 0;
            
            if (catName) {
                // Find rules from syllabus data if available
                const syllabusCategory = this.parsedCategories?.find(c => c.name === catName);
                categories.push({ 
                    name: catName, 
                    weight,
                    rules: syllabusCategory?.rules || [],
                    items: syllabusCategory?.items || []
                });
            }
        });
        
        if (categories.length === 0) {
            alert('Please add at least one category');
            return;
        }
        
        try {
            let newClass;
            
            // Check if using local storage mode
            if (!Storage.isGoogleUser()) {
                // Create class locally
                newClass = LocalDataService.createClass({ name, creditHours });
                
                // Add categories, rules, and items
                for (const cat of categories) {
                    const newCategory = LocalDataService.addCategory(newClass.id, {
                        name: cat.name,
                        weight: cat.weight
                    });
                    
                    // Add rules if present (from syllabus)
                    if (cat.rules && cat.rules.length > 0) {
                        for (const rule of cat.rules) {
                            LocalDataService.addRule(newClass.id, newCategory.id, {
                                type: rule.type,
                                value: rule.value
                            });
                        }
                    }
                    
                    // Add grade items if we have gradebook data
                    if (cat.items && cat.items.length > 0) {
                        for (const item of cat.items) {
                            LocalDataService.addGradeItem(newClass.id, newCategory.id, {
                                name: item.name,
                                pointsEarned: item.pointsEarned,
                                pointsPossible: item.pointsPossible || 100
                            });
                        }
                    }
                }
                
                // Refresh class with all data
                newClass = LocalDataService.getClass(newClass.id);
            } else {
                // Create class via API
                newClass = await ClassService.create({ name, creditHours });
                
                // Add categories
                for (const cat of categories) {
                    const newCategory = await CategoryService.create(newClass.id, {
                        name: cat.name,
                        weight: cat.weight
                    });
                    
                    // Add rules if present
                    if (cat.rules && cat.rules.length > 0) {
                        for (const rule of cat.rules) {
                            await CategoryService.addRule(newCategory.id, {
                                categoryId: newCategory.id,
                                type: rule.type,
                                value: rule.value
                            });
                        }
                    }
                    
                    // Add grade items if we have gradebook data
                    if (cat.items && cat.items.length > 0) {
                        for (const item of cat.items) {
                            await GradeService.create(newCategory.id, {
                                name: item.name,
                                pointsEarned: item.pointsEarned,
                                pointsPossible: item.pointsPossible || 100
                            });
                        }
                    }
                }
                
                // Refresh class with all data
                newClass = await ClassService.getById(newClass.id);
            }
            
            // Navigate to class detail
            App.navigate('class', { classId: newClass.id });
        } catch (error) {
            console.error('Failed to create class:', error);
            alert('Failed to create class. Please try again.');
        }
    }
};
