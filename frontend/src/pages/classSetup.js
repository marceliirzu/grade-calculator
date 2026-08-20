import { escapeHtml } from '../core/formatters.js';
import { DEFAULT_SCALE, normalizeScale } from '../core/grading/bands.js';
import { getAPlusValue } from '../core/preferences.js';
import { CONFIG } from '../config.js';
import { ClassService, CategoryService, SemesterService } from '../services/dataServices.js';
import { GradeScaleEditor } from '../components/cards.js';
import { Modal } from '../components/modal.js';
import { navigate } from '../router.js';

const STEPS = ['Info', 'Categories', 'Grade Scale'];

/** Three-step wizard for creating a class, optionally pre-filled from a parsed syllabus. */
export const ClassSetupPage = {
  step: 1,
  semesterId: null,
  syllabusData: null,
  formData: null,
  saving: false,

  init(params = {}) {
    this.step = 1;
    this.saving = false;
    this.syllabusData = params.syllabusData ?? null;
    this.semesterId = params.semesterId ?? SemesterService.getCurrentSemesterId() ?? null;

    this.formData = {
      name: '',
      creditHours: 3,
      showOnlyCAndUp: false,
      categories: CONFIG.DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      gradeScale: { ...DEFAULT_SCALE, aPlusGpaValue: getAPlusValue() },
    };

    this.applySyllabus();
    this.rerender();
  },

  applySyllabus() {
    const data = this.syllabusData;
    if (!data) return;

    if (data.className) this.formData.name = data.className;
    if (data.creditHours) this.formData.creditHours = data.creditHours;

    if (Array.isArray(data.categories) && data.categories.length > 0) {
      this.formData.categories = data.categories.map((c) => ({ name: c.name, weight: c.weight }));
    }

    if (data.gradeScale) {
      this.formData.gradeScale = normalizeScale({
        ...data.gradeScale,
        aPlusGpaValue: getAPlusValue(),
      });
    }
  },

  /** Re-render and re-bind. The wizard is small enough that full redraws stay simple and safe. */
  rerender() {
    this.render();
    this.bindEvents();
  },

  render() {
    const badge = this.syllabusData
      ? '<div class="ai-indicator"><span>&#10024;</span> Auto-filled from syllabus</div>'
      : '';

    document.getElementById('mainContent').innerHTML = `
      <div class="class-setup-page">
        <div class="setup-header">
          ${badge}
          <h1 class="setup-title">New Class</h1>
          <p class="setup-subtitle">Set up your class in a few steps</p>
        </div>

        ${this.renderProgress()}

        <div class="setup-card">${this.renderStep()}</div>

        <a href="#" class="skip-link" id="cancelSetup">Cancel</a>
      </div>
    `;
  },

  renderProgress() {
    return `
      <div class="setup-progress">
        ${STEPS.map((label, index) => {
          const number = index + 1;
          const done = number < this.step;
          const active = number === this.step;

          return `
            <div class="progress-step">
              <span class="step-number ${active ? 'active' : ''} ${done ? 'completed' : ''}">${done ? '&#10003;' : number}</span>
              <span class="step-label ${active ? 'active' : ''}">${label}</span>
            </div>
            ${index < STEPS.length - 1 ? `<div class="progress-line ${done ? 'completed' : ''}"></div>` : ''}
          `;
        }).join('')}
      </div>
    `;
  },

  renderStep() {
    if (this.step === 1) return this.renderInfoStep();
    if (this.step === 2) return this.renderCategoriesStep();
    return this.renderScaleStep();
  },

  renderInfoStep() {
    return `
      <h2 class="setup-card-title">Basic Information</h2>
      <div class="basic-info-grid">
        <div class="form-group">
          <label class="form-label" for="className">Class Name</label>
          <input type="text" class="form-input" id="className"
                 value="${escapeHtml(this.formData.name)}" placeholder="e.g., Calculus I" maxlength="200">
        </div>
        <div class="form-group">
          <label class="form-label" for="creditHours">Credits</label>
          <input type="number" class="form-input" id="creditHours"
                 value="${escapeHtml(this.formData.creditHours)}" min="0.5" max="12" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" class="form-check-input" id="showOnlyCAndUp" ${this.formData.showOnlyCAndUp ? 'checked' : ''}>
          <span class="form-check-label">D counts as failing (C and up only)</span>
        </label>
      </div>
      ${this.semesterId ? '<p class="form-hint">Adding to the current semester</p>' : ''}
      <div class="setup-nav">
        <div></div>
        <button class="btn btn-primary btn-lg" id="nextBtn">Next</button>
      </div>
    `;
  },

  renderCategoriesStep() {
    const total = this.formData.categories.reduce((sum, c) => sum + (Number.parseFloat(c.weight) || 0), 0);
    const isValid = Math.abs(total - 100) < 0.01;

    return `
      <h2 class="setup-card-title">Categories</h2>
      <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
        Define how your grade is calculated. Weights must total 100%.
      </p>
      <div class="categories-list" id="categoriesList">
        ${this.formData.categories.map((category, index) => `
          <div class="category-row">
            <input type="text" class="form-input category-name" data-index="${index}"
                   value="${escapeHtml(category.name)}" placeholder="Category name" maxlength="200">
            <div class="input-group">
              <input type="number" class="form-input category-weight" data-index="${index}"
                     value="${escapeHtml(category.weight)}" min="0" max="100" step="0.1">
              <span class="input-group-append">%</span>
            </div>
            <span class="delete-btn" data-index="${index}" role="button" tabindex="0" aria-label="Remove category">&#128465;</span>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary mt-4" id="addCategoryBtn">+ Add Category</button>
      <div class="total-weight ${isValid ? 'success' : 'error'}">
        <span>Total</span>
        <span>${total.toFixed(1)}%</span>
      </div>
      <div class="setup-nav">
        <button class="btn btn-secondary btn-lg" id="prevBtn">Back</button>
        <button class="btn btn-primary btn-lg" id="nextBtn" ${isValid ? '' : 'disabled'}>Next</button>
      </div>
    `;
  },

  renderScaleStep() {
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
    document.getElementById('cancelSetup')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('landing', { semesterId: this.semesterId });
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => {
      this.step -= 1;
      this.rerender();
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => this.nextStep());
    document.getElementById('saveBtn')?.addEventListener('click', () => this.save());

    document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
      this.formData.categories.push({ name: '', weight: 0 });
      this.rerender();
    });

    // Names use 'change' (on blur) so a full re-render never interrupts typing.
    document.querySelectorAll('.category-name').forEach((input) => {
      input.addEventListener('change', (event) => {
        this.formData.categories[Number(event.target.dataset.index)].name = event.target.value;
      });
    });

    // Weights re-render live so the running total updates as you type. Focus and caret are
    // restored afterwards, which the original lost on every keystroke.
    document.querySelectorAll('.category-weight').forEach((input) => {
      input.addEventListener('input', (event) => {
        const index = Number(event.target.dataset.index);
        const caret = event.target.selectionStart;

        this.formData.categories[index].weight = Number.parseFloat(event.target.value) || 0;
        this.rerender();

        const restored = document.querySelector(`.category-weight[data-index="${index}"]`);

        if (restored) {
          restored.focus();
          try {
            restored.setSelectionRange(caret, caret);
          } catch {
            // Number inputs disallow selection ranges in some browsers; focus alone is enough.
          }
        }
      });
    });

    document.querySelectorAll('.category-row .delete-btn').forEach((button) => {
      const remove = () => {
        this.formData.categories.splice(Number(button.dataset.index), 1);
        this.rerender();
      };

      button.addEventListener('click', remove);
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          remove();
        }
      });
    });
  },

  nextStep() {
    if (this.step === 1 && !this.commitInfoStep()) return;

    this.step += 1;
    this.rerender();
  },

  commitInfoStep() {
    const name = document.getElementById('className').value.trim();
    const credits = Number.parseFloat(document.getElementById('creditHours').value);

    if (name.length === 0) {
      Modal.toast('Give your class a name.');
      return false;
    }

    if (Number.isNaN(credits) || credits < 0 || credits > 12) {
      Modal.toast('Credits must be between 0 and 12.');
      return false;
    }

    this.formData.name = name;
    this.formData.creditHours = credits;
    this.formData.showOnlyCAndUp = document.getElementById('showOnlyCAndUp').checked;

    return true;
  },

  async save() {
    // Guard against a double-click creating two classes — the sequence below is several
    // awaited calls long, which is plenty of time for a second click to land.
    if (this.saving) return;
    this.saving = true;

    const saveButton = document.getElementById('saveBtn');
    saveButton?.setAttribute('disabled', 'true');

    const container = document.querySelector('.grade-scale-editor');
    this.formData.gradeScale = GradeScaleEditor.getValues(container, getAPlusValue());

    try {
      const created = await ClassService.create({
        name: this.formData.name,
        creditHours: this.formData.creditHours,
        showOnlyCAndUp: this.formData.showOnlyCAndUp,
        semesterId: this.semesterId,
      });

      await ClassService.updateGradeScale(created.id, this.formData.gradeScale);

      // A new class ships with default categories; replace them with the ones configured here.
      const fresh = await ClassService.getById(created.id);
      for (const category of fresh.categories) {
        await CategoryService.remove(category.id);
      }

      for (const category of this.formData.categories) {
        if (category.name.trim() && category.weight > 0) {
          await CategoryService.create({
            classId: created.id,
            name: category.name.trim(),
            weight: category.weight,
          });
        }
      }

      navigate('class', { classId: created.id });
    } catch (error) {
      console.error('Failed to create class:', error);
      Modal.toast(error.message ?? 'Could not create the class. Please try again.');

      this.saving = false;
      saveButton?.removeAttribute('disabled');
    }
  },
};
