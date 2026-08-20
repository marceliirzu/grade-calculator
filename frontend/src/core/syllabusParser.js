import { DEFAULT_SCALE } from './grading/bands.js';

/**
 * Deterministic syllabus parser that runs entirely in the browser.
 *
 * Two jobs:
 *  - It is the *only* parser guest mode has, since the AI fallback is server-side and metered
 *    per account.
 *  - For signed-in users it is not used directly; the server runs its own (stronger) regex pass
 *    first, so most syllabi never reach an LLM at all.
 *
 * Zero tokens, no network. Returns the same `SyllabusParseResponse` shape the API does so the
 * page code is identical in both modes.
 */

const LETTER_TO_KEY = {
  'A+': 'aPlus', A: 'a', 'A-': 'aMinus',
  'B+': 'bPlus', B: 'b', 'B-': 'bMinus',
  'C+': 'cPlus', C: 'c', 'C-': 'cMinus',
  'D+': 'dPlus', D: 'd', 'D-': 'dMinus',
};

const SCALE_ORDER = [
  'aPlus', 'a', 'aMinus', 'bPlus', 'b', 'bMinus',
  'cPlus', 'c', 'cMinus', 'dPlus', 'd', 'dMinus',
];

/** Lines that look like a category row but are headers, totals, or scale labels. */
const NOISE = [
  /^total/i, /^grades?\s*$/i, /^grading/i, /^final\s+grade/i, /^course\s+grade/i,
  /^letter/i, /^percentage/i, /^component/i, /^category/i, /^assessment/i,
  /^weight/i, /^evaluation/i, /^the\s/i, /^scale/i, /^breakdown/i,
];

const toLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

const isNoise = (name) => NOISE.some((pattern) => pattern.test(name));

function titleCase(name) {
  return name.replace(/[.:]+$/, '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------

function extractClassName(text) {
  const lines = toLines(text);

  // "MATH 2413 - Calculus I" / "MATH 2413: Calculus I"
  const codeWithTitle = /^([A-Z]{2,5}\s*-?\s*\d{3,5}[A-Z]?)\s*[-:]\s*(.+)/i;
  for (const line of lines.slice(0, 15)) {
    const match = line.match(codeWithTitle);
    if (match) return `${match[1].trim()} - ${match[2].trim()}`;
  }

  // "Course: Calculus I"
  const labelled = /^(?:course|class|subject)\s*(?:name|title)?\s*:\s*(.+)/i;
  for (const line of lines.slice(0, 15)) {
    const match = line.match(labelled);
    if (match) return match[1].trim();
  }

  // A bare course code, with the title likely on the following line.
  const codeOnly = /^([A-Z]{2,5}\s*-?\s*\d{3,5}[A-Z]?)$/i;
  for (let i = 0; i < Math.min(10, lines.length); i += 1) {
    const match = lines[i].match(codeOnly);
    if (!match) continue;

    const next = lines[i + 1];
    if (next && next.length > 3 && !/^\d/.test(next)) return `${match[1].trim()} - ${next.trim()}`;

    return match[1].trim();
  }

  return null;
}

function extractCreditHours(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:credit\s*hours?|cr\.?\s*hrs?|credits?|units?)\b/i,
    /credit\s*hours?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    /credits?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    /\((\d+(?:\.\d+)?)\s*(?:cr|credits?)\)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const value = Number.parseFloat(match[1]);
    // Fractional credits are kept as-is: a 1.5-credit lab rounded to 1 skews the GPA.
    if (value >= 0.5 && value <= 12) return value;
  }

  return null;
}

function extractCategories(text) {
  const lines = toLines(text);
  const found = [];

  const namedFirst = [
    /^[-•*]?\s*(.+?)\s*[:=\-–—]\s*(\d+(?:\.\d+)?)\s*%/,
    /^[-•*]?\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*%\)/,
  ];
  const percentFirst = /^[-•*]?\s*(\d+(?:\.\d+)?)\s*%\s*[-:–—]?\s*(.+)/;

  for (const line of lines) {
    for (const pattern of namedFirst) {
      const match = line.match(pattern);
      if (!match) continue;

      addCategory(found, match[1], Number.parseFloat(match[2]));
    }

    const reversed = line.match(percentFirst);
    if (reversed) addCategory(found, reversed[2], Number.parseFloat(reversed[1]));
  }

  // Points-based syllabi: convert each category to a share of the total.
  if (found.length === 0) {
    const pointRows = [];
    let totalPoints = 0;

    const pointPatterns = [
      /^[-•*]?\s*(.+?)\s*[:=\-–—]\s*(\d+(?:\.\d+)?)\s*(?:points?|pts?)\s*$/i,
      /^[-•*]?\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*(?:points?|pts?)\)/i,
    ];

    for (const line of lines) {
      for (const pattern of pointPatterns) {
        const match = line.match(pattern);
        if (!match) continue;

        const name = match[1].replace(/^[-•*\d.)\s]+/, '').trim();
        const points = Number.parseFloat(match[2]);

        if (name.length > 1 && name.length < 60 && points > 0 && !isNoise(name)) {
          pointRows.push({ name: titleCase(name), points });
          totalPoints += points;
        }
      }
    }

    // A single row is not a grading breakdown, it is a stray sentence.
    if (pointRows.length >= 2 && totalPoints > 0) {
      for (const row of pointRows) {
        found.push({ name: row.name, weight: Math.round((row.points / totalPoints) * 1000) / 10 });
      }
    }
  }

  // Whitespace-aligned tables.
  if (found.length === 0) {
    for (const line of lines) {
      const match = line.match(/^(.+?)\s{2,}(\d+(?:\.\d+)?)\s*%/);
      if (match) addCategory(found, match[1], Number.parseFloat(match[2]));
    }
  }

  return normalizeWeights(mergeByName(found));
}

