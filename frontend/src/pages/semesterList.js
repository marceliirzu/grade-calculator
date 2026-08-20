import { Formatters, escapeHtml } from '../core/formatters.js';
import { letterForGpa } from '../core/grading/bands.js';
import { SemesterService } from '../services/dataServices.js';
import { Modal } from '../components/modal.js';
import { navigate } from '../router.js';

const TERMS = ['Fall', 'Spring', 'Summer', 'Winter'];

const gpaColor = (gpa) =>
  gpa === null || gpa === undefined ? '' : Formatters.gradeColorClass(letterForGpa(gpa));

export const SemesterListPage = {
  semesters: [],

  async init() {
    this.renderSkeleton();

    await this.load();

    this.render();
    this.bindEvents();
  },

  renderSkeleton() {
    document.getElementById('mainContent').innerHTML = `
      <div class="semester-list-page">
        <div class="page-header">
          <h1>My Semesters</h1>
          <button class="btn btn-primary" id="addSemesterBtn">+ New Semester</button>
        </div>
        <div class="semesters-grid">
          ${[1, 2].map(() => '<div class="card skeleton-card" style="height:160px;"></div>').join('')}
        </div>
      </div>
    `;

    document.getElementById('addSemesterBtn')?.addEventListener('click', () => this.showAddModal());
  },

  async load() {
    try {
      this.semesters = (await SemesterService.getAll()) ?? [];
    } catch (error) {
      console.error('Failed to load semesters:', error);
      this.semesters = [];
      Modal.toast(error.message ?? 'Could not load your semesters.');
    }
  },

  async reload() {
    await this.load();
    this.render();
    this.bindEvents();
  },

  render() {
    const currentId = SemesterService.getCurrentSemesterId();
    const cumulative = this.semesters.find((s) => s.cumulativeGpa !== null && s.cumulativeGpa !== undefined)?.cumulativeGpa;

    const banner = cumulative === undefined ? '' : `
      <div class="cumulative-gpa-banner">
        <span class="cumulative-label">Cumulative GPA</span>
        <span class="cumulative-value ${gpaColor(cumulative)}">${cumulative.toFixed(2)}</span>
      </div>
    `;

    const grid = this.semesters.length === 0
      ? this.renderEmpty()
      : this.semesters.map((s) => this.renderCard(s, s.id === currentId)).join('');

    document.getElementById('mainContent').innerHTML = `
      <div class="semester-list-page">
        <div class="page-header">
          <h1>My Semesters</h1>
          <button class="btn btn-primary" id="addSemesterBtn">+ New Semester</button>
        </div>
        ${banner}
        <div class="semesters-grid" id="semestersGrid">${grid}</div>
      </div>
    `;
  },

  renderEmpty() {
    return `
      <div class="empty-state" style="grid-column:1/-1">
        <h3 class="empty-state-title">No semesters yet</h3>
        <p class="empty-state-text">Create your first semester to start tracking your GPA.</p>
        <button class="btn btn-primary btn-lg" id="emptyAddBtn">Create Semester</button>
      </div>
    `;
  },

  renderCard(semester, isCurrent) {
    const gpaText = semester.semesterGpa === null || semester.semesterGpa === undefined
      ? '—'
      : semester.semesterGpa.toFixed(2);

    const goalBar = semester.gpaGoal !== null && semester.gpaGoalProgress !== null && semester.gpaGoal !== undefined
      ? `
        <div class="goal-bar-wrap">
          <div class="goal-bar-track">
            <div class="goal-bar-fill" style="width:${Math.min(100, (semester.gpaGoalProgress ?? 0) * 100).toFixed(0)}%"></div>
          </div>
          <span class="goal-label">Goal: ${semester.gpaGoal.toFixed(2)}</span>
        </div>
      `
      : '';

    return `
      <div class="semester-card ${isCurrent ? 'semester-card--active' : ''}" data-semester-id="${escapeHtml(semester.id)}">
        <div class="semester-card-header">
          <div>
            <h3 class="semester-name">${escapeHtml(semester.name)}</h3>
            <span class="semester-meta">
              ${escapeHtml(semester.term)} ${escapeHtml(semester.year)} ·
              ${semester.classCount} class${semester.classCount === 1 ? '' : 'es'}
            </span>
          </div>
          <div class="semester-gpa ${gpaColor(semester.semesterGpa)}">${gpaText}</div>
        </div>
        ${goalBar}
        <div class="semester-card-actions">
          <button class="btn btn-secondary btn-sm edit-semester-btn" data-id="${escapeHtml(semester.id)}">Edit</button>
          <button class="btn btn-danger btn-sm delete-semester-btn" data-id="${escapeHtml(semester.id)}">Delete</button>
          <button class="btn btn-primary btn-sm select-semester-btn" data-id="${escapeHtml(semester.id)}">
            ${isCurrent ? 'Selected' : 'View Classes'}
          </button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('addSemesterBtn')?.addEventListener('click', () => this.showAddModal());
    document.getElementById('emptyAddBtn')?.addEventListener('click', () => this.showAddModal());

    document.querySelectorAll('.edit-semester-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();

        const semester = this.semesters.find((s) => s.id === Number(button.dataset.id));
        if (semester) this.showEditModal(semester);
      });
    });

    document.querySelectorAll('.delete-semester-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();

        const semester = this.semesters.find((s) => s.id === Number(button.dataset.id));
        if (semester) await this.deleteSemester(semester);
      });
    });

    document.querySelectorAll('.select-semester-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();

        const id = Number(button.dataset.id);
        SemesterService.setCurrentSemesterId(id);
        navigate('landing', { semesterId: id });
      });
    });
  },

  async deleteSemester(semester) {
    const confirmed = await Modal.confirm({
      title: 'Delete Semester',
      // Corrected: the API detaches classes rather than deleting them (ON DELETE SET NULL).
      // The old copy warned that all grades would be destroyed, which was simply untrue and
      // would have scared people off a reversible action.
      message: `Delete "${semester.name}"? Its ${semester.classCount} class${semester.classCount === 1 ? '' : 'es'} will be kept and moved to "no semester" — no grades are lost.`,
      confirmText: 'Delete',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await SemesterService.remove(semester.id);

      if (SemesterService.getCurrentSemesterId() === semester.id) {
        SemesterService.setCurrentSemesterId(null);
      }

      await this.reload();
    } catch (error) {
      Modal.toast(error.message ?? 'Could not delete the semester.');
    }
  },

  showAddModal() {
    const year = new Date().getFullYear();

    Modal.show({
      title: 'New Semester',
      content: this.formFields({ name: `Fall ${year}`, term: 'Fall', year, gpaGoal: '' }, 'sem'),
      footer: `
        <button class="btn btn-secondary" id="cancelSem">Cancel</button>
        <button class="btn btn-primary" id="confirmSem">Create</button>
      `,
    });

    document.getElementById('cancelSem')?.addEventListener('click', () => Modal.hide());

    document.getElementById('confirmSem')?.addEventListener('click', async () => {
      const values = this.readForm('sem');
      if (!values) return;

      try {
        const created = await SemesterService.create(values);
        Modal.hide();
        SemesterService.setCurrentSemesterId(created.id);
        await this.reload();
      } catch (error) {
        Modal.toast(error.message ?? 'Could not create the semester.');
      }
    });
  },

  showEditModal(semester) {
    Modal.show({
      title: 'Edit Semester',
      content: this.formFields(
        { name: semester.name, term: semester.term, year: semester.year, gpaGoal: semester.gpaGoal ?? '' },
        'editSem',
      ),
      footer: `
        <button class="btn btn-secondary" id="cancelEditSem">Cancel</button>
        <button class="btn btn-primary" id="confirmEditSem">Save</button>
      `,
    });

    document.getElementById('cancelEditSem')?.addEventListener('click', () => Modal.hide());

    document.getElementById('confirmEditSem')?.addEventListener('click', async () => {
      const values = this.readForm('editSem');
      if (!values) return;

      try {
        await SemesterService.update(semester.id, {
          ...values,
          // Explicit flag so clearing the goal actually clears it rather than being read as
          // "field omitted, leave unchanged".
          clearGpaGoal: values.gpaGoal === null,
        });

        Modal.hide();
        await this.reload();
      } catch (error) {
        Modal.toast(error.message ?? 'Could not update the semester.');
      }
    });
  },

  formFields(values, prefix) {
    return `
      <div class="form-group">
        <label class="form-label" for="${prefix}Name">Semester Name</label>
        <input type="text" class="form-input" id="${prefix}Name" value="${escapeHtml(values.name)}"
               placeholder="e.g., Fall 2025" maxlength="120">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="${prefix}Term">Term</label>
          <select class="form-input" id="${prefix}Term">
            ${TERMS.map((term) => `<option value="${term}" ${values.term === term ? 'selected' : ''}>${term}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="${prefix}Year">Year</label>
          <input type="number" class="form-input" id="${prefix}Year" value="${escapeHtml(values.year)}" min="1900" max="2200">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="${prefix}Goal">GPA Goal <span class="form-label-hint">(optional)</span></label>
        <input type="number" class="form-input" id="${prefix}Goal" value="${escapeHtml(values.gpaGoal)}"
               placeholder="e.g., 3.5" min="0" max="4.33" step="0.01">
      </div>
    `;
  },

  /** Reads and validates the semester form. Returns null (after a toast) when invalid. */
  readForm(prefix) {
    const name = document.getElementById(`${prefix}Name`).value.trim();
    const term = document.getElementById(`${prefix}Term`).value;
    const year = Number.parseInt(document.getElementById(`${prefix}Year`).value, 10);
    const goalRaw = document.getElementById(`${prefix}Goal`).value;

    if (!name) {
      Modal.toast('Enter a semester name.');
      return null;
    }

    if (Number.isNaN(year) || year < 1900 || year > 2200) {
      Modal.toast('Enter a valid year.');
      return null;
    }

    const gpaGoal = goalRaw === '' ? null : Number.parseFloat(goalRaw);

    if (gpaGoal !== null && (Number.isNaN(gpaGoal) || gpaGoal < 0 || gpaGoal > 4.33)) {
      Modal.toast('The GPA goal must be between 0 and 4.33.');
      return null;
    }

    return { name, term, year, gpaGoal };
  },
};
