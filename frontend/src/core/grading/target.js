import { evaluateClass, evaluateCategory, isGraded } from './engine.js';
import { thresholdFor, isValidLetter, letterFor, normalizeScale } from './bands.js';
import { roundUp } from './rounding.js';

/**
 * "What do I need on everything that is left?" — GRADING_SPEC.md §9.
 * Mirrors backend/GradeCalculator.API/Grading/TargetGradeSolver.cs.
 */

export const TargetStatus = Object.freeze({
  Determined: 'Determined',
  Secured: 'Secured',
  Achievable: 'Achievable',
  Unreachable: 'Unreachable',
});

const SEARCH_CEILING = 200;
const UNREACHABLE_PROBE_CEILING = 100_000;
const TOLERANCE = 1e-9;
const ROUNDING_NUDGE = 1e-7;
const MAX_ITERATIONS = 200;

/**
 * Class percentage if every currently-ungraded item scored `score` percent of its own points.
 * Runs the whole engine, so drop-lowest and friends apply to the projection exactly as they
 * apply to the real grade.
 */
export function classPercentIfRemainingScore(classInput, score) {
  const projected = {
    ...classInput,
    categories: (classInput.categories ?? []).map((category) => ({
      ...category,
      items: (category.items ?? []).map((item) =>
        isGraded(item)
          ? item
          : { ...item, pointsEarned: (score / 100) * Number(item.pointsPossible ?? 0) },
      ),
    })),
  };

  return evaluateClass(projected).percent;
}

/**
 * Smallest uniform percentage on remaining work that reaches the target.
 *
 * Bisection rather than algebra: drop-lowest makes the curve piecewise-linear, because once a
 * pending score overtakes an existing low one the low one gets dropped instead and the slope
 * changes. The function stays monotonically non-decreasing — scoring better on pending work
 * cannot lower a grade — which is the only property bisection needs.
 */
export function solveTarget(classInput, targetLetter) {
  if (!isValidLetter(targetLetter)) {
    throw new RangeError(`'${targetLetter}' is not a valid letter grade.`);
  }

  const scale = normalizeScale(classInput.scale ?? classInput.gradeScale);
  const normalized = String(targetLetter).toUpperCase();
  const targetPercent = thresholdFor(scale, normalized);

  const current = evaluateClass(classInput);

  const categories = (classInput.categories ?? []).map((category) => {
    const evaluated = evaluateCategory(category);

    return {
      name: category.name,
      weight: evaluated.weight,
      currentPercent: evaluated.percent,
      gradedItemCount: evaluated.gradedItemCount,
      totalItemCount: evaluated.totalItemCount,
      isComplete: evaluated.totalItemCount > 0 && evaluated.gradedItemCount === evaluated.totalItemCount,
    };
  });

  const remainingPointsPossible = (classInput.categories ?? [])
    .flatMap((category) => category.items ?? [])
    .filter((item) => !isGraded(item))
    .reduce((sum, item) => sum + Number(item.pointsPossible ?? 0), 0);

  const build = (status, needed) => ({
    targetLetter: normalized,
    targetPercent,
    status,
    neededOnRemaining: needed,
    currentPercent: current.percent,
    currentLetter: current.letter ?? letterFor(current.percent, scale),
    remainingPointsPossible,
    categories,
    isAchievable: status === TargetStatus.Secured || status === TargetStatus.Achievable,
  });

  const hasUngraded = (classInput.categories ?? []).some((category) =>
    (category.items ?? []).some((item) => !isGraded(item)),
  );

  if (!hasUngraded) return build(TargetStatus.Determined, null);

  const atZero = classPercentIfRemainingScore(classInput, 0);
  if (atZero !== null && atZero >= targetPercent) return build(TargetStatus.Secured, null);

  // Judged at 100, not at the top of the search range. Extra credit above 100% is legal on an
  // item, but a target that *requires* it is out of reach for planning purposes.
  const atHundred = classPercentIfRemainingScore(classInput, 100);
  const unreachable = atHundred === null || atHundred < targetPercent;

  const ceiling = unreachable ? UNREACHABLE_PROBE_CEILING : SEARCH_CEILING;

  // Ungraded work that cannot move the grade at all — items in a zero-weight category, say —
  // leaves no meaningful number to report.
  const atCeiling = classPercentIfRemainingScore(classInput, ceiling);
  if (atCeiling === null || atCeiling < targetPercent) return build(TargetStatus.Unreachable, null);

  let low = 0;
  let high = ceiling;

  for (let i = 0; i < MAX_ITERATIONS && high - low > TOLERANCE; i += 1) {
    const mid = (low + high) / 2;
    const value = classPercentIfRemainingScore(classInput, mid);

    if (value !== null && value >= targetPercent) high = mid;
    else low = mid;
  }

  // Round up: reporting a score that would just miss the target is the error that actually
  // costs the student something. The nudge stops a converged 86.0000000001 becoming 86.01.
  const needed = Math.max(0, roundUp(high - ROUNDING_NUDGE, 2));

  return build(unreachable ? TargetStatus.Unreachable : TargetStatus.Achievable, needed);
}
