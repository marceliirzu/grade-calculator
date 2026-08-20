import { roundHalfAwayFromZero } from './rounding.js';

/**
 * Letter-band lookup and GPA point values — the browser half of GRADING_SPEC.md §6 and §7.
 * Mirrors backend/GradeCalculator.API/Grading/GradeBands.cs.
 */

/** Descending threshold order. Load-bearing: `letterFor` returns the first band that is met. */
export const LETTERS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

/** Maps a letter to the field holding its threshold on a scale object. */
const THRESHOLD_FIELD = {
  'A+': 'aPlus',
  A: 'a',
  'A-': 'aMinus',
  'B+': 'bPlus',
  B: 'b',
  'B-': 'bMinus',
  'C+': 'cPlus',
  C: 'c',
  'C-': 'cMinus',
  'D+': 'dPlus',
  D: 'd',
  'D-': 'dMinus',
};

/**
 * Fixed GPA points. A+ is deliberately absent — it is the one letter whose value varies by
 * institution (4.0 or 4.33) and must come from the class's own scale.
 */
const FIXED_GPA_POINTS = {
  A: 4.0,
  'A-': 3.67,
  'B+': 3.33,
  B: 3.0,
  'B-': 2.67,
  'C+': 2.33,
  C: 2.0,
  'C-': 1.67,
  'D+': 1.33,
  D: 1.0,
  'D-': 0.67,
  F: 0.0,
};

export const DEFAULT_SCALE = Object.freeze({
  aPlusGpaValue: 4.0,
  aPlus: 97,
  a: 93,
  aMinus: 90,
  bPlus: 87,
  b: 83,
  bMinus: 80,
  cPlus: 77,
  c: 73,
  cMinus: 70,
  dPlus: 67,
  d: 63,
  dMinus: 60,
});

/** Fills any missing threshold from the default scale so a partial scale cannot break grading. */
export function normalizeScale(scale) {
  return { ...DEFAULT_SCALE, ...(scale ?? {}) };
}

export function isValidLetter(letter) {
  return typeof letter === 'string' && LETTERS.includes(letter.toUpperCase());
}

/** Minimum percentage a letter requires under the given scale. */
export function thresholdFor(scale, letter) {
  const normalized = normalizeScale(scale);
  const key = String(letter).toUpperCase();

  if (key === 'F') return 0;

  const field = THRESHOLD_FIELD[key];
  if (!field) throw new RangeError(`'${letter}' is not a valid letter grade.`);

  return normalized[field];
}

/**
 * Highest band whose threshold is met. Comparison uses the percentage rounded to 4 dp, which
 * absorbs arithmetic noise without promoting a genuine 89.96 to an A-.
 */
export function letterFor(percent, scale) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return null;

  const normalized = normalizeScale(scale);
  const rounded = roundHalfAwayFromZero(percent, 4);

  for (const letter of LETTERS) {
    if (letter === 'F') break;
    if (rounded >= normalized[THRESHOLD_FIELD[letter]]) return letter;
  }

  return 'F';
}

/**
 * Nearest letter for a GPA *value* — the inverse of `gpaPointsFor`, used purely as a display
 * label beside an aggregate GPA ("3.45 (B+)").
 *
 * This is NOT the same operation as `letterFor`, which maps a percentage through a class's
 * thresholds. A GPA is already scale-independent, so it is bucketed against the fixed point
 * table instead. Keeping it here rather than in a component is what stopped it becoming a
 * fourth ad-hoc copy of the grade mapping.
 */
export function letterForGpa(gpa) {
  if (gpa === null || gpa === undefined || Number.isNaN(Number(gpa))) return null;

  const value = Number(gpa);

  // Walk the fixed table from the top and take the first letter this GPA reaches.
  const ordered = [
    ['A+', 4.0], ['A', 4.0], ['A-', 3.67], ['B+', 3.33], ['B', 3.0], ['B-', 2.67],
    ['C+', 2.33], ['C', 2.0], ['C-', 1.67], ['D+', 1.33], ['D', 1.0], ['D-', 0.67],
  ];

  // A+ is skipped: a 4.0 aggregate is reported as an A, since only a 4.33 scale can exceed it.
  for (const [letter, points] of ordered.slice(1)) {
    if (value >= points) return letter;
  }

  return 'F';
}

/** GPA points for a letter, honouring the scale's A+ value. */
export function gpaPointsFor(letter, scale) {
  const key = String(letter).toUpperCase();
  if (key === 'A+') return normalizeScale(scale).aPlusGpaValue;

  const points = FIXED_GPA_POINTS[key];
  if (points === undefined) throw new RangeError(`'${letter}' is not a valid letter grade.`);

  return points;
}
