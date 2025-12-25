// Landing Page - Shows classes list (main page after initial visit)
const LandingPage = {
    classes: [],
    
    async init() {
        // Mark that user has visited (so we don't show start page again)
        sessionStorage.setItem('gc_visited', 'true');
        
        await this.loadClasses();
        this.render();
        this.bindEvents();
    },
    
    async loadClasses() {
        if (!Storage.isGoogleUser()) {
            // Load from local storage for non-Google users
            this.classes = LocalDataService.getClasses();
        } else {
            try {
                this.classes = await ClassService.getAll();
            } catch (error) {
                console.error('Failed to load classes:', error);
                this.classes = [];
            }
        }
    },
    
    calculateOverallGPA() {
        if (this.classes.length === 0) return null;
        
        let totalPoints = 0;
        let totalCredits = 0;
        
        this.classes.forEach(cls => {
            const grade = this.calculateClassGrade(cls);
            if (grade !== null) {
                const letterGrade = this.getLetterGrade(grade, cls.gradeScale);
                const gpaValue = this.getGPAValue(letterGrade);
                const credits = cls.creditHours || 3;
                
                totalPoints += gpaValue * credits;
                totalCredits += credits;
            }
        });
        
        return totalCredits > 0 ? totalPoints / totalCredits : null;
    },
    
    calculateClassGrade(cls) {
        const categories = cls.categories || [];
        if (categories.length === 0) return null;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        categories.forEach(cat => {
            const catGrade = this.calculateCategoryGrade(cat);
            if (catGrade !== null && cat.weight > 0) {
                weightedSum += catGrade * cat.weight;
                totalWeight += cat.weight;
            }
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : null;
    },
    
    calculateCategoryGrade(category) {
        const items = category.items || category.gradeItems || [];
        if (items.length === 0) return null;
        
        // Only graded items
        const gradedItems = items.filter(item => 
            item.pointsEarned !== null && item.pointsEarned !== undefined
        );
        
        if (gradedItems.length === 0) return null;
        
        // Separate regular items from extra credit
        const regularItems = gradedItems.filter(item => item.pointsPossible > 0);
        const extraCreditItems = gradedItems.filter(item => item.pointsPossible === 0);
        
        // Point-based calculation
        let totalEarned = 0;
        let totalPossible = 0;
        
        regularItems.forEach(item => {
            totalEarned += item.pointsEarned;
            totalPossible += item.pointsPossible;
        });
        
        // Add extra credit
        extraCreditItems.forEach(item => {
            totalEarned += item.pointsEarned;
        });
        
        return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
    },
    
    getLetterGrade(percentage, gradeScale = {}) {
        if (percentage === null) return '—';
        
        if (percentage >= (gradeScale.aPlus || 97)) return 'A+';
        if (percentage >= (gradeScale.a || 93)) return 'A';
        if (percentage >= (gradeScale.aMinus || 90)) return 'A-';
        if (percentage >= (gradeScale.bPlus || 87)) return 'B+';
        if (percentage >= (gradeScale.b || 83)) return 'B';
        if (percentage >= (gradeScale.bMinus || 80)) return 'B-';
        if (percentage >= (gradeScale.cPlus || 77)) return 'C+';
        if (percentage >= (gradeScale.c || 73)) return 'C';
        if (percentage >= (gradeScale.cMinus || 70)) return 'C-';
        if (percentage >= (gradeScale.dPlus || 67)) return 'D+';
        if (percentage >= (gradeScale.d || 63)) return 'D';
        if (percentage >= (gradeScale.dMinus || 60)) return 'D-';
        return 'F';
    },
    
    getGPAValue(letterGrade) {
        const scale = {
            'A+': CONFIG.A_PLUS_VALUE || 4.0,
            'A': 4.0, 'A-': 3.67,
            'B+': 3.33, 'B': 3.0, 'B-': 2.67,
            'C+': 2.33, 'C': 2.0, 'C-': 1.67,
            'D+': 1.33, 'D': 1.0, 'D-': 0.67,
            'F': 0.0
        };
        return scale[letterGrade] || 0;
    },
    
    render() {
        const mainContent = document.getElementById('mainContent');
        const gpa = this.calculateOverallGPA();
        
        // Update header GPA badge
        const gpaBadge = document.querySelector('.gpa-value');
        if (gpaBadge) {
            gpaBadge.textContent = gpa !== null ? gpa.toFixed(2) : '—';
        }
        
        mainContent.innerHTML = `
            <div class="landing-page">
                <header class="page-header">
                    <h1>My Classes</h1>
                    <div class="header-actions">
                        <button class="btn btn-primary" id="addClassBtn">+ Add Class</button>
                    </div>
                </header>
                
                ${this.classes.length === 0 ? this.renderEmptyState() : this.renderClassGrid()}
            </div>
        `;
    },
    
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h2>No classes yet</h2>
                <p>Add your first class to start tracking your grades</p>
                <button class="btn btn-primary btn-lg" id="addFirstClassBtn">+ Add Your First Class</button>
            </div>
        `;
    },
    
    renderClassGrid() {
        return `
            <div class="classes-grid">
                ${this.classes.map(cls => this.renderClassCard(cls)).join('')}
            </div>
        `;
    },
    
    renderClassCard(cls) {
        const grade = this.calculateClassGrade(cls);
        const letterGrade = this.getLetterGrade(grade, cls.gradeScale);
        const percentage = grade !== null ? `${grade.toFixed(1)}%` : '—';
        const colorClass = Formatters.gradeColorClass(letterGrade);
        const categories = cls.categories || [];
        
        return `
            <div class="class-card" data-class-id="${cls.id}">
                <div class="class-card-header">
                    <h3 class="class-name">${cls.name}</h3>
                    <span class="credit-hours">${cls.creditHours} credits</span>
                </div>
                <div class="class-card-body">
                    <div class="class-grade ${colorClass}">
                        <span class="letter-grade">${letterGrade}</span>
                        <span class="percentage">${percentage}</span>
                    </div>
                    <div class="class-categories">
                        ${categories.slice(0, 3).map(cat => `
                            <span class="category-chip">${cat.name}</span>
                        `).join('')}
                        ${categories.length > 3 ? `<span class="category-chip">+${categories.length - 3} more</span>` : ''}
                    </div>
                </div>
                <div class="class-card-footer">
                    <span class="click-hint">Click to view details →</span>
                </div>
            </div>
        `;
    },
    
    bindEvents() {
        // Add class buttons
        document.getElementById('addClassBtn')?.addEventListener('click', () => this.showAddClassOptions());
        document.getElementById('addFirstClassBtn')?.addEventListener('click', () => this.showAddClassOptions());
        
        // Class card clicks
        document.querySelectorAll('.class-card').forEach(card => {
            card.addEventListener('click', () => {
                const classId = card.dataset.classId;
                App.navigate('class', { classId: parseInt(classId) });
            });
        });
    },
    
    async showAddClassOptions() {
        Modal.show({
            title: 'Add New Class',
            content: `
                <div class="add-class-options">
                    <p class="modal-description">Choose how you'd like to add your class:</p>
                    <div class="option-buttons">
                        <button class="btn btn-option" id="optionSyllabus">
                            <span class="option-icon">📄</span>
                            <span class="option-title">Paste Syllabus</span>
                            <span class="option-desc">AI extracts grading info automatically</span>
                        </button>
                        <button class="btn btn-option" id="optionGradebook">
                            <span class="option-icon">📊</span>
                            <span class="option-title">Import Gradebook</span>
                            <span class="option-desc">Paste grades from your LMS</span>
                        </button>
                        <button class="btn btn-option" id="optionManual">
                            <span class="option-icon">✏️</span>
                            <span class="option-title">Enter Manually</span>
                            <span class="option-desc">Set up class yourself</span>
                        </button>
                    </div>
                </div>
            `,
            size: 'medium'
        });
        
        document.getElementById('optionSyllabus')?.addEventListener('click', async () => {
            Modal.hide();
            const result = await Modal.showSyllabusPaste();
            if (result) {
                App.navigate('setup', { syllabusData: result });
            }
        });
        
        document.getElementById('optionGradebook')?.addEventListener('click', async () => {
            Modal.hide();
            const result = await Modal.showGradebookPaste();
            if (result) {
                App.navigate('setup', { gradebookData: result });
            }
        });
        
        document.getElementById('optionManual')?.addEventListener('click', () => {
            Modal.hide();
            App.navigate('setup');
        });
    }
};
