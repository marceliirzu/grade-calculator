// Class Setup Page (Wizard) with AI Autofill
const ClassSetupPage = {
    step: 1,
    syllabusData: null,
    formData: {
        name: '',
        creditHours: 3,
        showOnlyCAndUp: false,
        categories: [...CONFIG.DEFAULT_CATEGORIES],
        gradeScale: { ...CONFIG.DEFAULT_GRADE_SCALE }
    },

    init(params = {}) {
        this.step = 1;
        this.syllabusData = params.syllabusData || null;

        // Reset form data
        this.formData = {
            name: '',
            creditHours: 3,
            showOnlyCAndUp: false,
            categories: [...CONFIG.DEFAULT_CATEGORIES],
            gradeScale: { ...CONFIG.DEFAULT_GRADE_SCALE }
        };

        // Pre-fill from parsed syllabus if available
        if (this.syllabusData) {
            if (this.syllabusData.className) {
                this.formData.name = this.syllabusData.className;
            }
            if (this.syllabusData.creditHours) {
                this.formData.creditHours = this.syllabusData.creditHours;
            }
            if (this.syllabusData.categories && this.syllabusData.categories.length > 0) {
                this.formData.categories = this.syllabusData.categories.map(cat => ({
                    name: cat.name,
                    weight: cat.weight
                }));
            }
            if (this.syllabusData.gradeScale) {
                this.formData.gradeScale = {
                    ...CONFIG.DEFAULT_GRADE_SCALE,
                    ...this.syllabusData.gradeScale
                };
            }
        }

        this.render();
        this.bindEvents();
    },

    render() {
        const mainContent = document.getElementById('mainContent');
        const aiIndicator = this.syllabusData ? `
            <div class="ai-indicator">
                <span>&#10024;</span> Auto-filled from syllabus
            </div>
        ` : '';

        mainContent.innerHTML = `
            <div class="class-setup-page">
                <div class="setup-header">
                    ${aiIndicator}
                    <h1 class="setup-title">New Class</h1>
                    <p class="setup-subtitle">Set up your class in a few steps</p>
                </div>

                ${this.renderProgress()}

                <div class="setup-card">
                    ${this.renderStep()}
                </div>

                <a href="#" class="skip-link" id="cancelSetup">Cancel</a>
            </div>
        `;
    },

    renderProgress() {
        const steps = ['Info', 'Categories', 'Grade Scale'];

        return `
            <div class="setup-progress">
                ${steps.map((label, i) => `
                    <div class="progress-step">
                        <span class="step-number ${i + 1 === this.step ? 'active' : ''} ${i + 1 < this.step ? 'completed' : ''}">${i + 1 < this.step ? '&#10003;' : i + 1}</span>
                        <span class="step-label ${i + 1 === this.step ? 'active' : ''}">${label}</span>
                    </div>
                    ${i < steps.length - 1 ? `<div class="progress-line ${i + 1 < this.step ? 'completed' : ''}"></div>` : ''}
                `).join('')}
            </div>
        `;
    },

    renderStep() {
        switch (this.step) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3: return this.renderStep3();
            default: return '';
        }
    },

    renderStep1() {
        return `
            <h2 class="setup-card-title">Basic Information</h2>
            <div class="basic-info-grid">
                <div class="form-group">
                    <label class="form-label">Class Name</label>
                    <input type="text" class="form-input" id="className"
                           value="${this.formData.name}" placeholder="e.g., Calculus I">
                </div>
                <div class="form-group">
                    <label class="form-label">Credits</label>
                    <input type="number" class="form-input" id="creditHours"
                           value="${this.formData.creditHours}" min="0.5" max="10" step="0.5">
                </div>
            </div>
            <div class="form-group">
                <label class="form-check">
                    <input type="checkbox" class="form-check-input" id="showOnlyCAndUp"
                           ${this.formData.showOnlyCAndUp ? 'checked' : ''}>
                    <span class="form-check-label">D counts as failing (C and up only)</span>
                </label>
            </div>
            <div class="setup-nav">
                <div></div>
                <button class="btn btn-primary btn-lg" id="nextBtn">Next</button>
            </div>
        `;
    },

    renderStep2() {
        const totalWeight = this.formData.categories.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
        const isValid = Math.abs(totalWeight - 100) < 0.01;

        return `
            <h2 class="setup-card-title">Categories</h2>
            <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                Define how your grade is calculated. Weights must total 100%.
            </p>
            <div class="categories-list" id="categoriesList">
                ${this.formData.categories.map((cat, i) => `
                    <div class="category-row">
                        <input type="text" class="form-input category-name"
                               value="${cat.name}" data-index="${i}" placeholder="Category name">
                        <div class="input-group">
                            <input type="number" class="form-input category-weight"
                                   value="${cat.weight}" data-index="${i}" min="0" max="100">
                            <span class="input-group-append">%</span>
                        </div>
                        <span class="delete-btn" data-index="${i}">&#128465;</span>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-secondary mt-4" id="addCategoryBtn">+ Add Category</button>
            <div class="total-weight ${isValid ? 'success' : 'error'}">
                <span>Total</span>
                <span>${totalWeight.toFixed(1)}%</span>
            </div>
            <div class="setup-nav">
                <button class="btn btn-secondary btn-lg" id="prevBtn">Back</button>
                <button class="btn btn-primary btn-lg" id="nextBtn" ${!isValid ? 'disabled' : ''}>Next</button>
            </div>
        `;
    },

    renderStep3() {
        return `
            <h2 class="setup-card-title">Grade Scale</h2>
            <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                Set the minimum percentage for each letter grade.
            </p>
            ${GradeScaleEditor.render(this.formData.gradeScale)}
            <div class="setup-nav">
                <button class="btn btn-secondary btn-lg" id="prevBtn">Back</button>
                <button class="btn btn-accent btn-lg" id="saveBtn">Create Class</button>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('cancelSetup')?.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate('landing');
        });

        document.getElementById('prevBtn')?.addEventListener('click', () => this.prevStep());
        document.getElementById('nextBtn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.save());
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.addCategory());

        // Category inputs
        document.querySelectorAll('.category-name').forEach(input => {
            input.addEventListener('change', (e) => {
                this.formData.categories[e.target.dataset.index].name = e.target.value;
            });
        });

        document.querySelectorAll('.category-weight').forEach(input => {
            input.addEventListener('change', (e) => {
                this.formData.categories[e.target.dataset.index].weight = parseFloat(e.target.value) || 0;
                this.render();
                this.bindEvents();
            });
        });

        document.querySelectorAll('.category-row .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.formData.categories.splice(e.target.dataset.index, 1);
                this.render();
                this.bindEvents();
            });
        });
    },

    nextStep() {
        if (this.step === 1) {
            this.formData.name = document.getElementById('className').value;
            this.formData.creditHours = parseFloat(document.getElementById('creditHours').value);
            this.formData.showOnlyCAndUp = document.getElementById('showOnlyCAndUp').checked;

            const validation = Validation.validateClassName(this.formData.name);
            if (!validation.valid) {
                Modal._showToast(validation.error);
                return;
            }
        }

        this.step++;
        this.render();
        this.bindEvents();
    },

    prevStep() {
        this.step--;
        this.render();
        this.bindEvents();
    },

    addCategory() {
        this.formData.categories.push({ name: '', weight: 0 });
        this.render();
        this.bindEvents();
    },

    async save() {
        const scaleContainer = document.querySelector('.grade-scale-editor');
        this.formData.gradeScale = GradeScaleEditor.getValues(scaleContainer);

        try {
            const newClass = await ClassService.create({
                name: this.formData.name,
                creditHours: this.formData.creditHours,
                showOnlyCAndUp: this.formData.showOnlyCAndUp
            });

            await ClassService.updateGradeScale(newClass.id, this.formData.gradeScale);

            const classData = await ClassService.getById(newClass.id);

            for (const cat of classData.categories) {
                await CategoryService.delete(cat.id);
            }

            for (const cat of this.formData.categories) {
                if (cat.name && cat.weight > 0) {
                    await CategoryService.create({
                        classId: newClass.id,
                        name: cat.name,
                        weight: cat.weight
                    });
                }
            }

            App.navigate('class', { classId: newClass.id });
        } catch (error) {
            console.error('Failed to create class:', error);
            Modal._showToast('Failed to create class. Please try again.');
        }
    }
};
