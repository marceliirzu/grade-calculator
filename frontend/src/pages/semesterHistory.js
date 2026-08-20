import { Formatters, escapeHtml } from '../core/formatters.js';
import { letterForGpa } from '../core/grading/bands.js';
import { AuthService } from '../services/auth.js';
import { SemesterService } from '../services/dataServices.js';
import { Modal } from '../components/modal.js';
import { navigate } from '../router.js';

/** Highest GPA a 4.33 scale can reach, used to scale the trend chart. */
const MAX_GPA = 4.33;

const TERM_ORDER = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 };

const gpaColor = (gpa) =>
  gpa === null || gpa === undefined ? '' : Formatters.gradeColorClass(letterForGpa(gpa));

export const SemesterHistoryPage = {
  semesters: [],

  async init() {
    if (!AuthService.isAuthenticated()) {
      navigate('landing');
      return;
    }

    document.getElementById('mainContent').innerHTML = `
      <div class="semester-history-page">
        <nav class="breadcrumb"><a href="#" id="backToSemesters">← Semesters</a></nav>
        <h1>GPA History</h1>
        <div class="skeleton-card" style="height:200px;border-radius:12px;"></div>
      </div>
    `;

    document.getElementById('backToSemesters')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('semesterList');
    });

    try {
      this.semesters = (await SemesterService.getAll()) ?? [];
    } catch (error) {
      this.semesters = [];
      Modal.toast(error.message ?? 'Could not load your history.');
    }

    this.render();
    this.bindEvents();
  },

  render() {
    // Chronological, oldest first, so the trend chart reads left to right. Ordered by an
    // explicit term rank rather than by first letter — the old comparison sorted on
    // charCodeAt(0), which puts Summer before Spring and Fall before either.
    const sorted = [...this.semesters].sort(
      (a, b) => a.year - b.year || (TERM_ORDER[a.term] ?? 0) - (TERM_ORDER[b.term] ?? 0),
    );

    const graded = sorted.filter((s) => s.semesterGpa !== null && s.semesterGpa !== undefined);
    const cumulative = this.semesters.find((s) => s.cumulativeGpa !== null && s.cumulativeGpa !== undefined)?.cumulativeGpa;
    const best = graded.length > 0 ? Math.max(...graded.map((s) => s.semesterGpa)) : null;

    document.getElementById('mainContent').innerHTML = `
      <div class="semester-history-page">
        <nav class="breadcrumb"><a href="#" id="backToSemesters">← Semesters</a></nav>
        <h1>GPA History</h1>

        ${cumulative === undefined ? '' : `
          <div class="history-summary-card">
            <div class="history-stat">
              <span class="history-stat-label">Cumulative GPA</span>
              <span class="history-stat-value ${gpaColor(cumulative)}">${cumulative.toFixed(2)}</span>
            </div>
            <div class="history-stat">
              <span class="history-stat-label">Semesters Tracked</span>
              <span class="history-stat-value">${this.semesters.length}</span>
            </div>
            <div class="history-stat">
              <span class="history-stat-label">Best Semester</span>
              <span class="history-stat-value ${gpaColor(best)}">${best === null ? '—' : best.toFixed(2)}</span>
            </div>
          </div>
        `}

        ${graded.length === 0 ? '' : this.renderChart(graded)}

        <div class="history-table-card">
          <h2>All Semesters</h2>
          <div class="history-table">
            <div class="history-table-header">
              <span>Semester</span><span>Classes</span><span>GPA</span><span>Goal</span><span></span>
            </div>
            ${sorted.length === 0
              ? '<div class="history-empty">No semesters yet.</div>'
              : sorted.map((s) => this.renderRow(s)).join('')}
          </div>
        </div>
      </div>
    `;
  },

  renderChart(graded) {
    const width = 100 / Math.max(graded.length, 1);

    const bars = graded.map((semester) => {
      const height = (semester.semesterGpa / MAX_GPA) * 100;

      return `
        <div class="history-bar-group" style="width:${width}%">
          <div class="history-bar-wrap">
            <div class="history-bar-value">${semester.semesterGpa.toFixed(2)}</div>
            <div class="history-bar ${gpaColor(semester.semesterGpa)}" style="height:${height.toFixed(0)}%"></div>
          </div>
          <div class="history-bar-label">
            ${escapeHtml(semester.term.substring(0, 2))} '${escapeHtml(String(semester.year).slice(-2))}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="history-chart-card">
        <h2 class="history-chart-title">Semester GPA Trend</h2>
        <div class="history-chart">${bars}</div>
      </div>
    `;
  },

  renderRow(semester) {
    const gpa = semester.semesterGpa === null || semester.semesterGpa === undefined
      ? '—'
      : semester.semesterGpa.toFixed(2);

    const goal = semester.gpaGoal === null || semester.gpaGoal === undefined
      ? '—'
      : semester.gpaGoal.toFixed(2);

    return `
      <div class="history-table-row" data-semester-id="${escapeHtml(semester.id)}">
        <span class="history-sem-name">${escapeHtml(semester.name)}</span>
        <span class="history-classes">${semester.classCount} class${semester.classCount === 1 ? '' : 'es'}</span>
        <span class="history-gpa ${gpaColor(semester.semesterGpa)}">${gpa}</span>
        <span class="history-goal">${goal}</span>
        <span><button class="btn btn-secondary btn-sm view-sem-btn" data-id="${escapeHtml(semester.id)}">View</button></span>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('backToSemesters')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('semesterList');
    });

    document.querySelectorAll('.view-sem-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id);
        SemesterService.setCurrentSemesterId(id);
        navigate('landing', { semesterId: id });
      });
    });
  },
};
