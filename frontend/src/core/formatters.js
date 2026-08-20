import { letterFor, gpaPointsFor } from './grading/bands.js';

/**
 * Display formatting.
 *
 * Note what is *not* here: this module used to carry its own copy of the letter-grade thresholds
 * and the GPA point table, which made three implementations in the codebase (this one, the C#
 * engine, and the guest-mode backend). `letterGrade` and `gpaPoints` now delegate to the single
 * engine implementation, so a change to the grading rules cannot leave the display behind.
 */

const EM_DASH = '—';

const isBlank = (value) => value === null || value === undefined || Number.isNaN(Number(value));

export const Formatters = {
  percentage(value, decimals = 1) {
    if (isBlank(value)) return EM_DASH;
    return `${Number(value).toFixed(decimals)}%`;
  },

  /**
   * GPA to a natural number of places: whole values read as 4.0, everything else as 3.67.
   * Rendering a flat 4.00 next to a 3.67 looks like spurious precision.
   */
  gpa(value) {
    if (isBlank(value)) return EM_DASH;

    const number = Number(value);
    return number % 1 === 0 ? number.toFixed(1) : number.toFixed(2);
  },

  number(value, decimals = 2) {
    if (isBlank(value)) return EM_DASH;
    return Number(value).toFixed(decimals);
  },

  /** Letter grade for a percentage. Delegates to the grading engine. */
  letterGrade(percent, scale) {
    if (isBlank(percent)) return EM_DASH;
    return letterFor(Number(percent), scale) ?? EM_DASH;
  },

  /** GPA points for a letter. Delegates to the grading engine. */
  gpaPoints(letter, scale) {
    try {
      return gpaPointsFor(letter, scale);
    } catch {
      return 0;
    }
  },

  gradeColorClass(letter) {
    if (!letter || letter === EM_DASH) return '';

    switch (letter.charAt(0).toUpperCase()) {
      case 'A': return 'grade-a';
      case 'B': return 'grade-b';
      case 'C': return 'grade-c';
      case 'D': return 'grade-d';
      case 'F': return 'grade-f';
      default: return '';
    }
  },

  ruleType(type) {
    switch (type) {
      case 'DropLowest': return 'Drop Lowest';
      case 'CountHighest': return 'Count Highest';
      case 'WeightByScore': return 'Weight by Score';
      default: return type;
    }
  },

  ruleDescription(rule) {
    const plural = rule.value > 1 ? 's' : '';

    switch (rule.type) {
      case 'DropLowest':
        return `Drop lowest ${rule.value} grade${plural}`;
      case 'CountHighest':
        return `Count highest ${rule.value} grade${plural}`;
      case 'WeightByScore':
        return 'Weight grades by score (highest = most weight)';
      default:
        return rule.type;
    }
  },

  truncate(text, maxLength = 30) {
    if (!text) return '';
    return text.length <= maxLength ? text : `${text.substring(0, maxLength - 3)}...`;
  },
};

/**
 * Escapes text for interpolation into an HTML template string.
 *
 * The UI builds markup with template literals, so every value that came from a user — a class
 * name, an assignment title — must pass through here. Without it, naming an assignment
 * `<img onerror=...>` would execute script in the page.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
