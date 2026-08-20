import { Storage, STORAGE_KEYS } from '../core/storage.js';
import { evaluateClass, isGraded, itemPercent, aggregateGpa } from '../core/grading/engine.js';
import { solveTarget } from '../core/grading/target.js';
import { DEFAULT_SCALE, normalizeScale } from '../core/grading/bands.js';
import { parseSyllabusLocally } from '../core/syllabusParser.js';

/**
 * Guest mode: the entire API, served from localStorage.
 *
 * It implements the same routes and the same `{ success, message, data }` envelope as the
 * ASP.NET backend, so `Api` can dispatch here without any caller knowing the difference.
 *
 * Crucially it does **not** reimplement grading. Every computed number comes from the shared
 * engine in `core/grading/`, which is verified against the same golden vectors as the C#
 * engine. The previous guest backend hand-ported the grading logic from C#, and that copy was
 * free to drift — this one cannot.
 */

const DEFAULT_CATEGORIES = [
  { name: 'Assignments', weight: 30 },
  { name: 'Quizzes', weight: 20 },
  { name: 'Exams', weight: 50 },
];

function emptyDb() {
  return { nextId: 1, classes: [], semesters: [] };
}

function loadDb() {
  const db = Storage.get(STORAGE_KEYS.GUEST_DB, null);
  if (!db || typeof db !== 'object' || !Array.isArray(db.classes)) return emptyDb();

  // Tolerate a database written by an older build rather than discarding the user's work.
  return { nextId: db.nextId ?? 1, classes: db.classes ?? [], semesters: db.semesters ?? [] };
}

function saveDb(db) {
  Storage.set(STORAGE_KEYS.GUEST_DB, db);
}

const ok = (data, message = null) => ({ success: true, message, data });
const fail = (message, status = 400) => ({ success: false, message, status, data: null });

function nextId(db) {
  db.nextId = (db.nextId ?? 1) + 1;
  return db.nextId - 1;
}

const round2 = (value) => (value === null || value === undefined ? null : Math.round(value * 100) / 100);

// ---------------------------------------------------------------------------
// Mapping to the API's response shapes
// ---------------------------------------------------------------------------

function mapClass(cls) {
  const result = evaluateClass(toEngineClass(cls));
  const byId = new Map(result.categories.map((c) => [c.id, c]));

  return {
    id: cls.id,
    name: cls.name,
    creditHours: cls.creditHours,
    showOnlyCAndUp: Boolean(cls.showOnlyCAndUp),
    semesterId: cls.semesterId ?? null,
    currentGrade: round2(result.percent),
    letterGrade: result.letter,
    gpa: result.gpa,
    warnings: result.warnings,
    gradeScale: normalizeScale(cls.gradeScale),
    categories: (cls.categories ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
      .map((category) => {
        const graded = byId.get(category.id);

        return {
          id: category.id,
          name: category.name,
          weight: category.weight,
          currentGrade: round2(graded?.percent ?? null),
          countedItemCount: graded?.countedItemCount ?? 0,
          gradeItems: (category.gradeItems ?? [])
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
            .map(mapGradeItem),
          rules: (category.rules ?? []).map((rule) => ({
            id: rule.id,
            type: rule.type,
            value: rule.value,
            weightDistribution: rule.weightDistribution ?? null,
          })),
        };
      }),
  };
}

function mapGradeItem(item) {
  return {
    id: item.id,
    name: item.name,
    pointsEarned: item.pointsEarned ?? null,
    pointsPossible: item.pointsPossible,
    percentage: isGraded(item) ? round2(itemPercent(item)) : null,
    isWhatIf: Boolean(item.isWhatIf),
    sortOrder: item.sortOrder ?? 0,
  };
}

/** Translates the stored shape into the engine's vocabulary (gradeItems -> items). */
function toEngineClass(cls) {
  return {
    id: cls.id,
    name: cls.name,
    creditHours: cls.creditHours,
    scale: normalizeScale(cls.gradeScale),
    categories: (cls.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      weight: category.weight,
      rules: category.rules ?? [],
      items: category.gradeItems ?? [],
    })),
  };
}

