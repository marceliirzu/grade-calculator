/**
 * Rounding helpers shared by the browser-side grading engine.
 *
 * These exist because JavaScript has no decimal type and the C# engine does. The two must agree
 * on every value in `shared/grade-vectors.json`, and naive rounding does not get there:
 *
 *   3.005 * 100  ===  300.49999999999994    // in IEEE-754 doubles
 *
 * so `Math.round` would yield 3.00 where C#'s `decimal` yields 3.01. The literal `3.005` is not
 * representable in binary; the nearest double is fractionally *below* it, and the .5 decision
 * then goes the wrong way.
 *
 * The fix is to re-read the scaled value at 12 significant digits before deciding. Doubles carry
 * ~15-17 significant digits, so 12 discards accumulated representation noise while preserving
 * far more precision than any gradebook reports.
 */

/** Significant digits retained before a rounding decision. See the note above. */
const SIGNIFICANT_DIGITS = 12;

/**
 * Rounds half away from zero, matching C#'s `MidpointRounding.AwayFromZero`.
 *
 * JavaScript's `Math.round` is half-*up* (toward +Infinity), which differs from away-from-zero
 * for negative midpoints: `Math.round(-0.5)` is `-0`, not `-1`. Grades are rarely negative, but
 * an engine that quietly disagrees with its counterpart on sign is a defect waiting for the one
 * input that reaches it.
 *
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundHalfAwayFromZero(value, decimals) {
  if (!Number.isFinite(value)) return value;

  const sign = value < 0 ? -1 : 1;
  const factor = 10 ** decimals;

  // Collapse representation noise, then round the magnitude so .5 always moves away from zero.
  const scaled = Number((Math.abs(value) * factor).toPrecision(SIGNIFICANT_DIGITS));

  return (sign * Math.round(scaled)) / factor;
}

/**
 * Rounds up to `decimals` places, used for "the score you need" so a reported figure never
 * falls short of the target. Mirrors `Math.Ceiling` on the nudged value in the C# solver.
 *
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundUp(value, decimals) {
  if (!Number.isFinite(value)) return value;

  const factor = 10 ** decimals;
  const scaled = Number((value * factor).toPrecision(SIGNIFICANT_DIGITS));

  return Math.ceil(scaled) / factor;
}
