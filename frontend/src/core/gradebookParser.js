/**
 * Imports grades from text pasted out of Canvas, Blackboard, or a spreadsheet.
 *
 * Three strategies are tried in order of confidence: a delimited table with recognisable
 * headers, then per-line "Name: 85/100" patterns. Everything runs locally — this never touches
 * the network or an LLM, which is why importing a gradebook is free in both guest and
 * signed-in mode.
 */

/** Header aliases per column, matched by substring, most specific first. */
const NAME_HEADERS = ['assignment', 'grade item', 'name', 'item', 'title', 'assessment'];
const EARNED_HEADERS = ['points earned', 'your score', 'score', 'earned', 'grade', 'points', 'mark'];
const POSSIBLE_HEADERS = ['points possible', 'total points', 'max score', 'possible', 'out of', 'max', 'total'];

/**
 * Rows that are summaries or metadata rather than assignments. Importing a "Course Total" row
 * as an assignment would double-count the entire term.
 */
const SKIP_ROW = [
  /^total/i, /^final\s+grade/i, /^course\s+total/i,
  /^weighted/i, /^cumulative/i, /^overall/i,
  /^current\s+score/i, /^current\s+grade/i,
  /^unposted/i, /^read\s+state/i,
  /^student$/i, /^sis\s/i, /^integration\s+id$/i, /^section$/i,
  /^(?:student\s+)?id$/i,
];

const toLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

const isSkipRow = (name) => !name || SKIP_ROW.some((pattern) => pattern.test(name.trim()));

function parseNumber(value) {
  if (!value) return null;

  const cleaned = String(value).replace(/[%,\s]/g, '');
  const number = Number.parseFloat(cleaned);

  return Number.isNaN(number) ? null : number;
}

/** Splits one delimited row, honouring double-quoted fields that contain the delimiter. */
function splitRow(line, delimiter) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else current += char;
  }

  fields.push(current.trim());

  return fields;
}

const findColumn = (headers, candidates) => {
  for (const candidate of candidates) {
    const index = headers.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }

  return -1;
};

function parseDelimited(text) {
  const lines = toLines(text);
  if (lines.length < 2) return [];

  // Pick the delimiter by whichever appears more often in the header row. Assignment names
  // frequently contain commas, so counting the header alone is more reliable than the body.
  const tabs = (lines[0].match(/\t/g) ?? []).length;
  const commas = (lines[0].match(/,/g) ?? []).length;
  const delimiter = tabs > commas ? '\t' : ',';

  const headers = splitRow(lines[0], delimiter).map((h) => h.toLowerCase().trim());

  const nameColumn = findColumn(headers, NAME_HEADERS);
  const earnedColumn = findColumn(headers, EARNED_HEADERS);
  const possibleColumn = findColumn(headers, POSSIBLE_HEADERS);

  // Without at least a name or a score column this is not a gradebook table.
  if (nameColumn === -1 && earnedColumn === -1) return [];

  const grades = [];

  for (let i = 1; i < lines.length; i += 1) {
    const columns = splitRow(lines[i], delimiter);
    if (columns.length <= Math.max(nameColumn, earnedColumn)) continue;

    const name = nameColumn >= 0 ? (columns[nameColumn] ?? '').trim() : `Grade ${i}`;
    if (isSkipRow(name)) continue;

    const earned = earnedColumn >= 0 ? parseNumber(columns[earnedColumn]) : null;
    const possible = possibleColumn >= 0 ? parseNumber(columns[possibleColumn]) : null;

    // A row with neither a score nor a denominator carries no information.
    if (earned === null && possible === null) continue;

    grades.push({
      name: name || `Grade ${grades.length + 1}`,
      pointsEarned: earned,
      // Default to 100 so a percentage-only export still imports meaningfully.
      pointsPossible: possible ?? 100,
      isWhatIf: false,
    });
  }

  return grades;
}

function parseLines(text) {
  const grades = [];

  const scoreOverTotal = /^(.+?)\s*[:–—-]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/;
  const percentOnly = /^(.+?)\s*[:–—-]\s*(\d+(?:\.\d+)?)\s*%/;
  const totalFirst = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s+(.+)/;

  const push = (rawName, earned, possible) => {
    const name = String(rawName).replace(/^[-•*\d.)\s]+/, '').trim();
    if (!name || isSkipRow(name)) return;

    grades.push({ name, pointsEarned: earned, pointsPossible: possible, isWhatIf: false });
  };

  for (const line of toLines(text)) {
    const overTotal = line.match(scoreOverTotal);
    if (overTotal) {
      push(overTotal[1], Number.parseFloat(overTotal[2]), Number.parseFloat(overTotal[3]));
      continue;
    }

    const percent = line.match(percentOnly);
    if (percent) {
      push(percent[1], Number.parseFloat(percent[2]), 100);
      continue;
    }

    const reversed = line.match(totalFirst);
    if (reversed) push(reversed[3], Number.parseFloat(reversed[1]), Number.parseFloat(reversed[2]));
  }

  return grades;
}

/**
 * @param {string} text
 * @returns {Array<{name: string, pointsEarned: number|null, pointsPossible: number, isWhatIf: boolean}>}
 */
export function parseGradebook(text) {
  if (!text || !text.trim()) return [];

  const cleaned = text.trim();

  const delimited = parseDelimited(cleaned);
  if (delimited.length > 0) return delimited;

  return parseLines(cleaned);
}
