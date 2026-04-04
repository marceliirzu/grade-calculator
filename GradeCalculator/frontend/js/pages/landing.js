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

        const gradedItems = items.filter(item =>
            item.pointsEarned !== null && item.pointsEarned !== undefined
        );

        if (gradedItems.length === 0) return null;

        const regularItems = gradedItems.filter(item => item.pointsPossible > 0);
        const extraCreditItems = gradedItems.filter(item => item.pointsPossible === 0);

        const rules = category.rules || [];
        let processedItems = [...regularItems];

        processedItems = processedItems.map(item => ({
            ...item,
            percentage: (item.pointsEarned / item.pointsPossible) * 100
        }));

        const dropLowestRule = rules.find(r => r.type === 'DropLowest');
        if (dropLowestRule && dropLowestRule.value > 0 && processedItems.length > dropLowestRule.value) {
            processedItems.sort((a, b) => a.percentage - b.percentage);
            processedItems = processedItems.slice(dropLowestRule.value);
        }

        const keepHighestRule = rules.find(r => r.type === 'KeepHighest' || r.type === 'CountHighest');
        if (keepHighestRule && keepHighestRule.value > 0 && processedItems.length > 0) {
            processedItems.sort((a, b) => b.percentage - a.percentage);
            processedItems = processedItems.slice(0, keepHighestRule.value);
        }

        let totalEarned = 0;
        let totalPossible = 0;

        processedItems.forEach(item => {
            totalEarned += item.pointsEarned;
            totalPossible += item.pointsPossible;
        });

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

        mainContent.innerHTML = `
            <div class="landing-page">
                <div class="landing-main">
                    <header class="page-header">
                        <h1>My Classes</h1>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="addClassBtn">+ Add Class</button>
                        </div>
                    </header>

                    ${this.classes.length === 0 ? this.renderEmptyState() : this.renderClassGrid()}
                </div>

                <aside class="landing-sidebar">
                    ${this.renderGPASidebar(gpa)}
                </aside>
            </div>
        `;
    },

    renderGPASidebar(gpa) {
        const totalCredits = this.classes.reduce((sum, cls) => {
            const grade = this.calculateClassGrade(cls);
            return sum + (grade !== null ? (cls.creditHours || 3) : 0);
        }, 0);

        const classItems = this.classes.map(cls => {
            const grade = this.calculateClassGrade(cls);
            const letter = this.getLetterGrade(grade, cls.gradeScale);
            const colorClass = Formatters.gradeColorClass(letter);
            return `
                <div class="sidebar-class-item">
                    <span class="sidebar-class-name">${cls.name.length > 18 ? cls.name.substring(0, 18) + '...' : cls.name}</span>
                    <span class="sidebar-class-grade ${colorClass}">${letter}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="gpa-sidebar-card">
                <div class="gpa-sidebar-label">Overall GPA</div>
                <div class="gpa-sidebar-value">${gpa !== null ? gpa.toFixed(2) : '—'}</div>
                <div class="gpa-sidebar-scale">/ 4.0</div>

                <div class="gpa-sidebar-stats">
                    <div class="gpa-stat">
                        <span class="gpa-stat-value">${this.classes.length}</span>
                        <span class="gpa-stat-label">Classes</span>
                    </div>
                    <div class="gpa-stat">
                        <span class="gpa-stat-value">${totalCredits}</span>
                        <span class="gpa-stat-label">Credits</span>
                    </div>
                </div>

                ${this.classes.length > 0 ? `<div class="sidebar-class-list">${classItems}</div>` : ''}

                <div class="gpa-sidebar-tip">
                    ${this.classes.length === 0
                        ? 'Add your first class to start tracking your GPA'
                        : 'Click a class to manage grades'}
                </div>
            </div>

            <div class="aplus-sidebar-card">
                <div class="aplus-sidebar-row" id="aplusToggleSidebar">
                    <span>A+ Value</span>
                    <span class="aplus-badge">${CONFIG.A_PLUS_VALUE === 4.33 ? '4.33' : '4.0'}</span>
                </div>
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div class="empty-hero">
                <div class="empty-hero-glow"></div>
                <div class="empty-hero-icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <rect x="8" y="12" width="48" height="40" rx="6" stroke="#3F3F46" stroke-width="2"/>
                        <line x1="16" y1="24" x2="48" y2="24" stroke="#3F3F46" stroke-width="2"/>
                        <line x1="16" y1="32" x2="40" y2="32" stroke="#27272A" stroke-width="2"/>
                        <line x1="16" y1="40" x2="36" y2="40" stroke="#27272A" stroke-width="2"/>
                        <circle cx="48" cy="44" r="12" fill="#6366F1" opacity="0.15"/>
                        <path d="M44 44L47 47L52 41" stroke="#818CF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h2 class="empty-hero-title">No classes yet</h2>
                <p class="empty-hero-desc">Add your first class to start tracking grades and calculating your GPA.</p>
                <div class="empty-hero-actions">
                    <button class="btn btn-primary btn-lg" id="addFirstClassBtn">+ Add Your First Class</button>
                </div>
                <div class="empty-hero-features">
                    <div class="empty-feature">
                        <span class="empty-feature-dot"></span>
                        Paste your syllabus for auto-setup
                    </div>
                    <div class="empty-feature">
                        <span class="empty-feature-dot"></span>
                        Import grades from Canvas or Blackboard
                    </div>
                    <div class="empty-feature">
                        <span class="empty-feature-dot"></span>
                        What-if mode to plan ahead
                    </div>
                </div>
            </div>
        `;
    },

    renderClassGrid() {
        return `
            <div class="classes-grid">
                ${this.classes.map(cls => this.renderClassCard(cls)).join('')}
                <button class="btn-add" id="addClassBtnGrid">
                    <span class="plus-icon">+</span>
                    <span>Add Class</span>
                </button>
            </div>
        `;
    },

    renderClassCard(cls) {
        const grade = this.calculateClassGrade(cls);
        const letterGrade = this.getLetterGrade(grade, cls.gradeScale);
        const percentage = grade !== null ? `${grade.toFixed(1)}%` : '—';
        const colorClass = Formatters.gradeColorClass(letterGrade);
        const categories = cls.categories || [];
        const gpaVal = grade !== null ? this.getGPAValue(letterGrade).toFixed(2) : '—';

        return `
            <div class="class-card" data-class-id="${cls.id}">
                <div class="class-card-accent"></div>
                <div class="class-card-header">
                    <h3 class="class-name">${cls.name}</h3>
                    <span class="credit-hours">${cls.creditHours} cr</span>
                </div>
                <div class="class-card-body">
                    <div class="class-grade">
                        <span class="letter-grade ${colorClass}">${letterGrade}</span>
                        <span class="percentage">${percentage}</span>
                    </div>
                    <div class="class-gpa-pill">
                        <span class="gpa-pill-value">${gpaVal}</span>
                        <span class="gpa-pill-label">GPA</span>
                    </div>
                </div>
                <div class="class-card-categories">
                    ${categories.slice(0, 4).map(cat => `<span class="category-chip">${cat.name}</span>`).join('')}
                </div>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('addClassBtn')?.addEventListener('click', () => this.showAddClassOptions());
        document.getElementById('addFirstClassBtn')?.addEventListener('click', () => this.showAddClassOptions());
        document.getElementById('addClassBtnGrid')?.addEventListener('click', () => this.showAddClassOptions());

        document.getElementById('aplusToggleSidebar')?.addEventListener('click', () => {
            const newValue = CONFIG.A_PLUS_VALUE === 4.0 ? 4.33 : 4.0;
            CONFIG.setAPlusValue(newValue);
            this.render();
            this.bindEvents();
        });

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
