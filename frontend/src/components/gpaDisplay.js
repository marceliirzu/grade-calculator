import { Formatters, escapeHtml } from '../core/formatters.js';
import { letterForGpa } from '../core/grading/bands.js';
import { aggregateGpa } from '../core/grading/engine.js';
import { getAPlusValue } from '../core/preferences.js';

const DASH = '—';

/**
 * The GPA summary card.
 *
 * Aggregation goes through the shared engine rather than a local reduce, so the number here is
 * the same one the server computes and the same one guest mode computes.
 */
export const GpaDisplay = {
  render(classes, semester = null) {
    const overall = aggregateGpa(classes.map((c) => ({ gpa: c.gpa, creditHours: c.creditHours })));

    // Only classes that contribute are counted, so the credit total always reconciles with the
    // GPA printed above it.
    const totalCredits = classes
      .filter((c) => c.gpa !== null && c.gpa !== undefined)
      .reduce((sum, c) => sum + Number(c.creditHours), 0);

    const scaleLabel = getAPlusValue() === 4.33 ? '4.33' : '4.0';

    return `
      <div class="gpa-card">
        <div class="gpa-card-title">Overall GPA</div>
        <div class="gpa-value">
          ${escapeHtml(overall === null ? DASH : Formatters.gpa(overall))}
          <span class="gpa-scale">/ ${scaleLabel}</span>
        </div>

        <div class="gpa-details">
          <div class="gpa-detail-row"><span>Credits</span><span>${escapeHtml(totalCredits)}</span></div>
          <div class="gpa-detail-row"><span>Classes</span><span>${classes.length}</span></div>
        </div>

        ${semester ? this.renderSemesterSection(semester) : ''}
        ${classes.length > 0 ? this.renderClassList(classes) : ''}
      </div>
    `;
  },

  renderSemesterSection(semester) {
    const rows = [];

    const addRow = (label, value) => {
      if (value === null || value === undefined) return;

      const letter = letterForGpa(value);
      rows.push(`
        <div class="gpa-detail-row">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(Formatters.gpa(value))} ${letter ? `<small>(${escapeHtml(letter)})</small>` : ''}</span>
        </div>
      `);
    };

    addRow('Semester GPA', semester.semesterGpa);
    addRow('Cumulative GPA', semester.cumulativeGpa);

    const goalBar = semester.gpaGoal === null || semester.gpaGoal === undefined
      ? ''
      : this.renderGoalBar(semester);

    if (rows.length === 0 && !goalBar) return '';

    return `
      <div class="gpa-semester-section">
        <div class="gpa-details">${rows.join('')}</div>
        ${goalBar}
      </div>
    `;
  },

  renderGoalBar(semester) {
    const progress = Math.min(1, Math.max(0, semester.gpaGoalProgress ?? 0));
    const percent = (progress * 100).toFixed(1);

    const colorClass = progress >= 0.9 ? 'gpa-goal-green'
      : progress >= 0.7 ? 'gpa-goal-yellow'
      : 'gpa-goal-red';

    return `
      <div class="gpa-goal-bar-wrapper">
        <div class="gpa-goal-label">Goal: ${escapeHtml(Formatters.gpa(semester.gpaGoal))}</div>
        <div class="gpa-goal-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="gpa-goal-fill ${colorClass}" style="width:${percent}%"></div>
        </div>
        <div class="gpa-goal-pct">${percent}%</div>
      </div>
    `;
  },

  renderClassList(classes) {
    const items = classes.map((cls) => `
      <div class="class-summary-item">
        <span class="class-summary-name">${escapeHtml(Formatters.truncate(cls.name, 22))}</span>
        <span class="class-summary-grade ${Formatters.gradeColorClass(cls.letterGrade)}">
          ${escapeHtml(cls.letterGrade || DASH)}
        </span>
      </div>
    `).join('');

    return `<div class="class-summary-list">${items}</div>`;
  },
};
