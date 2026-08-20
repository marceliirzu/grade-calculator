import { letterFor, gpaPointsFor, normalizeScale } from './bands.js';
import { roundHalfAwayFromZero } from './rounding.js';

/**
 * The browser-side implementation of GRADING_SPEC.md.
 *
 * This is the engine guest mode runs on, and it is a peer of — not a copy of —
 * backend/GradeCalculator.API/Grading/GradeEngine.cs. Both are verified against
 * shared/grade-vectors.json by their own test suites, which is what stops them drifting.
 *
 * Guest mode is the reason two implementations exist at all: a guest has no account and no
 * server round trip, so their grades have to be computed locally. That is a real product
 * requirement, not duplication for its own sake — but it does mean any behaviour change here
 * must land in the C# engine, the spec, and the vectors in the same commit.
 */

export const GradingWarning = Object.freeze({
  WeightByScoreLengthMismatch: 'WeightByScoreLengthMismatch',
});

export const RuleKind = Object.freeze({
  DropLowest: 'DropLowest',
  CountHighest: 'CountHighest',
  WeightByScore: 'WeightByScore',
});

// ---------------------------------------------------------------------------
// Item helpers (GRADING_SPEC.md §1)
// ---------------------------------------------------------------------------

const num = (value) => (value === null || value === undefined ? null : Number(value));

/** Both conditions are required: a score, and a positive denominator to divide it by. */
export function isGraded(item) {
  const earned = num(item?.pointsEarned);
  const possible = Number(item?.pointsPossible ?? 0);

  return earned !== null && !Number.isNaN(earned) && possible > 0;
}

/** Percentage score. Never clamped — extra credit legitimately exceeds 100. */
export function itemPercent(item) {
  return (Number(item.pointsEarned) / Number(item.pointsPossible)) * 100;
}

// ---------------------------------------------------------------------------
// Ordering (GRADING_SPEC.md §2)
//
// Written as two explicit comparators. `bestFirst` is NOT `worstFirst` reversed: reversing
// would also flip the sortOrder/id tie-breakers, so drop-lowest and count-highest would
// disagree about which of two equal-percentage items is the same item.
// ---------------------------------------------------------------------------

function compareTieBreakers(a, b) {
  const byPossible = Number(b.pointsPossible) - Number(a.pointsPossible); // DESC in both directions
  if (byPossible !== 0) return byPossible;

  const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (bySortOrder !== 0) return bySortOrder;

  return (a.id ?? 0) - (b.id ?? 0);
}

function compareWorstFirst(a, b) {
  const byPercent = itemPercent(a) - itemPercent(b);
  if (byPercent !== 0) return byPercent;

  return compareTieBreakers(a, b);
}

function compareBestFirst(a, b) {
  const byPercent = itemPercent(b) - itemPercent(a); // only this component inverts
  if (byPercent !== 0) return byPercent;

  return compareTieBreakers(a, b);
}

// ---------------------------------------------------------------------------
// Rules (GRADING_SPEC.md §3)
// ---------------------------------------------------------------------------

function rulesOfKind(category, kind) {
  return (category.rules ?? [])
    .filter((rule) => rule.type === kind)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

/** Applies DropLowest then CountHighest, in that fixed order regardless of creation order. */
export function countedItems(category) {
  let items = (category.items ?? []).filter(isGraded);
  if (items.length === 0) return [];

  for (const rule of rulesOfKind(category, RuleKind.DropLowest)) {
    const drop = Math.max(0, Number(rule.value) || 0);

    // Dropping at least as many items as exist empties the category; it does not keep one.
    items = drop >= items.length ? [] : [...items].sort(compareWorstFirst).slice(drop);

    if (items.length === 0) return [];
  }

  for (const rule of rulesOfKind(category, RuleKind.CountHighest)) {
    const keep = Math.max(0, Number(rule.value) || 0);

    items = keep >= items.length ? items : [...items].sort(compareBestFirst).slice(0, keep);

    if (items.length === 0) return [];
  }

  return items;
}

// ---------------------------------------------------------------------------
// Category (GRADING_SPEC.md §4)
// ---------------------------------------------------------------------------

export function evaluateCategory(category) {
  const warnings = [];
  const counted = countedItems(category);
  const gradedItemCount = (category.items ?? []).filter(isGraded).length;

  let percent = null;

  if (counted.length > 0) {
    const [weightRule] = rulesOfKind(category, RuleKind.WeightByScore);

    if (weightRule) {
      const weights = weightRule.weightDistribution ?? [];

      if (weights.length === counted.length) {
        const totalWeight = weights.reduce((sum, w) => sum + Number(w), 0);

        if (totalWeight !== 0) {
          const ranked = [...counted].sort(compareBestFirst);
          const weighted = ranked.reduce(
            (sum, item, index) => sum + itemPercent(item) * Number(weights[index]),
            0,
          );
          percent = weighted / totalWeight;
        }
        // A zero weight-sum falls through to points-based rather than dividing by zero.
      } else {
        // Previously the items past the end of the weight list vanished from the grade.
        warnings.push(GradingWarning.WeightByScoreLengthMismatch);
      }
    }

    if (percent === null) {
      const earned = counted.reduce((sum, item) => sum + Number(item.pointsEarned), 0);
      const possible = counted.reduce((sum, item) => sum + Number(item.pointsPossible), 0);

      if (possible > 0) percent = (earned / possible) * 100;
    }
  }

  return {
    id: category.id ?? 0,
    name: category.name,
    weight: Number(category.weight ?? 0),
    percent,
    gradedItemCount,
    totalItemCount: (category.items ?? []).length,
    countedItemCount: counted.length,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Class (GRADING_SPEC.md §5, §6, §7)
// ---------------------------------------------------------------------------

export function evaluateClass(classInput) {
  const scale = normalizeScale(classInput.scale ?? classInput.gradeScale);
  const categories = (classInput.categories ?? []).map(evaluateCategory);

  let weightedSum = 0;
  let participatingWeight = 0;

  for (const category of categories) {
    if (category.percent === null || category.weight <= 0) continue;
    weightedSum += category.weight * category.percent;
    participatingWeight += category.weight;
  }

  // Denominator is the participating weight, not 100: a term that is 60% graded reports the
  // grade over that 60% rather than treating ungraded work as zeros.
  const percent = participatingWeight > 0 ? weightedSum / participatingWeight : null;

  const letter = percent === null ? null : letterFor(percent, scale);
  const gpa = letter === null ? null : gpaPointsFor(letter, scale);

  return {
    id: classInput.id ?? 0,
    name: classInput.name,
    creditHours: Number(classInput.creditHours ?? 0),
    percent,
    letter,
    gpa,
    categories,
    warnings: [...new Set(categories.flatMap((c) => c.warnings))],
  };
}

// ---------------------------------------------------------------------------
// Aggregate GPA (GRADING_SPEC.md §7, §8)
// ---------------------------------------------------------------------------

/**
 * Credit-weighted mean GPA, rounded half away from zero to 2 dp.
 *
 * Returns null — never 0 — when nothing qualifies. A UI that renders 0.00 for "no grades yet"
 * tells the student they are failing.
 */
export function aggregateGpa(classes) {
  let qualityPoints = 0;
  let creditHours = 0;

  for (const entry of classes ?? []) {
    const gpa = num(entry.gpa);
    const credits = Number(entry.creditHours ?? 0);

    if (gpa === null || Number.isNaN(gpa) || credits <= 0) continue;

    qualityPoints += gpa * credits;
    creditHours += credits;
  }

  if (creditHours <= 0) return null;

  return roundHalfAwayFromZero(qualityPoints / creditHours, 2);
}