function addCategory(target, rawName, weight) {
  const name = rawName.replace(/^[-•*\d.)\s]+/, '').replace(/\s*\(.*$/, '').trim();

  if (name.length <= 1 || name.length >= 60) return;
  if (!(weight > 0) || weight > 100) return;
  if (isNoise(name)) return;

  target.push({ name: titleCase(name), weight });
}

function mergeByName(categories) {
  const byName = new Map();

  for (const category of categories) {
    const key = category.name.toLowerCase().trim();
    const existing = byName.get(key);

    // The same row can match more than one pattern; summing would double-count it, so the
    // first match wins and duplicates are ignored.
    if (!existing) byName.set(key, { ...category });
  }

  return [...byName.values()];
}

/** Scales weights to exactly 100 when they are close but not exact (rounding in the syllabus). */
function normalizeWeights(categories) {
  if (categories.length === 0) return categories;

  const total = categories.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0 || total === 100) return categories;

  // Outside this band the numbers are probably not a single weight pool at all, and silently
  // rescaling them would invent a breakdown the syllabus never stated.
  if (total < 80 || total > 120) return categories;

  const factor = 100 / total;

  return categories.map((c) => ({ name: c.name, weight: Math.round(c.weight * factor * 10) / 10 }));
}

function extractGradeScale(text) {
  const lines = toLines(text);
  const scale = {};

  const patterns = [
    { rx: /^([A-D][+-]?)\s*[:=\-–—]\s*(\d+(?:\.\d+)?)\s*[-–—]+\s*\d+/i, letterFirst: true },
    { rx: /^([A-D][+-]?)\s*[:=\-–—]?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:or|and)?\s*(?:above|higher|over)/i, letterFirst: true },
    { rx: /^([A-D][+-]?)\s*[:=\-–—]?\s*(?:≥|>=?)?\s*(\d+(?:\.\d+)?)\s*%?$/i, letterFirst: true },
    { rx: /(\d+(?:\.\d+)?)\s*[-–—]+\s*\d+\s*%?\s*[:=\-–—]?\s*([A-D][+-]?)\b/i, letterFirst: false },
  ];

  for (const line of lines) {
    for (const { rx, letterFirst } of patterns) {
      const match = line.match(rx);
      if (!match) continue;

      const letter = (letterFirst ? match[1] : match[2]).toUpperCase();
      const minimum = Number.parseFloat(letterFirst ? match[2] : match[1]);

      if (!(minimum >= 0 && minimum <= 100)) continue;

      const key = LETTER_TO_KEY[letter];
      // First occurrence wins: later mentions are usually prose referring back to the table.
      if (key && scale[key] === undefined) scale[key] = minimum;
    }
  }

  // Fewer than three anchors is not enough signal to override the standard scale.
  return Object.keys(scale).length >= 3 ? fillGradeScale(scale) : null;
}

function fillGradeScale(partial) {
  const scale = { ...DEFAULT_SCALE, ...partial };

  // Infer the +/- variants around any main letter the syllabus did state.
  for (const letter of ['a', 'b', 'c', 'd']) {
    const plus = `${letter}Plus`;
    const minus = `${letter}Minus`;

    if (partial[letter] !== undefined && partial[plus] === undefined) {
      scale[plus] = Math.min(partial[letter] + 4, 100);
    }

    if (partial[letter] !== undefined && partial[minus] === undefined) {
      scale[minus] = partial[letter] - 3;
    }
  }

  // Force a strictly descending scale. A non-monotonic scale makes the band lookup return
  // nonsense, and inferred values can easily collide with stated ones.
  for (let i = 1; i < SCALE_ORDER.length; i += 1) {
    if (scale[SCALE_ORDER[i]] >= scale[SCALE_ORDER[i - 1]]) {
      scale[SCALE_ORDER[i]] = scale[SCALE_ORDER[i - 1]] - 1;
    }
  }

  return scale;
}

/**
 * Parses syllabus text locally.
 * @returns {{className: string|null, creditHours: number|null, categories: Array, gradeScale: object|null, source: string, tokensUsed: number, notes: string[]}}
 */
export function parseSyllabusLocally(text) {
  if (!text || !text.trim()) {
    return { className: null, creditHours: null, categories: [], gradeScale: null, source: 'deterministic', tokensUsed: 0, notes: [] };
  }

  const cleaned = text.trim();
  const categories = extractCategories(cleaned);
  const total = categories.reduce((sum, c) => sum + c.weight, 0);

  const notes = [];
  if (categories.length > 0 && Math.abs(total - 100) > 0.5) {
    notes.push(`The weights add up to ${Math.round(total * 10) / 10}%, not 100%. Please check them.`);
  }

  return {
    className: extractClassName(cleaned),
    creditHours: extractCreditHours(cleaned),
    categories,
    gradeScale: extractGradeScale(cleaned),
    source: 'deterministic',
    tokensUsed: 0,
    notes,
  };
}
