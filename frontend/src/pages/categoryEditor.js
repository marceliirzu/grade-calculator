import { Formatters, escapeHtml } from '../core/formatters.js';
import { ClassService, CategoryService, GradeService } from '../services/dataServices.js';
import { RulesEditor } from '../components/cards.js';
import { Modal } from '../components/modal.js';
import { navigate } from '../router.js';

const DASH = '—';

export const CategoryEditorPage = {
  classData: null,
  categoryData: null,

  async init(params = {}) {
    const { classId, categoryId } = params;

    if (!classId || !categoryId) {
      navigate('landing');
      return;
    }

    try {
      this.classData = await ClassService.getById(classId);
      this.categoryData = this.classData.categories.find((c) => c.id === Number(categoryId));
    } catch (error) {
      console.error('Failed to load category:', error);
      Modal.toast(error.message ?? 'Could not load that category.');
      navigate('landing');
      return;
    }

    if (!this.categoryData) {
      Modal.toast('That category no longer exists.');
      navigate('class', { classId });
      return;
    }

    this.render();
    this.bindEvents();
  },

  refresh() {
    return this.init({ classId: this.classData.id, categoryId: this.categoryData.id });
  },

  render() {
    const percentage = this.categoryData.currentGrade === null
      ? DASH
      : Formatters.percentage(this.categoryData.currentGrade);

    const items = this.categoryData.gradeItems ?? [];
    const graded = items.filter((i) => i.pointsEarned !== null).length;
    const counted = this.categoryData.countedItemCount ?? graded;

    // When a drop rule is active, say so next to the average. Otherwise the number looks wrong
    // relative to the scores listed directly beneath it.
    const countedNote = counted > 0 && counted < graded
      ? `<span>·</span><span>best ${counted} of ${graded} counted</span>`
      : '';

    document.getElementById('mainContent').innerHTML = `
      <div class="category-editor-page">
        <nav class="breadcrumb">
          <a href="#" id="backToLanding">Classes</a>
          <span class="breadcrumb-separator">/</span>
          <a href="#" id="backToClass">${escapeHtml(this.classData.name)}</a>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">${escapeHtml(this.categoryData.name)}</span>
        </nav>

        <header class="category-header">
          <div class="category-info">
            <h1>${escapeHtml(this.categoryData.name)}</h1>
            <div class="category-meta">
              <span>Weight: ${escapeHtml(this.categoryData.weight)}%</span>
              <span>·</span>
              <span>${items.length} item${items.length === 1 ? '' : 's'}</span>
              ${countedNote}
            </div>
          </div>
          <div class="category-grade-display">
            <div class="category-percentage">${escapeHtml(percentage)}</div>
          </div>
        </header>

        <section class="grade-items-section">
          <div class="grade-items-header">
            <span class="grade-items-title">Grades</span>
            <div style="display: flex; gap: var(--spacing-2);">
              <button class="btn btn-secondary btn-sm" id="importGradesBtn">Import</button>
              <button class="btn btn-primary btn-sm" id="addGradeBtn">+ Add</button>
            </div>
          </div>
          <div id="gradeItemsList">${this.renderGradeItems()}</div>
        </section>

        ${RulesEditor.render(this.categoryData.rules)}
      </div>
    `;
  },

  renderGradeItems() {
    const items = this.categoryData.gradeItems ?? [];

    if (items.length === 0) {
      return '<div class="empty-grades"><p>No grades yet. Add grades or import from your gradebook.</p></div>';
    }

    return items.map((item) => this.renderGradeItem(item)).join('');
  },

  renderGradeItem(item) {
    const percentage = item.percentage === null ? DASH : Formatters.percentage(item.percentage);

    const colorClass = item.percentage === null
      ? ''
      : Formatters.gradeColorClass(Formatters.letterGrade(item.percentage, this.classData.gradeScale));

    return `
      <div class="grade-item ${item.isWhatIf ? 'what-if' : ''}" data-grade-id="${escapeHtml(item.id)}">
        <div class="grade-item-name">
          <input type="text" class="name-input" value="${escapeHtml(item.name)}" placeholder="Grade name" maxlength="200"
                 aria-label="Grade name">
          ${item.isWhatIf ? '<span class="what-if-badge">What If</span>' : ''}
        </div>
        <div class="grade-item-score">
          <input type="number" class="earned-input" value="${item.pointsEarned ?? ''}" placeholder="${DASH}"
                 step="0.01" min="0" inputmode="decimal" aria-label="Points earned">
          <span class="divider">/</span>
          <input type="number" class="possible-input" value="${escapeHtml(item.pointsPossible)}"
                 step="0.01" min="0" inputmode="decimal" aria-label="Points possible">
        </div>
        <div class="grade-item-percentage ${colorClass}">${escapeHtml(percentage)}</div>
        <div class="grade-item-actions">
          <button class="btn btn-ghost btn-icon what-if-btn" title="Toggle what-if" aria-label="Toggle what-if">&#128302;</button>
          <button class="btn btn-ghost btn-icon delete-btn" title="Delete" aria-label="Delete grade">&#128465;</button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('backToLanding')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('landing', { semesterId: this.classData.semesterId });
    });

    document.getElementById('backToClass')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('class', { classId: this.classData.id });
    });

    document.getElementById('addGradeBtn')?.addEventListener('click', () => this.addGrade());
    document.getElementById('importGradesBtn')?.addEventListener('click', () => this.importGrades());
    document.getElementById('addRuleBtn')?.addEventListener('click', () => this.showAddRule());

    const list = document.getElementById('gradeItemsList');

    // Delegated so the handlers survive a re-render without being rebound per row.
    list?.addEventListener('change', (event) => {
      const row = event.target.closest('.grade-item');
      if (!row) return;

      if (
        event.target.classList.contains('name-input') ||
        event.target.classList.contains('earned-input') ||
        event.target.classList.contains('possible-input')
      ) {
        this.saveRow(Number(row.dataset.gradeId), row);
      }
    });

    list?.addEventListener('click', (event) => {
      const row = event.target.closest('.grade-item');
      if (!row) return;

      const gradeId = Number(row.dataset.gradeId);

      if (event.target.closest('.what-if-btn')) this.toggleWhatIf(gradeId);
      else if (event.target.closest('.delete-btn')) this.deleteGrade(gradeId);
    });

    document.querySelectorAll('.delete-rule-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const ruleId = Number(button.closest('.rule-item').dataset.ruleId);
        this.deleteRule(ruleId);
      });
    });
  },

  async addGrade() {
    const count = this.categoryData.gradeItems?.length ?? 0;

    try {
      await GradeService.create({
        categoryId: this.categoryData.id,
        name: `Grade ${count + 1}`,
        pointsEarned: null,
        pointsPossible: 100,
        isWhatIf: false,
      });

      await this.refresh();
    } catch (error) {
      Modal.toast(error.message ?? 'Could not add the grade.');
    }
  },

  async importGrades() {
    const grades = await Modal.showGradebookImport();
    if (!grades || grades.length === 0) return;

    let imported = 0;

    // Sequential rather than Promise.all: each create returns the recomputed class, and firing
    // dozens of concurrent writes against one row set invites lost updates.
    for (const grade of grades) {
      try {
        await GradeService.create({
          categoryId: this.categoryData.id,
          name: grade.name,
          pointsEarned: grade.pointsEarned,
          pointsPossible: grade.pointsPossible,
          isWhatIf: false,
        });

        imported += 1;
      } catch (error) {
        console.error('Failed to import one grade:', error);
      }
    }

    Modal.toast(
      imported === grades.length
        ? `Imported ${imported} grade${imported === 1 ? '' : 's'}.`
        : `Imported ${imported} of ${grades.length}. Some rows could not be saved.`,
    );

    await this.refresh();
  },

  /** Persists a single row's three editable fields. */
  async saveRow(gradeId, row) {
    const name = row.querySelector('.name-input').value.trim();
    const earnedRaw = row.querySelector('.earned-input').value;
    const possible = Number.parseFloat(row.querySelector('.possible-input').value);

    const cleared = earnedRaw === '';
    const earned = cleared ? null : Number.parseFloat(earnedRaw);

    if (!cleared && Number.isNaN(earned)) {
      Modal.toast('That score is not a number.');
      return;
    }

    if (Number.isNaN(possible) || possible < 0) {
      Modal.toast('Points possible must be zero or more.');
      return;
    }

    try {
      const updated = await GradeService.update(gradeId, {
        name,
        // The explicit flag is how the API distinguishes "clear this score" from "leave it
        // alone" — a bare null is ambiguous over JSON.
        clearPointsEarned: cleared,
        pointsEarned: cleared ? null : earned,
        pointsPossible: possible,
      });

      // Patch the numbers in place rather than re-rendering the page.
      //
      // Editing a score used to call refresh(), which re-fetched and rebuilt the entire DOM on
      // every field blur. Entering a term's worth of grades is the main thing people do here,
      // and a full rebuild between each one reads as the page reloading under you — it also
      // drops focus, so tabbing from one score to the next stopped working.
      this.applyClassUpdate(updated);
    } catch (error) {
      Modal.toast(error.message ?? 'Could not save that grade.');
    }
  },

  /**
   * Refreshes the derived numbers from a server response without touching structure.
   *
   * Only values the server recomputed are written: the per-item percentages and the category
   * total. Rows are never added, removed or reordered here — those paths still re-render, since
   * the DOM genuinely changed shape.
   */
  applyClassUpdate(updated) {
    if (!updated) return;

    const category = updated.categories?.find((c) => c.id === this.categoryData.id);
    if (!category) return;

    // Keep the in-memory copies in step, so a later full render starts from the truth.
    this.classData = updated;
    this.categoryData = category;

    const header = document.querySelector('.category-percentage');
    if (header) {
      header.textContent = category.currentGrade === null
        ? DASH
        : Formatters.percentage(category.currentGrade);
    }

    for (const item of category.gradeItems ?? []) {
      const cell = document.querySelector(
        `.grade-item[data-grade-id="${item.id}"] .grade-item-percentage`,
      );

      if (!cell) continue;

      cell.textContent = item.percentage === null ? DASH : Formatters.percentage(item.percentage);

      // The colour band can move with the score, so the class is rewritten rather than added to.
      cell.className = 'grade-item-percentage';

      if (item.percentage !== null) {
        const colorClass = Formatters.gradeColorClass(
          Formatters.letterGrade(item.percentage, this.classData.gradeScale),
        );

        if (colorClass) cell.classList.add(colorClass);
      }
    }
  },

  async toggleWhatIf(gradeId) {
    const item = this.categoryData.gradeItems.find((g) => g.id === gradeId);
    if (!item) return;

    try {
      await GradeService.update(gradeId, { isWhatIf: !item.isWhatIf });
      await this.refresh();
    } catch (error) {
      Modal.toast(error.message ?? 'Could not toggle what-if.');
    }
  },

  async deleteGrade(gradeId) {
    const confirmed = await Modal.confirm({
      title: 'Delete Grade',
      message: 'Delete this grade? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await GradeService.remove(gradeId);
      await this.refresh();
    } catch (error) {
      Modal.toast(error.message ?? 'Could not delete the grade.');
    }
  },

  async deleteRule(ruleId) {
    try {
      await CategoryService.removeRule(ruleId);
      await this.refresh();
    } catch (error) {
      Modal.toast(error.message ?? 'Could not remove the rule.');
    }
  },

  showAddRule() {
    Modal.show({
      title: 'Add Rule',
      content: `
        <div class="form-group">
          <label class="form-label" for="ruleType">Rule Type</label>
          <select class="form-input" id="ruleType">
            <option value="DropLowest">Drop Lowest</option>
            <option value="CountHighest">Count Highest</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ruleValue">Number of Grades</label>
          <input type="number" class="form-input" id="ruleValue" value="1" min="0" max="100">
          <p class="form-help">How many grades to drop, or how many of the best to count.</p>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="cancelRule">Cancel</button>
        <button class="btn btn-primary" id="addRule">Add Rule</button>
      `,
    });

    document.getElementById('cancelRule')?.addEventListener('click', () => Modal.hide());

    document.getElementById('addRule')?.addEventListener('click', async () => {
      const type = document.getElementById('ruleType').value;
      const value = Number.parseInt(document.getElementById('ruleValue').value, 10);

      if (Number.isNaN(value) || value < 0) {
        Modal.toast('Enter a whole number of grades.');
        return;
      }

      try {
        await CategoryService.addRule(this.categoryData.id, { type, value });
        Modal.hide();
        await this.refresh();
      } catch (error) {
        Modal.toast(error.message ?? 'Could not add the rule.');
      }
    });
  },
};
