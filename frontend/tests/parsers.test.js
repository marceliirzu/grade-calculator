import { describe, expect, it } from 'vitest';

import { parseSyllabusLocally } from '../src/core/syllabusParser.js';
import { parseGradebook } from '../src/core/gradebookParser.js';

describe('syllabus parser', () => {
  it('reads a standard percentage breakdown', () => {
    const result = parseSyllabusLocally(`
      MATH 2413 - Calculus I
      3 Credit Hours

      Grading:
      - Homework: 25%
      - Quizzes: 15%
      - Midterm Exam: 25%
      - Final Exam: 35%
    `);

    expect(result.className).toBe('MATH 2413 - Calculus I');
    expect(result.creditHours).toBe(3);
    expect(result.categories).toEqual([
      { name: 'Homework', weight: 25 },
      { name: 'Quizzes', weight: 15 },
      { name: 'Midterm Exam', weight: 25 },
      { name: 'Final Exam', weight: 35 },
    ]);
  });

  it('keeps fractional credit hours instead of rounding them away', () => {
    // A 1.5-credit lab rounded to 1 silently skews every GPA it contributes to.
    const result = parseSyllabusLocally('BIOL 1106 Lab\n1.5 credit hours\nLab Reports: 100%');
    expect(result.creditHours).toBe(1.5);
  });

  it('converts a points-based syllabus into percentages', () => {
    const result = parseSyllabusLocally(`
      Grading breakdown:
      Homework: 200 points
      Exams: 600 points
      Participation: 200 points
    `);

    const byName = Object.fromEntries(result.categories.map((c) => [c.name, c.weight]));

    expect(byName.Homework).toBe(20);
    expect(byName.Exams).toBe(60);
    expect(byName.Participation).toBe(20);
  });

  it('does not treat a lone points mention as a grading breakdown', () => {
    // One row is a sentence, not a table; inventing a 100% category from it would be wrong.
    const result = parseSyllabusLocally('The final project is worth 300 points total.');
    expect(result.categories).toHaveLength(0);
  });

  it('rescales weights that are close to but not exactly 100', () => {
    const result = parseSyllabusLocally('Homework: 30%\nExams: 65%');
    const total = result.categories.reduce((sum, c) => sum + c.weight, 0);

    expect(total).toBeCloseTo(100, 1);
  });

  it('leaves weights alone when they are nowhere near 100', () => {
    // These are probably not one weight pool, so scaling them would fabricate a breakdown.
    const result = parseSyllabusLocally('Homework: 10%\nQuizzes: 5%');
    const total = result.categories.reduce((sum, c) => sum + c.weight, 0);

    expect(total).toBe(15);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('skips header and total rows', () => {
    const result = parseSyllabusLocally(`
      Category: Weight
      Homework: 40%
      Exams: 60%
      Total: 100%
    `);

    expect(result.categories.map((c) => c.name)).toEqual(['Homework', 'Exams']);
  });

  it('extracts a grade scale and forces it to descend', () => {
    const result = parseSyllabusLocally(`
      Homework: 100%
      Grade Scale:
      A: 90-100
      B: 80-89
      C: 70-79
      D: 60-69
    `);

    expect(result.gradeScale.a).toBe(90);
    expect(result.gradeScale.b).toBe(80);

    const order = ['aPlus', 'a', 'aMinus', 'bPlus', 'b', 'bMinus', 'cPlus', 'c', 'cMinus', 'dPlus', 'd', 'dMinus'];
    for (let i = 1; i < order.length; i += 1) {
      expect(result.gradeScale[order[i]]).toBeLessThan(result.gradeScale[order[i - 1]]);
    }
  });

  it('returns nothing rather than guessing on unparseable text', () => {
    const result = parseSyllabusLocally('Office hours are Tuesdays from 2 to 4 in Room 210.');
    expect(result.categories).toHaveLength(0);
  });

  it('handles empty input without throwing', () => {
    expect(parseSyllabusLocally('').categories).toHaveLength(0);
    expect(parseSyllabusLocally('   ').categories).toHaveLength(0);
  });
});

describe('gradebook parser', () => {
  it('parses "Name: earned/possible" lines', () => {
    const grades = parseGradebook('Homework 1: 85/100\nQuiz 1: 18/20');

    expect(grades).toEqual([
      { name: 'Homework 1', pointsEarned: 85, pointsPossible: 100, isWhatIf: false },
      { name: 'Quiz 1', pointsEarned: 18, pointsPossible: 20, isWhatIf: false },
    ]);
  });

  it('parses CSV with recognisable headers', () => {
    const grades = parseGradebook(
      'Assignment,Score,Points Possible\nHomework 1,85,100\nMidterm,140,150',
    );

    expect(grades).toHaveLength(2);
    expect(grades[1]).toEqual({ name: 'Midterm', pointsEarned: 140, pointsPossible: 150, isWhatIf: false });
  });

  it('honours quoted fields containing the delimiter', () => {
    const grades = parseGradebook('Assignment,Score,Possible\n"Essay 1, draft",18,20');

    expect(grades[0].name).toBe('Essay 1, draft');
    expect(grades[0].pointsEarned).toBe(18);
  });

  it('skips course-total rows that would double-count the term', () => {
    const grades = parseGradebook(
      'Assignment,Score,Possible\nHomework 1,85,100\nCourse Total,85,100\nFinal Grade,85,100',
    );

    expect(grades).toHaveLength(1);
    expect(grades[0].name).toBe('Homework 1');
  });

  it('treats a bare percentage as a score out of 100', () => {
    const grades = parseGradebook('Participation: 95%');
    expect(grades[0]).toEqual({ name: 'Participation', pointsEarned: 95, pointsPossible: 100, isWhatIf: false });
  });

  it('parses tab-separated exports', () => {
    const grades = parseGradebook('Assignment\tScore\tPossible\nLab 1\t45\t50');

    expect(grades).toHaveLength(1);
    expect(grades[0].pointsPossible).toBe(50);
  });

  it('returns an empty list for unrelated text', () => {
    expect(parseGradebook('There is no gradebook here.')).toEqual([]);
    expect(parseGradebook('')).toEqual([]);
  });
});
