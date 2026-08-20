import { escapeHtml } from '../core/formatters.js';
import { parseSyllabusLocally } from '../core/syllabusParser.js';
import { parseGradebook } from '../core/gradebookParser.js';
import { SyllabusService } from '../services/dataServices.js';

/**
 * Modal and toast host.
 *
 * Every interpolation of user-supplied text goes through `escapeHtml`. The previous version
 * injected parsed syllabus values and imported assignment names directly into template
 * literals, so pasting a syllabus containing `<img src=x onerror=...>` executed script in the
 * page — and the syllabus is exactly the field people paste unfamiliar content into.
 */

let container = null;
let escapeListener = null;

function ensureContainer() {
  if (!container) container = document.getElementById('modalContainer');
  return container;
}

function bindDismiss(onDismiss) {
  const host = ensureContainer();

  host.querySelector('.modal-backdrop')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) onDismiss();
  });

  // Escape closes the dialog. Registered per-open and torn down on hide so dialogs cannot
  // stack listeners that fire after their own modal is gone.
  escapeListener = (event) => {
    if (event.key === 'Escape') onDismiss();
  };

  document.addEventListener('keydown', escapeListener);
}

export const Modal = {
  init() {
    container = document.getElementById('modalContainer');
  },

  show({ title, content, footer, wide = false }, onDismiss = () => this.hide()) {
    const host = ensureContainer();

    host.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal ${wide ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="modal-header">
            <h2 class="modal-title">${escapeHtml(title)}</h2>
          </div>
          <div class="modal-body">${content}</div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>
    `;

    host.style.display = 'block';
    bindDismiss(onDismiss);

    // Move focus into the dialog so keyboard and screen-reader users are not left behind on
    // the page underneath.
    host.querySelector('input, textarea, button')?.focus();
  },

  hide() {
    const host = ensureContainer();

    host.style.display = 'none';
    host.innerHTML = '';

    if (escapeListener) {
      document.removeEventListener('keydown', escapeListener);
      escapeListener = null;
    }
  },

  confirm({ title, message, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const settle = (value) => {
        this.hide();
        resolve(value);
      };

      this.show(
        {
          title,
          content: `<p class="confirm-message">${escapeHtml(message)}</p>`,
          footer: `
            <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmBtn">${escapeHtml(confirmText)}</button>
          `,
        },
        () => settle(false),
      );

      document.getElementById('cancelBtn')?.addEventListener('click', () => settle(false));
      document.getElementById('confirmBtn')?.addEventListener('click', () => settle(true));
    });
  },

  prompt({ title, label, value = '', placeholder = '', confirmText = 'Save', type = 'text' }) {
    return new Promise((resolve) => {
      const settle = (result) => {
        this.hide();
        resolve(result);
      };

      this.show(
        {
          title,
          content: `
            <div class="form-group">
              <label class="form-label" for="promptInput">${escapeHtml(label)}</label>
              <input class="form-input" id="promptInput" type="${escapeHtml(type)}"
                     value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
            </div>
          `,
          footer: `
            <button class="btn btn-secondary" id="promptCancel">Cancel</button>
            <button class="btn btn-primary" id="promptOk">${escapeHtml(confirmText)}</button>
          `,
        },
        () => settle(null),
      );

      const input = document.getElementById('promptInput');
      input?.select();

      const submit = () => settle(input?.value ?? null);

      document.getElementById('promptCancel')?.addEventListener('click', () => settle(null));
      document.getElementById('promptOk')?.addEventListener('click', submit);
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') submit();
      });
    });
  },

  // ---------------------------------------------------------------------
  // Syllabus import
  // ---------------------------------------------------------------------

  showSyllabusPaste({ aiAvailable = true } = {}) {
    return new Promise((resolve) => {
      // "Smart" parses in the browser with instant preview and costs nothing. "AI" posts to the
      // server, which still runs its own deterministic pass first and only reaches a model if
      // that fails — so choosing AI does not guarantee tokens are spent.
      let activeTab = 'smart';

      const settle = (result) => {
        this.hide();
        resolve(result);
      };

      const render = () => {
        const host = ensureContainer();

        host.innerHTML = `
          <div class="modal-backdrop">
            <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="Import from syllabus">
              <div class="modal-header">
                <h2 class="modal-title">Import from Syllabus</h2>
              </div>
              <div class="modal-body" id="syllabusModalBody">
                <div class="parser-tabs">
                  <button class="parser-tab ${activeTab === 'smart' ? 'active' : ''}" data-tab="smart">Smart Parse</button>
                  ${aiAvailable ? `<button class="parser-tab ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai">AI Parse</button>` : ''}
                </div>

                <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                  ${activeTab === 'smart'
                    ? 'Reads the grading table directly in your browser. Instant, private, and free.'
                    : 'Sends your syllabus to the server, which reads it directly first and only uses AI if that fails.'}
                </p>

                <textarea class="syllabus-textarea" id="syllabusText" placeholder="Paste your syllabus here...

Example:
MATH 101 - Introduction to Calculus
3 Credit Hours

Grading:
- Homework: 25%
- Quizzes: 15%
- Midterm Exam: 25%
- Final Exam: 35%

Grade Scale:
A: 90-100%
B: 80-89%
C: 70-79%"></textarea>

                <div id="parsePreview"></div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" id="skipSyllabus">Skip</button>
                <button class="btn btn-primary" id="parseSyllabus">
                  ${activeTab === 'smart' ? 'Parse & Continue' : 'Analyze with AI'}
                </button>
              </div>
            </div>
          </div>
        `;

        host.style.display = 'block';
        bindDismiss(() => settle(null));

        host.querySelectorAll('.parser-tab').forEach((tab) => {
          tab.addEventListener('click', () => {
            activeTab = tab.dataset.tab;
            render();
          });
        });

        const textarea = document.getElementById('syllabusText');
        textarea?.focus();

        if (activeTab === 'smart') {
          let debounce;

          textarea?.addEventListener('input', () => {
            clearTimeout(debounce);
            // Debounced so a long syllabus is not re-parsed on every keystroke.
            debounce = setTimeout(() => this._renderParsePreview(textarea.value), 400);
          });
        }

        document.getElementById('skipSyllabus')?.addEventListener('click', () => settle(null));

        document.getElementById('parseSyllabus')?.addEventListener('click', async () => {
          const text = textarea?.value.trim() ?? '';

          if (!text) {
            this.toast('Paste your syllabus text first.');
            return;
          }

          if (activeTab === 'smart') {
            const result = parseSyllabusLocally(text);

            if (result.categories.length > 0) settle(result);
            else this.toast('No grading categories found. Try AI Parse, or enter them manually.');

            return;
          }

          this._renderAiLoading();

          try {
            settle(await SyllabusService.parse(text));
          } catch (error) {
            this._renderAiError(error, settle, render);
          }
        });
      };

      render();
    });
  },

  _renderParsePreview(text) {
    const preview = document.getElementById('parsePreview');
    if (!preview) return;

    if (!text.trim()) {
      preview.innerHTML = '';
      return;
    }

    const result = parseSyllabusLocally(text);

    if (result.categories.length === 0) {
      preview.innerHTML = '';
      return;
    }

    const rows = [];

    if (result.className) {
      rows.push(`<div class="parse-preview-item"><span>Class</span><span class="parse-preview-value">${escapeHtml(result.className)}</span></div>`);
    }

    if (result.creditHours !== null) {
      rows.push(`<div class="parse-preview-item"><span>Credits</span><span class="parse-preview-value">${escapeHtml(result.creditHours)}</span></div>`);
    }

    for (const category of result.categories) {
      rows.push(`<div class="parse-preview-item"><span>${escapeHtml(category.name)}</span><span class="parse-preview-value">${escapeHtml(category.weight)}%</span></div>`);
    }

    if (result.gradeScale) {
      rows.push('<div class="parse-preview-item"><span>Grade Scale</span><span class="parse-preview-value">Custom detected</span></div>');
    }

    for (const note of result.notes) {
      rows.push(`<div class="parse-preview-item"><span style="color: var(--color-text-muted);">${escapeHtml(note)}</span><span></span></div>`);
    }

    preview.innerHTML = `<div class="parse-preview"><div class="parse-preview-title">Detected Info</div>${rows.join('')}</div>`;
  },

  _renderAiLoading() {
    const body = document.getElementById('syllabusModalBody');

    if (body) {
      body.innerHTML = `
        <div class="ai-processing">
          <div class="loading-spinner"></div>
          <p style="margin-top: var(--spacing-4);">Analyzing your syllabus...</p>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-xs); margin-top: var(--spacing-2);">This usually takes a few seconds</p>
        </div>
      `;
    }

    const footer = ensureContainer().querySelector('.modal-footer');
    if (footer) footer.style.display = 'none';
  },

  _renderAiError(error, settle, rerender) {
    const body = document.getElementById('syllabusModalBody');

    if (body) {
      body.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-8);">
          <p style="color: var(--color-danger); font-size: var(--font-size-lg); margin-bottom: var(--spacing-3);">Analysis failed</p>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-4);">
            ${escapeHtml(error?.message ?? 'Try Smart Parse instead, or enter the categories manually.')}
          </p>
        </div>
      `;
    }

    const footer = ensureContainer().querySelector('.modal-footer');

    if (footer) {
      footer.style.display = 'flex';
      footer.innerHTML = `
        <button class="btn btn-secondary" id="skipAfterError">Enter Manually</button>
        <button class="btn btn-primary" id="retrySyllabus">Try Again</button>
      `;

      document.getElementById('skipAfterError')?.addEventListener('click', () => settle(null));
      document.getElementById('retrySyllabus')?.addEventListener('click', () => rerender());
    }
  },

  // ---------------------------------------------------------------------
  // Gradebook import
  // ---------------------------------------------------------------------

  showGradebookImport() {
    return new Promise((resolve) => {
      const settle = (result) => {
        this.hide();
        resolve(result);
      };

      const host = ensureContainer();

      host.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal modal-lg" role="dialog" aria-modal="true" aria-label="Import grades">
            <div class="modal-header">
              <h2 class="modal-title">Import Grades</h2>
            </div>
            <div class="modal-body">
              <p style="color: var(--color-text-muted); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm);">
                Paste grades from Canvas, Blackboard, or any spreadsheet. Supports CSV, tab-separated, or "Name: score/total".
              </p>
              <textarea class="syllabus-textarea" id="gradebookText" style="min-height: 220px;" placeholder="Paste your grades here...

Examples:
Homework 1: 85/100
Quiz 1: 18/20

Or CSV:
Assignment, Score, Possible
Homework 1, 85, 100"></textarea>
              <div id="gradebookPreview"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="cancelImport">Cancel</button>
              <button class="btn btn-primary" id="importGrades">Import Grades</button>
            </div>
          </div>
        </div>
      `;

      host.style.display = 'block';
      bindDismiss(() => settle([]));

      const textarea = document.getElementById('gradebookText');
      textarea?.focus();

      let debounce;

      textarea?.addEventListener('input', () => {
        clearTimeout(debounce);

        debounce = setTimeout(() => {
          const grades = parseGradebook(textarea.value);
          const preview = document.getElementById('gradebookPreview');
          if (!preview) return;

          if (grades.length === 0) {
            preview.innerHTML = '';
            return;
          }

          const shown = grades.slice(0, 8).map((grade) => `
            <div class="parse-preview-item">
              <span>${escapeHtml(grade.name)}</span>
              <span class="parse-preview-value">${grade.pointsEarned ?? '—'}/${escapeHtml(grade.pointsPossible)}</span>
            </div>
          `).join('');

          const overflow = grades.length > 8
            ? `<div class="parse-preview-item"><span style="color: var(--color-text-muted);">...and ${grades.length - 8} more</span><span></span></div>`
            : '';

          preview.innerHTML = `
            <div class="parse-preview">
              <div class="parse-preview-title">Found ${grades.length} grade${grades.length === 1 ? '' : 's'}</div>
              ${shown}${overflow}
            </div>
          `;
        }, 400);
      });

      document.getElementById('cancelImport')?.addEventListener('click', () => settle([]));

      document.getElementById('importGrades')?.addEventListener('click', () => {
        const grades = parseGradebook(textarea?.value ?? '');

        if (grades.length > 0) settle(grades);
        else this.toast('No grades detected. Check the format and try again.');
      });
    });
  },

  /** Transient status message. Announced politely so screen readers pick it up. */
  toast(message) {
    document.querySelector('.modal-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'modal-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  },
};
