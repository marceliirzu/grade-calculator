import { Formatters, escapeHtml } from '../core/formatters.js';
import { LETTERS, gpaPointsFor, normalizeScale } from '../core/grading/bands.js';

/**
 * Stateless render functions returning HTML strings.
 *
 * Every value that originated with a user — class names, category names, assignment titles —
 * is escaped. The originals escaped class names but not category or assignment names, which
 * left the two fields people paste imported text into unprotected.
 */

const DASH = '—';

export const ClassCard = {
  render(cls) {
    const letter = cls.letterGrade || DASH;
    const percentage = cls.currentGrade === null ? DASH : Formatters.percentage(cls.currentGrade);
    const credits = Number(cls.creditHours);

    return `
      <div class="card class-card" data-class-id="${escapeHtml(cls.id)}" role="button" tabindex="0">
        <div class="card-header">
          <div>
            <h3 class="card-title">${escapeHtml(cls.name)}</h3>
            <p class="card-subtitle">${escapeHtml(credits)} credit${credits === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div class="grade-display">
          <span class="letter-grade ${Formatters.gradeColorClass(letter)}">${escapeHtml(letter)}</span>
          <span class="percentage">${escapeHtml(percentage)}</span>
        </div>
      </div>
    `;
  },

  renderAddButton() {
    return `
      <button class="btn-add" id="addClassBtn">
        <span class="plus-icon">+</span>
        <span>Add Class</span>
      </button>
    `;
  },
};

export const CategoryCard = {
  render(category) {
    const grade = category.currentGrade === null ? DASH : Formatters.percentage(category.currentGrade);
    const itemCount = category.gradeItems?.length ?? 0;
    const counted = category.countedItemCount ?? itemCount;
    const graded = (category.gradeItems ?? []).filter((i) => i.pointsEarned !== null).length;

    // Surfaced so a drop-lowest rule explains itself rather than leaving the student to wonder
    // why the average does not match the scores on screen.
    const countedNote = counted > 0 && counted < graded
      ? `<div class="category-counted">best ${counted} of ${graded} count</div>`
      : '';

    return `
      <div class="category-card" data-category-id="${escapeHtml(category.id)}" role="button" tabindex="0">
        <div class="category-header">
          <h3 class="category-name">${escapeHtml(category.name)}</h3>
          <span class="category-weight">${escapeHtml(category.weight)}%</span>
        </div>
        <div class="category-body">
          <div class="category-grade">${escapeHtml(grade)}</div>
          <div class="category-items">${itemCount} grade${itemCount === 1 ? '' : 's'}</div>
          ${countedNote}
        </div>
        <div class="category-footer">
          <span class="click-hint">Manage grades →</span>
        </div>
      </div>
    `;
  },
};

export const GradeEntry = {
  render(item) {
    const percentage = item.percentage === null ? DASH : Formatters.percentage(item.percentage);

    return `
      <div class="grade-item ${item.isWhatIf ? 'what-if' : ''}" data-grade-id="${escapeHtml(item.id)}">
        <div class="grade-item-name">
          ${escapeHtml(item.name)}
          ${item.isWhatIf ? '<span class="what-if-badge">What If</span>' : ''}
        </div>
        <div class="grade-item-input">
          <input type="number" class="earned-input" inputmode="decimal"
                 aria-label="Points earned for ${escapeHtml(item.name)}"
                 value="${item.pointsEarned ?? ''}" placeholder="${DASH}" step="0.01" min="0">
          <span>/</span>
        </div>
        <div class="grade-item-input">
          <input type="number" class="possible-input" inputmode="decimal"
                 aria-label="Points possible for ${escapeHtml(item.name)}"
                 value="${escapeHtml(item.pointsPossible)}" step="0.01" min="0">
        </div>
        <div class="grade-item-percentage">${escapeHtml(percentage)}</div>
        <div class="grade-item-actions">
          <button class="btn btn-ghost btn-icon what-if-btn" title="Toggle what-if" aria-label="Toggle what-if">&#128302;</button>
          <button class="btn btn-ghost btn-icon delete-btn" title="Delete" aria-label="Delete grade">&#128465;</button>
        </div>
      </div>
    `;
  },

  renderEmpty() {
    return '<div class="empty-grades"><p>No grades yet. Click "Add Grade" to get started.</p></div>';
  },
};

export const RulesEditor = {
  render(rules = []) {
    const header = `
      <div class="rules-header">
        <h3 class="rules-title">Rules</h3>
        <button class="btn btn-secondary btn-sm" id="addRuleBtn">+ Add Rule</button>
      </div>
    `;

    if (rules.length === 0) {
      return `
        <div class="rules-section">
          ${header}
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">
            No rules applied. Add rules like "drop lowest" or "count highest".
          </p>
        </div>
      `;
    }

    const items = rules.map((rule) => `
      <div class="rule-item" data-rule-id="${escapeHtml(rule.id)}">
        <div class="rule-description">
          <span class="rule-icon">&#9881;</span>
          <span>${escapeHtml(Formatters.ruleDescription(rule))}</span>
        </div>
        <button class="btn btn-ghost btn-icon delete-rule-btn" title="Remove" aria-label="Remove rule">&#128465;</button>
      </div>
    `).join('');

    return `<div class="rules-section">${header}${items}</div>`;
  },
};

export const GradeScaleEditor = {
  render(gradeScale) {
    const scale = normalizeScale(gradeScale);

    // GPA points come from the engine so the column always reflects the class's own A+ value
    // rather than a hardcoded table that ignores the 4.33 setting.
    const rows = LETTERS.filter((letter) => letter !== 'F')
      .map((letter) => this.renderRow(letter, scale))
      .join('');

    return `
      <div class="grade-scale-editor">
        <div class="grade-scale-header">
          <h3 class="grade-scale-title">Grade Scale</h3>
        </div>
        <table class="grade-scale-table">
          <thead>
            <tr><th>Grade</th><th>Min %</th><th>GPA</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td class="grade-letter grade-f">F</td>
              <td>&lt; ${escapeHtml(scale.dMinus)}%</td>
              <td class="gpa-points">0.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  renderRow(letter, scale) {
    const key = {
      'A+': 'aPlus', A: 'a', 'A-': 'aMinus',
      'B+': 'bPlus', B: 'b', 'B-': 'bMinus',
      'C+': 'cPlus', C: 'c', 'C-': 'cMinus',
      'D+': 'dPlus', D: 'd', 'D-': 'dMinus',
    }[letter];

    return `
      <tr>
        <td class="grade-letter ${Formatters.gradeColorClass(letter)}">${escapeHtml(letter)}</td>
        <td>
          <input type="number" class="grade-input" data-grade="${key}"
                 aria-label="Minimum percentage for ${escapeHtml(letter)}"
                 value="${escapeHtml(scale[key])}" min="0" max="100" step="0.1">
        </td>
        <td class="gpa-points">${gpaPointsFor(letter, scale).toFixed(2)}</td>
      </tr>
    `;
  },

  /** Reads the edited thresholds back out of the DOM. */
  getValues(container, aPlusGpaValue) {
    const scale = { aPlusGpaValue };

    container.querySelectorAll('.grade-input').forEach((input) => {
      const value = Number.parseFloat(input.value);
      if (!Number.isNaN(value)) scale[input.dataset.grade] = value;
    });

    return normalizeScale(scale);
  },
};
