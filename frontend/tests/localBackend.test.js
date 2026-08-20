import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Guest-mode backend tests.
 *
 * A minimal in-memory localStorage is installed before the module under test is imported, so
 * these run in the plain node environment without pulling in jsdom for one API.
 */
const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

const { LocalBackend } = await import('../src/services/localBackend.js');

/** Unwraps the API envelope, failing loudly so a broken call cannot pass as an empty result. */
async function call(method, endpoint, body = null) {
  const response = await LocalBackend.handle(method, endpoint, body);

  if (!response.success) {
    throw new Error(`${method} ${endpoint} failed: ${response.message}`);
  }

  return response.data;
}

beforeEach(() => store.clear());

describe('guest backend: classes', () => {
  it('creates a class with default categories and no grade yet', async () => {
    const created = await call('POST', '/classes', { name: 'Calculus I', creditHours: 4 });

    expect(created.name).toBe('Calculus I');
    expect(created.creditHours).toBe(4);
    expect(created.categories).toHaveLength(3);

    // Nothing is graded, so the grade must be null rather than 0 — a 0 would read as failing.
    expect(created.currentGrade).toBeNull();
    expect(created.gpa).toBeNull();
  });

  it('computes the class grade through the shared engine', async () => {
    const cls = await call('POST', '/classes', { name: 'Physics', creditHours: 3 });
    const category = cls.categories[0];

    // Give one category (weight 30) a 90%, leaving the rest ungraded.
    await call('POST', '/grades', {
      categoryId: category.id, name: 'HW 1', pointsEarned: 90, pointsPossible: 100,
    });

    const updated = await call('GET', `/classes/${cls.id}`);

    // Only the graded category participates, so the class sits at 90% — not 27%.
    expect(updated.currentGrade).toBe(90);
    expect(updated.letterGrade).toBe('A-');
    expect(updated.gpa).toBe(3.67);
  });

  it('applies a drop-lowest rule', async () => {
    const cls = await call('POST', '/classes', { name: 'Chem', creditHours: 3 });
    const category = cls.categories[0];

    for (const score of [60, 80, 100]) {
      await call('POST', '/grades', {
        categoryId: category.id, name: `Quiz ${score}`, pointsEarned: score, pointsPossible: 100,
      });
    }

    await call('POST', '/categories/rules', {
      categoryId: category.id, type: 'DropLowest', value: 1,
    });

    const updated = await call('GET', `/classes/${cls.id}`);

    // 60 is dropped, leaving 180/200.
    expect(updated.categories[0].currentGrade).toBe(90);
    expect(updated.categories[0].countedItemCount).toBe(2);
  });

  it('replaces rather than stacks a second rule of the same kind', async () => {
    const cls = await call('POST', '/classes', { name: 'Bio', creditHours: 3 });
    const category = cls.categories[0];

    await call('POST', '/categories/rules', { categoryId: category.id, type: 'DropLowest', value: 1 });
    await call('POST', '/categories/rules', { categoryId: category.id, type: 'DropLowest', value: 2 });

    const updated = await call('GET', `/classes/${cls.id}`);

    expect(updated.categories[0].rules).toHaveLength(1);
    expect(updated.categories[0].rules[0].value).toBe(2);
  });

  it('clears a score back to ungraded', async () => {
    const cls = await call('POST', '/classes', { name: 'Stats', creditHours: 3 });
    const category = cls.categories[0];

    const withGrade = await call('POST', '/grades', {
      categoryId: category.id, name: 'Exam', pointsEarned: 75, pointsPossible: 100,
    });

    const itemId = withGrade.categories[0].gradeItems[0].id;

    const cleared = await call('PUT', `/grades/${itemId}`, { clearPointsEarned: true });

    expect(cleared.categories[0].gradeItems[0].pointsEarned).toBeNull();
    expect(cleared.currentGrade).toBeNull();
  });

  it('reports 404 for a class that does not exist', async () => {
    const response = await LocalBackend.handle('GET', '/classes/9999', null);

    expect(response.success).toBe(false);
    expect(response.status).toBe(404);
  });
});

describe('guest backend: semesters', () => {
  it('keeps classes when their semester is deleted', async () => {
    const semester = await call('POST', '/semesters', { name: 'Fall 2025', year: 2025, term: 'Fall' });
    const cls = await call('POST', '/classes', { name: 'History', creditHours: 3, semesterId: semester.id });

    await call('DELETE', `/semesters/${semester.id}`);

    // Matching the server's ON DELETE SET NULL: deleting a term must not destroy its grades.
    const survivor = await call('GET', `/classes/${cls.id}`);

    expect(survivor).toBeTruthy();
    expect(survivor.semesterId).toBeNull();
  });

  it('computes semester GPA across its classes', async () => {
    const semester = await call('POST', '/semesters', { name: 'Spring', year: 2026, term: 'Spring' });

    for (const [name, credits, score] of [['A-class', 3, 95], ['B-class', 4, 85]]) {
      const cls = await call('POST', '/classes', { name, creditHours: credits, semesterId: semester.id });

      await call('POST', '/grades', {
        categoryId: cls.categories[0].id, name: 'Only', pointsEarned: score, pointsPossible: 100,
      });
    }

    const loaded = await call('GET', `/semesters/${semester.id}`);

    // 95% -> A (4.0) over 3 credits; 85% -> B (3.0) over 4 credits => 24/7 = 3.43
    expect(loaded.semesterGpa).toBe(3.43);
    expect(loaded.classCount).toBe(2);
  });
});

describe('guest backend: target grade', () => {
  it('reports what is needed on the remaining work', async () => {
    const cls = await call('POST', '/classes', { name: 'Econ', creditHours: 3 });
    const category = cls.categories[0];

    await call('POST', '/grades', {
      categoryId: category.id, name: 'Done', pointsEarned: 80, pointsPossible: 100,
    });

    await call('POST', '/grades', {
      categoryId: category.id, name: 'Pending', pointsEarned: null, pointsPossible: 100,
    });

    const target = await call('GET', `/classes/${cls.id}/target/B`);

    // (80 + X) / 2 >= 83  ->  X >= 86
    expect(target.status).toBe('Achievable');
    expect(target.neededOnRemaining).toBe(86);
  });
});

describe('guest backend: syllabus', () => {
  it('parses locally with no tokens spent', async () => {
    const parsed = await call('POST', '/syllabus/parse', {
      syllabusText: 'PSY 101\n3 credits\nHomework: 40%\nExams: 60%',
    });

    expect(parsed.source).toBe('deterministic');
    expect(parsed.tokensUsed).toBe(0);
    expect(parsed.categories).toHaveLength(2);
  });

  it('fails clearly when nothing can be extracted', async () => {
    const response = await LocalBackend.handle('POST', '/syllabus/parse', {
      syllabusText: 'Welcome to the course. Office hours are on Tuesday.',
    });

    expect(response.success).toBe(false);
    expect(response.message).toMatch(/sign in/i);
  });
});
