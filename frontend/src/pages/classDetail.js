import { Formatters, escapeHtml } from '../core/formatters.js';
import { ClassService, CategoryService } from '../services/dataServices.js';
import { CategoryCard } from '../components/cards.js';
import { Modal } from '../components/modal.js';
import { navigate } from '../router.js';

const DASH = '—';

export const ClassDetailPage = {
  classData: null,

  async init(params = {}) {
    const { classId } = params;

    if (!classId) {
      navigate('landing');
      return;
    }

    try {
      this.classData = await ClassService.getById(classId);
    } catch (error) {
      console.error('Failed to load class:', error);
      Modal.toast(error.message ?? 'Could not load that class.');
      navigate('landing');
      return;
    }

    this.render();
    this.bindEvents();
  },

  /** Reloads from the server after a mutation so every derived number is recomputed. */
  reload() {
    return this.init({ classId: this.classData.id });
  },

  render() {
    const letter = this.classData.letterGrade || DASH;
    const percent = this.classData.currentGrade === null
      ? DASH
      : Formatters.percentage(this.classData.currentGrade);

    // Grading warnings (e.g. a weight-by-score rule that no longer matches its item count) are
    // surfaced rather than hidden, because they mean a displayed grade is not what the student
    // configured.
    const warnings = (this.classData.warnings ?? []).length > 0
      ? `<div class="grade-warning" role="status">
           ⚠ A weight-by-score rule no longer matches the number of graded items, so that
           category is using a straight points average. Update the rule to fix it.
         </div>`
      : '';

    document.getElementById('mainContent').innerHTML = `
      <div class="class-detail-page">
        <nav class="breadcrumb"><a href="#" id="backToLanding">← My Classes</a></nav>

        <header class="class-detail-header">
          <div class="class-info">
            <h1>${escapeHtml(this.classData.name)}</h1>
            <p class="class-meta">${escapeHtml(this.classData.creditHours)} credit hours</p>
          </div>
          <div class="class-grade-summary">
            <div class="current-grade ${Formatters.gradeColorClass(letter)}">
              <span class="letter">${escapeHtml(letter)}</span>
              <span class="percentage">${escapeHtml(percent)}</span>
            </div>
          </div>
        </header>

        ${warnings}

        <section class="categories-section">
          <div class="section-header">
            <h2>Categories</h2>
            <button class="btn btn-secondary btn-sm" id="addCategoryBtn">+ Add</button>
          </div>
          <div class="categories-grid" id="categoriesGrid">${this.renderCategories()}</div>
        </section>

        <section class="class-actions">
          <button class="btn btn-secondary" id="editClassBtn">Edit Class</button>
          <button class="btn btn-secondary" id="editScaleBtn">Grade Scale</button>
          <button class="btn btn-danger" id="deleteClassBtn">Delete</button>
        </section>
      </div>
    `;
  },

  renderCategories() {
    const categories = this.classData.categories ?? [];

    if (categories.length === 0) {
      return '<div class="empty-categories"><p>No categories yet. Add categories like "Assignments" or "Exams".</p></div>';
    }

    return categories.map((category) => CategoryCard.render(category)).join('');
  },

  bindEvents() {
    document.getElementById('backToLanding')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('landing', { semesterId: this.classData.semesterId });
    });

    document.querySelectorAll('.category-card').forEach((card) => {
      const open = () => navigate('category', {
        classId: this.classData.id,
        categoryId: Number(card.dataset.categoryId),
      });

      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });

    document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.showAddCategory());
    document.getElementById('editClassBtn')?.addEventListener('click', () => this.showEditClass());
    document.getElementById('editScaleBtn')?.addEventListener('click', () => navigate('class', { classId: this.classData.id }));
    document.getElementById('deleteClassBtn')?.addEventListener('click', () => this.deleteClass());
  },

  showAddCategory() {
    Modal.show({
      title: 'Add Category',
      content: `
        <div class="form-group">
          <label class="form-label" for="categoryName">Category Name</label>
          <input type="text" class="form-input" id="categoryName" placeholder="e.g., Homework" maxlength="200">
        </div>
        <div class="form-group">
          <label class="form-label" for="categoryWeight">Weight (%)</label>
          <input type="number" class="form-input" id="categoryWeight" value="20" min="0" max="100" step="0.1">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="cancelAddCategory">Cancel</button>
        <button class="btn btn-primary" id="confirmAddCategory">Add</button>
      `,
    });

    document.getElementById('cancelAddCategory')?.addEventListener('click', () => Modal.hide());

    document.getElementById('confirmAddCategory')?.addEventListener('click', async () => {
      const name = document.getElementById('categoryName').value.trim();
      const weight = Number.parseFloat(document.getElementById('categoryWeight').value);

      if (!name) {
        Modal.toast('Enter a category name.');
        return;
      }

      if (Number.isNaN(weight) || weight < 0 || weight > 100) {
        Modal.toast('Weight must be between 0 and 100.');
        return;
      }

      try {
        await CategoryService.create({ classId: this.classData.id, name, weight });
        Modal.hide();
        await this.reload();
      } catch (error) {
        Modal.toast(error.message ?? 'Could not add the category.');
      }
    });
  },

  showEditClass() {
    Modal.show({
      title: 'Edit Class',
      content: `
        <div class="form-group">
          <label class="form-label" for="editClassName">Class Name</label>
          <input type="text" class="form-input" id="editClassName" value="${escapeHtml(this.classData.name)}" maxlength="200">
        </div>
        <div class="form-group">
          <label class="form-label" for="editCreditHours">Credit Hours</label>
          <input type="number" class="form-input" id="editCreditHours"
                 value="${escapeHtml(this.classData.creditHours)}" min="0" max="12" step="0.5">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="cancelEditClass">Cancel</button>
        <button class="btn btn-primary" id="confirmEditClass">Save</button>
      `,
    });

    document.getElementById('cancelEditClass')?.addEventListener('click', () => Modal.hide());

    document.getElementById('confirmEditClass')?.addEventListener('click', async () => {
      const name = document.getElementById('editClassName').value.trim();
      const creditHours = Number.parseFloat(document.getElementById('editCreditHours').value);

      if (!name) {
        Modal.toast('Enter a class name.');
        return;
      }

      if (Number.isNaN(creditHours) || creditHours < 0 || creditHours > 12) {
        Modal.toast('Credit hours must be between 0 and 12.');
        return;
      }

      try {
        await ClassService.update(this.classData.id, {
          name,
          creditHours,
          showOnlyCAndUp: this.classData.showOnlyCAndUp,
          // Carried through explicitly. The previous version omitted it, and since the update
          // endpoint treats an absent semesterId as null, editing a class name silently
          // un-assigned it from its semester.
          semesterId: this.classData.semesterId,
        });

        Modal.hide();
        await this.reload();
      } catch (error) {
        Modal.toast(error.message ?? 'Could not update the class.');
      }
    });
  },

  async deleteClass() {
    const confirmed = await Modal.confirm({
      title: 'Delete Class',
      message: `Delete "${this.classData.name}"? This removes all its categories and grades and cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });

    if (!confirmed) return;

    try {
      const semesterId = this.classData.semesterId;
      await ClassService.remove(this.classData.id);
      navigate('landing', { semesterId });
    } catch (error) {
      Modal.toast(error.message ?? 'Could not delete the class.');
    }
  },
};
