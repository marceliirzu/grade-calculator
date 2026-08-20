import { Api, unwrap } from './api.js';
import { Storage, STORAGE_KEYS } from '../core/storage.js';
import { aggregateGpa } from '../core/grading/engine.js';

/**
 * Thin wrappers over the API endpoints.
 *
 * These are intentionally dumb: they shape URLs and unwrap the response envelope, and that is
 * all. No calculation happens here — the old ClassService carried its own `calculateOverallGpa`
 * that duplicated (and disagreed with) the engine, so aggregation now delegates to the one
 * implementation.
 *
 * Note that the mutating endpoints return the *whole updated class*. That is deliberate on the
 * server side: after adding a grade, every category percentage, the class letter and the GPA
 * can all move, so returning the recomputed class avoids a second round trip and removes any
 * chance of the UI rendering a stale total next to a fresh row.
 */

export const ClassService = {
  getAll: (semesterId = null) =>
    Api.get(semesterId === null ? '/classes' : `/classes?semesterId=${semesterId}`).then(unwrap),

  getById: (id) => Api.get(`/classes/${id}`).then(unwrap),

  create: (data) => Api.post('/classes', data).then(unwrap),

  update: (id, data) => Api.put(`/classes/${id}`, data).then(unwrap),

  remove: (id) => Api.delete(`/classes/${id}`).then(unwrap),

  updateGradeScale: (classId, scale) => Api.put(`/classes/${classId}/grade-scale`, scale).then(unwrap),

  getGpa: (semesterId = null) =>
    Api.get(semesterId === null ? '/classes/gpa' : `/classes/gpa?semesterId=${semesterId}`).then(unwrap),

  getTarget: (classId, letter) =>
    Api.get(`/classes/${classId}/target/${encodeURIComponent(letter)}`).then(unwrap),

  /** Credit-weighted GPA over already-loaded classes, via the shared engine. */
  aggregate: (classes) =>
    aggregateGpa((classes ?? []).map((c) => ({ gpa: c.gpa, creditHours: c.creditHours }))),
};

export const CategoryService = {
  create: (data) => Api.post('/categories', data).then(unwrap),

  update: (id, data) => Api.put(`/categories/${id}`, data).then(unwrap),

  remove: (id) => Api.delete(`/categories/${id}`).then(unwrap),

  addRule: (categoryId, rule) => Api.post('/categories/rules', { categoryId, ...rule }).then(unwrap),

  removeRule: (ruleId) => Api.delete(`/categories/rules/${ruleId}`).then(unwrap),
};

export const GradeService = {
  create: (data) => Api.post('/grades', data).then(unwrap),

  update: (id, data) => Api.put(`/grades/${id}`, data).then(unwrap),

  remove: (id) => Api.delete(`/grades/${id}`).then(unwrap),

  /** Clears a score back to "not graded yet". Distinct from setting it to zero. */
  clearScore: (id) => Api.put(`/grades/${id}`, { clearPointsEarned: true }).then(unwrap),
};

const TERM_ORDER = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 };

export const SemesterService = {
  getAll: () => Api.get('/semesters').then(unwrap),

  getById: (id) => Api.get(`/semesters/${id}`).then(unwrap),

  create: (data) => Api.post('/semesters', data).then(unwrap),

  update: (id, data) => Api.put(`/semesters/${id}`, data).then(unwrap),

  remove: (id) => Api.delete(`/semesters/${id}`).then(unwrap),

  getCumulativeGpa: () => Api.get('/semesters/cumulative-gpa').then(unwrap),

  getCurrentSemesterId() {
    const value = Storage.get(STORAGE_KEYS.CURRENT_SEMESTER, null);
    return value === null ? null : Number(value);
  },

  setCurrentSemesterId(id) {
    if (id === null || id === undefined) Storage.remove(STORAGE_KEYS.CURRENT_SEMESTER);
    else Storage.set(STORAGE_KEYS.CURRENT_SEMESTER, id);
  },

  formatName: (semester) => semester.name || `${semester.term} ${semester.year}`,

  sortByRecent: (semesters) =>
    [...semesters].sort(
      (a, b) => b.year - a.year || (TERM_ORDER[b.term] ?? 0) - (TERM_ORDER[a.term] ?? 0),
    ),
};

export const SyllabusService = {
  parse: (syllabusText) => Api.post('/syllabus/parse', { syllabusText }).then(unwrap),
};

export const AccountService = {
  me: () => Api.get('/account/me').then(unwrap),

  llmQuota: () => Api.get('/account/llm-quota').then(unwrap),
};

/**
 * Grade advisor chat. History is held here and echoed back by the server, which returns the
 * trimmed transcript it actually used — so the client's copy stays in step with what the model
 * has seen rather than growing without bound.
 */
export const GradeAdvisorService = {
  _history: [],

  async chat(message, semesterId = null) {
    const data = await Api.post('/grade-advisor/chat', {
      message,
      semesterId,
      history: this._history,
    }).then(unwrap);

    if (Array.isArray(data?.updatedHistory)) this._history = data.updatedHistory;

    return data;
  },

  clearHistory() {
    this._history = [];
  },

  getHistory() {
    return [...this._history];
  },
};