function mapSemester(db, semester) {
  const classes = db.classes.filter((c) => c.semesterId === semester.id).map(mapClass);
  const semesterGpa = aggregateGpa(classes.map((c) => ({ gpa: c.gpa, creditHours: c.creditHours })));
  const cumulative = cumulativeGpa(db);

  return {
    id: semester.id,
    name: semester.name,
    year: semester.year,
    term: semester.term,
    gpaGoal: semester.gpaGoal ?? null,
    semesterGpa,
    cumulativeGpa: cumulative,
    gpaGoalProgress:
      semesterGpa !== null && semester.gpaGoal > 0
        ? Math.min(semesterGpa / semester.gpaGoal, 1)
        : null,
    classCount: classes.length,
    classes,
    createdAt: semester.createdAt,
  };
}

function cumulativeGpa(db) {
  return aggregateGpa(
    db.classes.map((cls) => {
      const result = evaluateClass(toEngineClass(cls));
      return { gpa: result.gpa, creditHours: cls.creditHours };
    }),
  );
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function findClass(db, id) {
  return db.classes.find((c) => c.id === id) ?? null;
}

function findCategory(db, id) {
  for (const cls of db.classes) {
    const category = (cls.categories ?? []).find((c) => c.id === id);
    if (category) return { cls, category };
  }

  return null;
}

function findItem(db, id) {
  for (const cls of db.classes) {
    for (const category of cls.categories ?? []) {
      const item = (category.gradeItems ?? []).find((g) => g.id === id);
      if (item) return { cls, category, item };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const LocalBackend = {
  /** Accepts the same (method, endpoint, body) triple the Api layer sends to the server. */
  async handle(method, endpoint, body) {
    const [rawPath, rawQuery] = endpoint.replace(/^\/+/, '').split('?');
    const parts = rawPath.split('/').filter(Boolean);
    const query = new URLSearchParams(rawQuery ?? '');
    const db = loadDb();

    try {
      switch (parts[0]) {
        case 'classes': return handleClasses(db, method, parts, query, body);
        case 'categories': return handleCategories(db, method, parts, body);
        case 'grades': return handleGrades(db, method, parts, body);
        case 'semesters': return handleSemesters(db, method, parts, body);
        case 'syllabus': return handleSyllabus(method, parts, body);
        case 'account': return handleAccount(parts);
        default: return fail(`Unknown endpoint: ${endpoint}`, 404);
      }
    } catch (error) {
      // A guest's data lives only in this browser, so an unhandled throw here would lose the
      // page with no server-side trace to diagnose it from.
      console.error('Guest backend error:', error);
      return fail(error.message ?? 'Something went wrong locally.', 500);
    }
  },
};

function handleClasses(db, method, parts, query, body) {
  if (parts.length === 1 && method === 'GET') {
    const semesterId = query.get('semesterId');
    const classes = db.classes
      .filter((c) => semesterId === null || String(c.semesterId ?? '') === semesterId)
      .map(mapClass)
      .sort((a, b) => a.name.localeCompare(b.name));

    return ok(classes);
  }

  if (parts.length === 1 && method === 'POST') {
    const cls = {
      id: nextId(db),
      name: (body?.name ?? 'Untitled class').trim(),
      creditHours: Number(body?.creditHours ?? 3),
      showOnlyCAndUp: Boolean(body?.showOnlyCAndUp),
      semesterId: body?.semesterId ?? null,
      gradeScale: { ...DEFAULT_SCALE },
      categories: DEFAULT_CATEGORIES.map((category, index) => ({
        id: nextId(db),
        name: category.name,
        weight: category.weight,
        sortOrder: index,
        gradeItems: [],
        rules: [],
      })),
    };

    db.classes.push(cls);
    saveDb(db);

    return ok(mapClass(cls));
  }

  if (parts.length === 2 && parts[1] === 'gpa' && method === 'GET') {
    const semesterId = query.get('semesterId');
    const classes = db.classes
      .filter((c) => semesterId === null || String(c.semesterId ?? '') === semesterId)
      .map(mapClass);

    return ok({
      overallGpa: aggregateGpa(classes.map((c) => ({ gpa: c.gpa, creditHours: c.creditHours }))),
      totalCreditHours: classes.filter((c) => c.gpa !== null).reduce((sum, c) => sum + c.creditHours, 0),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        creditHours: c.creditHours,
        currentGrade: c.currentGrade,
        letterGrade: c.letterGrade,
        gpa: c.gpa,
      })),
    });
  }

  const id = Number(parts[1]);

  if (parts.length === 4 && parts[2] === 'target' && method === 'GET') {
    const cls = findClass(db, id);
    if (!cls) return fail('Class not found.', 404);

    const result = solveTarget(toEngineClass(cls), decodeURIComponent(parts[3]));

    return ok({
      className: cls.name,
      targetGrade: result.targetLetter,
      targetPercentage: result.targetPercent,
      status: result.status,
      isAchievable: result.isAchievable,
      currentGrade: round2(result.currentPercent),
      currentLetter: result.currentLetter,
      neededOnRemaining: result.neededOnRemaining,
      remainingPointsPossible: result.remainingPointsPossible,
      summary: summarise(result),
      categories: result.categories.map((c) => ({
        categoryName: c.name,
        weight: c.weight,
        currentGrade: round2(c.currentPercent),
        gradedItems: c.gradedItemCount,
        totalItems: c.totalItemCount,
        isComplete: c.isComplete,
      })),
    });
  }

  if (parts.length === 3 && (parts[2] === 'grade-scale' || parts[2] === 'gradescale') && method === 'PUT') {
    const cls = findClass(db, id);
    if (!cls) return fail('Class not found.', 404);

    cls.gradeScale = normalizeScale({ ...cls.gradeScale, ...body });
    saveDb(db);

    return ok(mapClass(cls));
  }

  if (parts.length === 2) {
    const cls = findClass(db, id);
    if (!cls) return fail('Class not found.', 404);

    if (method === 'GET') return ok(mapClass(cls));

    if (method === 'PUT') {
      if (body?.name !== undefined) cls.name = String(body.name).trim();
      if (body?.creditHours !== undefined) cls.creditHours = Number(body.creditHours);
      if (body?.showOnlyCAndUp !== undefined) cls.showOnlyCAndUp = Boolean(body.showOnlyCAndUp);
      if (body?.semesterId !== undefined) cls.semesterId = body.semesterId;

      saveDb(db);
      return ok(mapClass(cls));
    }

    if (method === 'DELETE') {
      db.classes = db.classes.filter((c) => c.id !== id);
      saveDb(db);
      return ok({ deleted: id });
    }
  }

  return fail('Unsupported class operation.', 405);
}

function handleCategories(db, method, parts, body) {
  if (parts.length === 1 && method === 'POST') {
    const cls = findClass(db, Number(body?.classId));
    if (!cls) return fail('Class not found.', 404);

    cls.categories.push({
      id: nextId(db),
      name: (body?.name ?? 'Category').trim(),
      weight: Number(body?.weight ?? 0),
      sortOrder: body?.sortOrder ?? cls.categories.length,
      gradeItems: [],
      rules: [],
    });

    saveDb(db);
    return ok(mapClass(cls));
  }

  if (parts.length === 2 && parts[1] === 'rules' && method === 'POST') {
    const found = findCategory(db, Number(body?.categoryId));
    if (!found) return fail('Category not found.', 404);

    const type = body?.type;
    if (!['DropLowest', 'CountHighest', 'WeightByScore'].includes(type)) {
      return fail(`'${type}' is not a rule type.`, 400);
    }

    // One rule per kind, matching the server: two DropLowest rules would silently double-drop.
    const existing = found.category.rules.find((r) => r.type === type);

    if (existing) {
      existing.value = Number(body?.value ?? 0);
      existing.weightDistribution = body?.weightDistribution ?? null;
    } else {
      found.category.rules.push({
        id: nextId(db),
        type,
        value: Number(body?.value ?? 0),
        weightDistribution: body?.weightDistribution ?? null,
      });
    }

    saveDb(db);
    return ok(mapClass(found.cls));
  }

  if (parts.length === 3 && parts[1] === 'rules' && method === 'DELETE') {
    const ruleId = Number(parts[2]);

    for (const cls of db.classes) {
      for (const category of cls.categories ?? []) {
        const index = (category.rules ?? []).findIndex((r) => r.id === ruleId);

        if (index >= 0) {
          category.rules.splice(index, 1);
          saveDb(db);
          return ok(mapClass(cls));
        }
      }
    }

    return fail('Rule not found.', 404);
  }

  if (parts.length === 2) {
    const found = findCategory(db, Number(parts[1]));
    if (!found) return fail('Category not found.', 404);

    if (method === 'PUT') {
      if (body?.name !== undefined) found.category.name = String(body.name).trim();
      if (body?.weight !== undefined) found.category.weight = Number(body.weight);
      if (body?.sortOrder !== undefined) found.category.sortOrder = Number(body.sortOrder);

      saveDb(db);
      return ok(mapClass(found.cls));
    }

    if (method === 'DELETE') {
      found.cls.categories = found.cls.categories.filter((c) => c.id !== found.category.id);
      saveDb(db);
      return ok(mapClass(found.cls));
    }
  }

  return fail('Unsupported category operation.', 405);
}

function handleGrades(db, method, parts, body) {
  if (parts.length === 1 && method === 'POST') {
    const found = findCategory(db, Number(body?.categoryId));
    if (!found) return fail('Category not found.', 404);

    found.category.gradeItems.push({
      id: nextId(db),
      name: (body?.name ?? 'Assignment').trim(),
      pointsEarned: body?.pointsEarned === undefined || body?.pointsEarned === null
        ? null
        : Number(body.pointsEarned),
      pointsPossible: Number(body?.pointsPossible ?? 100),
      isWhatIf: Boolean(body?.isWhatIf),
      sortOrder: body?.sortOrder ?? found.category.gradeItems.length,
    });

    saveDb(db);
    return ok(mapClass(found.cls));
  }

  if (parts.length === 2) {
    const found = findItem(db, Number(parts[1]));
    if (!found) return fail('Grade item not found.', 404);

    if (method === 'PUT') {
      if (body?.name !== undefined) found.item.name = String(body.name).trim();

      // Clearing a score and leaving it alone are different operations.
      if (body?.clearPointsEarned) found.item.pointsEarned = null;
      else if (body?.pointsEarned !== undefined) {
        found.item.pointsEarned = body.pointsEarned === null ? null : Number(body.pointsEarned);
      }

      if (body?.pointsPossible !== undefined) found.item.pointsPossible = Number(body.pointsPossible);
      if (body?.isWhatIf !== undefined) found.item.isWhatIf = Boolean(body.isWhatIf);
      if (body?.sortOrder !== undefined) found.item.sortOrder = Number(body.sortOrder);

      saveDb(db);
      return ok(mapClass(found.cls));
    }

    if (method === 'DELETE') {
      found.category.gradeItems = found.category.gradeItems.filter((g) => g.id !== found.item.id);
      saveDb(db);
      return ok(mapClass(found.cls));
    }
  }

  return fail('Unsupported grade operation.', 405);
}

function handleSemesters(db, method, parts, body) {
  if (parts.length === 1 && method === 'GET') {
    const semesters = db.semesters
      .slice()
      .sort((a, b) => b.year - a.year || a.term.localeCompare(b.term))
      .map((semester) => mapSemester(db, semester));

    return ok(semesters);
  }

  if (parts.length === 1 && method === 'POST') {
    const semester = {
      id: nextId(db),
      name: (body?.name ?? 'New semester').trim(),
      year: Number(body?.year ?? new Date().getFullYear()),
      term: body?.term ?? 'Fall',
      gpaGoal: body?.gpaGoal ?? null,
      createdAt: new Date().toISOString(),
    };

    db.semesters.push(semester);
    saveDb(db);

    return ok(mapSemester(db, semester));
  }

  if (parts.length === 2 && parts[1] === 'cumulative-gpa' && method === 'GET') {
    return ok({ cumulativeGpa: cumulativeGpa(db) });
  }

  if (parts.length === 2) {
    const id = Number(parts[1]);
    const semester = db.semesters.find((s) => s.id === id);
    if (!semester) return fail('Semester not found.', 404);

    if (method === 'GET') return ok(mapSemester(db, semester));

    if (method === 'PUT') {
      if (body?.name !== undefined) semester.name = String(body.name).trim();
      if (body?.year !== undefined) semester.year = Number(body.year);
      if (body?.term !== undefined) semester.term = body.term;

      if (body?.clearGpaGoal) semester.gpaGoal = null;
      else if (body?.gpaGoal !== undefined) semester.gpaGoal = body.gpaGoal;

      saveDb(db);
      return ok(mapSemester(db, semester));
    }

    if (method === 'DELETE') {
      db.semesters = db.semesters.filter((s) => s.id !== id);
      // Classes survive, unassigned — matching the server's ON DELETE SET NULL.
      for (const cls of db.classes) {
        if (cls.semesterId === id) cls.semesterId = null;
      }

      saveDb(db);
      return ok({ deleted: id });
    }
  }

  return fail('Unsupported semester operation.', 405);
}

function handleSyllabus(method, parts, body) {
  if (parts[1] === 'parse' && method === 'POST') {
    // Guests get the deterministic parser only. The AI fallback runs server-side and is metered
    // per account, so there is no way to attribute — or cap — a guest's usage of it.
    const result = parseSyllabusLocally(body?.syllabusText ?? '');

    if (!result.categories.length) {
      return fail(
        'No grading categories were found. Try pasting just the grading section, or sign in to use AI parsing.',
        422,
      );
    }

    return ok(result);
  }

  return fail('Unsupported syllabus operation.', 405);
}

function handleAccount(parts) {
  if (parts[1] === 'me') {
    return ok({ id: 0, email: '', name: 'Guest', createdAt: new Date().toISOString() });
  }

  if (parts[1] === 'llm-quota') {
    // Guests never reach the LLM, so the honest answer is "no budget, not configured".
    return ok({
      tokensUsedToday: 0,
      dailyTokenLimit: 0,
      tokensRemaining: 0,
      tokensSavedToday: 0,
      llmConfigured: false,
    });
  }

  return fail('Unsupported account operation.', 405);
}

function summarise(result) {
  switch (result.status) {
    case 'Determined':
      return `Everything is graded. Final grade: ${round2(result.currentPercent)}% (${result.currentLetter}).`;
    case 'Secured':
      return `A ${result.targetLetter} is already locked in — you would keep it even scoring 0% on everything remaining.`;
    case 'Achievable':
      return `You need ${result.neededOnRemaining}% on the remaining ${result.remainingPointsPossible} points to earn a ${result.targetLetter}.`;
    default:
      return result.neededOnRemaining === null
        ? `A ${result.targetLetter} (${result.targetPercent}%) is no longer reachable.`
        : `A ${result.targetLetter} (${result.targetPercent}%) is out of reach: it would take ${result.neededOnRemaining}% on the remaining work.`;
  }
}
