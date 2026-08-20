import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { evaluateClass, evaluateCategory, aggregateGpa } from '../src/core/grading/engine.js';
import { letterFor, gpaPointsFor } from '../src/core/grading/bands.js';
import { solveTarget } from '../src/core/grading/target.js';

/**
 * Runs the browser engine against shared/grade-vectors.json — the same file the C# xUnit suite
 * uses. Both suites passing is the guarantee that guest mode and signed-in mode compute
 * identical grades.
 *
 * The file is read from `shared/` directly rather than copied, so an edit to the contract
 * cannot be applied to one side only.
 */
const VECTORS_PATH = fileURLToPath(new URL('../../shared/grade-vectors.json', import.meta.url));
const vectors = JSON.parse(readFileSync(VECTORS_PATH, 'utf8'));

/** Percentages compare with tolerance: this engine uses doubles, the C# one uses decimal. */
const PERCENT_TOLERANCE = 1e-6;

function expectClose(actual, expected, label) {
  if (expected === null || expected === undefined) {
    expect(actual, label).toBeNull();
    return;
  }

  expect(actual, label).not.toBeNull();
  expect(Math.abs(actual - expected), `${label} (got ${actual}, want ${expected})`)
    .toBeLessThanOrEqual(PERCENT_TOLERANCE);
}

/** Maps a vector case onto the shape the engine consumes, assigning stable sortOrder/id. */
function toClassInput(vectorCase) {
  return {
    name: vectorCase.id,
    creditHours: vectorCase.creditHours ?? 3,
    scale: { ...vectors.defaultScale, ...(vectorCase.scale ?? {}) },
    categories: (vectorCase.categories ?? []).map((category, categoryIndex) => ({
      id: categoryIndex,
      name: category.name,
      weight: category.weight,
      rules: (category.rules ?? []).map((rule, ruleIndex) => ({
        id: ruleIndex,
        type: rule.type,
        value: rule.value ?? 0,
        weightDistribution: rule.weightDistribution ?? null,
      })),
      items: (category.items ?? []).map((item, itemIndex) => ({
        id: itemIndex,
        sortOrder: itemIndex,
        pointsEarned: item.pointsEarned ?? null,
        pointsPossible: item.pointsPossible,
      })),
    })),
  };
}

describe('vector file', () => {
  it('is the version this suite implements', () => {
    // A bumped version means the contract changed; both suites must be updated together.
    expect(vectors.version).toBe(1);
  });

  it('has unique case ids', () => {
    const ids = [
      ...vectors.classCases.map((c) => c.id),
      ...vectors.gpaCases.map((c) => c.id),
      ...vectors.targetCases.map((c) => c.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('class vectors', () => {
  it.each(vectors.classCases.map((c) => [c.id, c]))('%s', (id, vectorCase) => {
    const input = toClassInput(vectorCase);
    const result = evaluateClass(input);
    const { expect: want } = vectorCase;

    expectClose(result.percent, want.classPercent, `${id}: classPercent`);
    expect(result.letter, `${id}: letter`).toBe(want.letter ?? null);

    if (want.classGpa === null || want.classGpa === undefined) {
      expect(result.gpa, `${id}: classGpa`).toBeNull();
    } else {
      expect(result.gpa, `${id}: classGpa`).toBe(want.classGpa);
    }

    for (const [name, expected] of Object.entries(want.categoryPercents ?? {})) {
      const category = result.categories.find((c) => c.name === name);
      expect(category, `${id}: category '${name}' missing`).toBeDefined();
      expectClose(category.percent, expected, `${id}: category '${name}'`);
    }

    expect([...result.warnings].sort(), `${id}: warnings`).toEqual([...(want.warnings ?? [])].sort());
  });
});

describe('gpa vectors', () => {
  it.each(vectors.gpaCases.map((c) => [c.id, c]))('%s', (id, vectorCase) => {
    const actual = aggregateGpa(vectorCase.classes);

    if (vectorCase.expect.gpa === null) expect(actual, id).toBeNull();
    else expect(actual, id).toBe(vectorCase.expect.gpa);
  });
});

describe('target vectors', () => {
  it.each(vectors.targetCases.map((c) => [c.id, c]))('%s', (id, vectorCase) => {
    const input = toClassInput({ ...vectorCase, creditHours: 3 });
    const result = solveTarget(input, vectorCase.target);
    const { expect: want } = vectorCase;

    expect(result.status, `${id}: status`).toBe(want.status);
    expect(result.targetPercent, `${id}: targetPercent`).toBe(want.targetPercent);

    if (want.needed === null || want.needed === undefined) {
      expect(result.neededOnRemaining, `${id}: needed`).toBeNull();
    } else {
      expect(result.neededOnRemaining, `${id}: needed`).toBe(want.needed);
    }
  });
});

describe('cross-implementation rounding hazards', () => {
  // These are the specific double-precision cases that would otherwise diverge from C# decimal.
  it('rounds 3.005 up to 3.01 despite the binary representation being below it', () => {
    expect(aggregateGpa([{ gpa: 3.005, creditHours: 1 }])).toBe(3.01);
  });

  it('does not promote a genuine 89.96 to an A-', () => {
    expect(letterFor(89.96, vectors.defaultScale)).toBe('B+');
  });

  it('treats an exact threshold as inside the band', () => {
    expect(letterFor(90, vectors.defaultScale)).toBe('A-');
  });

  it('reads A+ value from the class scale rather than defaulting to 4.0', () => {
    expect(gpaPointsFor('A+', { ...vectors.defaultScale, aPlusGpaValue: 4.33 })).toBe(4.33);
    expect(gpaPointsFor('A+', vectors.defaultScale)).toBe(4.0);
  });
});

describe('category edge cases', () => {
  it('excludes an item with zero points possible instead of dividing by zero', () => {
    const result = evaluateCategory({
      name: 'HW',
      weight: 100,
      items: [
        { id: 0, sortOrder: 0, pointsEarned: 10, pointsPossible: 0 },
        { id: 1, sortOrder: 1, pointsEarned: 90, pointsPossible: 100 },
      ],
    });

    expect(result.percent).toBe(90);
    expect(result.countedItemCount).toBe(1);
  });

  it('returns null rather than 0 for a category with no graded items', () => {
    const result = evaluateCategory({
      name: 'Pending',
      weight: 50,
      items: [{ id: 0, sortOrder: 0, pointsEarned: null, pointsPossible: 100 }],
    });

    expect(result.percent).toBeNull();
  });
});
