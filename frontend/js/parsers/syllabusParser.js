// Client-Side Syllabus Parser
// Extracts grading categories, grade scale, class name, and credit hours from pasted syllabus text
const SyllabusParser = {

    parse(text) {
        if (!text || !text.trim()) return null;

        const cleaned = text.trim();

        return {
            className: this.extractClassName(cleaned),
            creditHours: this.extractCreditHours(cleaned),
            categories: this.extractCategories(cleaned),
            gradeScale: this.extractGradeScale(cleaned)
        };
    },

    // ==================== Class Name ====================
    extractClassName(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // Pattern: "SUBJ 1234 - Course Title" or "SUBJ 1234: Course Title"
        const courseCodePattern = /^([A-Z]{2,5}\s*\d{3,5}[A-Z]?)\s*[-:]\s*(.+)/i;
        for (const line of lines.slice(0, 15)) {
            const match = line.match(courseCodePattern);
            if (match) {
                return `${match[1].trim()} - ${match[2].trim()}`;
            }
        }

        // Pattern: "Course: ..."  or "Class: ..."
        const labelPattern = /^(?:course|class|subject)\s*(?:name|title)?\s*[:]\s*(.+)/i;
        for (const line of lines.slice(0, 15)) {
            const match = line.match(labelPattern);
            if (match) return match[1].trim();
        }

        // Pattern: Just "SUBJ 1234" standalone
        const codeOnly = /^([A-Z]{2,5}\s*\d{3,5}[A-Z]?)$/i;
        for (const line of lines.slice(0, 10)) {
            const match = line.match(codeOnly);
            if (match) {
                // Look for a title on the next line
                const idx = lines.indexOf(line);
                if (idx < lines.length - 1 && lines[idx + 1].length > 3 && !lines[idx + 1].match(/^\d/)) {
                    return `${match[1].trim()} - ${lines[idx + 1].trim()}`;
                }
                return match[1].trim();
            }
        }

        return '';
    },

    // ==================== Credit Hours ====================
    extractCreditHours(text) {
        // "3 credit hours", "3 credits", "Credits: 3", "(3 cr.)", "3 cr hrs"
        const patterns = [
            /(\d+(?:\.\d+)?)\s*(?:credit\s*hour|cr\.?\s*hr|credit|cr\.?\b)/i,
            /credit\s*hours?\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
            /credits?\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
            /\((\d+)\s*(?:cr|credits?)\)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const val = parseFloat(match[1]);
                if (val >= 0.5 && val <= 10) return val;
            }
        }

        return 3; // default
    },

    // ==================== Categories ====================
    extractCategories(text) {
        const categories = [];
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // Strategy 1: Look for "Category: XX%" or "Category XX%" patterns
        const percentPatterns = [
            // "Homework: 25%" or "Homework - 25%" or "Homework (25%)"
            /^[-•*]?\s*(.+?)\s*[:=\-–—]\s*(\d+(?:\.\d+)?)\s*%/,
            /^[-•*]?\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*%\)/,
            // "25% Homework" or "25% - Homework"
            /^[-•*]?\s*(\d+(?:\.\d+)?)\s*%\s*[-:–—]?\s*(.+)/
        ];

        for (const line of lines) {
            for (const pattern of percentPatterns) {
                const match = line.match(pattern);
                if (match) {
                    let name, weight;
                    if (pattern === percentPatterns[2]) {
                        // Weight first, then name
                        weight = parseFloat(match[1]);
                        name = match[2].trim();
                    } else {
                        name = match[1].trim();
                        weight = parseFloat(match[2]);
                    }

                    // Clean up name
                    name = name.replace(/^[-•*\d.)\s]+/, '').trim();
                    name = name.replace(/\s*\(.*$/, '').trim();

                    // Filter noise
                    if (name.length > 1 && name.length < 60 && weight > 0 && weight <= 100) {
                        if (!this._isNoiseLine(name)) {
                            categories.push({ name: this._capitalizeCategory(name), weight });
                        }
                    }
                }
            }
        }

        // Strategy 2: Look for point-based grading "Homework: 200 points"
        if (categories.length === 0) {
            const pointCategories = [];
            let totalPoints = 0;

            const pointPatterns = [
                /^[-•*]?\s*(.+?)\s*[:=\-–—]\s*(\d+)\s*(?:points?|pts?)\s*$/i,
                /^[-•*]?\s*(.+?)\s*\((\d+)\s*(?:points?|pts?)\)/i
            ];

            for (const line of lines) {
                for (const pattern of pointPatterns) {
                    const match = line.match(pattern);
                    if (match) {
                        const name = match[1].replace(/^[-•*\d.)\s]+/, '').trim();
                        const points = parseInt(match[2]);
                        if (name.length > 1 && name.length < 60 && points > 0 && !this._isNoiseLine(name)) {
                            pointCategories.push({ name: this._capitalizeCategory(name), points });
                            totalPoints += points;
                        }
                    }
                }
            }

            // Convert points to percentages
            if (pointCategories.length >= 2 && totalPoints > 0) {
                for (const cat of pointCategories) {
                    categories.push({
                        name: cat.name,
                        weight: Math.round((cat.points / totalPoints) * 1000) / 10
                    });
                }
            }
        }

        // Strategy 3: Look for table-like formats
        if (categories.length === 0) {
            const tablePattern = /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s*%/;
            for (const line of lines) {
                const match = line.match(tablePattern);
                if (match) {
                    const name = match[1].trim();
                    const weight = parseFloat(match[2]);
                    if (name.length > 1 && weight > 0 && weight <= 100 && !this._isNoiseLine(name)) {
                        categories.push({ name: this._capitalizeCategory(name), weight });
                    }
                }
            }
        }

        // Deduplicate and combine similar categories
        const merged = this._mergeCategories(categories);

        // Normalize weights to 100% if close
        return this._normalizeWeights(merged);
    },

    // ==================== Grade Scale ====================
    extractGradeScale(text) {
        const scale = {};
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // Pattern: "A: 93-100" or "A 93-100%" or "A = 93%" or "93-100 A"
        const gradePatterns = [
            /^([A-D][+-]?)\s*[:=\-–—]\s*(\d+(?:\.\d+)?)\s*[-–—to]+\s*\d+/i,
            /^([A-D][+-]?)\s*[:=\-–—]?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:or|and|\s)\s*(?:above|higher|up|over)/i,
            /^([A-D][+-]?)\s*[:=\-–—]?\s*(?:≥|>=?)?\s*(\d+(?:\.\d+)?)\s*%?/i,
            /(\d+(?:\.\d+)?)\s*[-–—to]+\s*\d+\s*%?\s*[:=\-–—]?\s*([A-D][+-]?)/i,
        ];

        for (const line of lines) {
            for (const pattern of gradePatterns) {
                const match = line.match(pattern);
                if (match) {
                    let letter, minPct;
                    if (pattern === gradePatterns[3]) {
                        minPct = parseFloat(match[1]);
                        letter = match[2].toUpperCase();
                    } else {
                        letter = match[1].toUpperCase();
                        minPct = parseFloat(match[2]);
                    }

                    if (minPct >= 0 && minPct <= 100) {
                        const key = this._letterToKey(letter);
                        if (key && !scale[key]) {
                            scale[key] = minPct;
                        }
                    }
                }
            }
        }

        // If we found at least 3 grade thresholds, fill in missing ones
        if (Object.keys(scale).length >= 3) {
            return this._fillGradeScale(scale);
        }

        return null; // Use default
    },

    // ==================== Helper Methods ====================

    _isNoiseLine(name) {
        const noise = [
            /^total/i, /^grade/i, /^grading/i, /^final\s+grade/i,
            /^course\s+grade/i, /^letter/i, /^percentage/i,
            /^component/i, /^category/i, /^assessment/i,
            /^weight/i, /^evaluation/i, /^the\s/i
        ];
        return noise.some(p => p.test(name));
    },

    _capitalizeCategory(name) {
        // Remove trailing periods, colons
        name = name.replace(/[.:]+$/, '').trim();
        // Title case
        return name.replace(/\b\w/g, c => c.toUpperCase());
    },

    _mergeCategories(categories) {
        const merged = [];
        const seen = new Map();

        for (const cat of categories) {
            // Normalize for comparison: lowercase, remove numbers, trim
            const key = cat.name.toLowerCase()
                .replace(/\d+/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (seen.has(key)) {
                // Combine weights
                const existing = seen.get(key);
                existing.weight += cat.weight;
            } else {
                const entry = { ...cat };
                seen.set(key, entry);
                merged.push(entry);
            }
        }

        return merged;
    },

    _normalizeWeights(categories) {
        if (categories.length === 0) return categories;

        const total = categories.reduce((sum, c) => sum + c.weight, 0);

        // If total is close to 100 (within 5%), normalize exactly
        if (total > 0 && Math.abs(total - 100) <= 5) {
            const factor = 100 / total;
            return categories.map(c => ({
                name: c.name,
                weight: Math.round(c.weight * factor * 10) / 10
            }));
        }

        return categories;
    },

    _letterToKey(letter) {
        const map = {
            'A+': 'aPlus', 'A': 'a', 'A-': 'aMinus',
            'B+': 'bPlus', 'B': 'b', 'B-': 'bMinus',
            'C+': 'cPlus', 'C': 'c', 'C-': 'cMinus',
            'D+': 'dPlus', 'D': 'd', 'D-': 'dMinus'
        };
        return map[letter] || null;
    },

    _fillGradeScale(partial) {
        // Standard defaults
        const defaults = {
            aPlus: 97, a: 93, aMinus: 90,
            bPlus: 87, b: 83, bMinus: 80,
            cPlus: 77, c: 73, cMinus: 70,
            dPlus: 67, d: 63, dMinus: 60
        };

        const scale = { ...defaults };

        // Override with parsed values
        for (const [key, val] of Object.entries(partial)) {
            scale[key] = val;
        }

        // If we have A but not A+, infer A+ from A
        if (partial.a && !partial.aPlus) {
            scale.aPlus = Math.min(scale.a + 4, 100);
        }

        // Auto-fill +/- variants if main letter is present
        const letters = ['a', 'b', 'c', 'd'];
        for (const letter of letters) {
            const main = scale[letter];
            const plus = letter + 'Plus';
            const minus = letter + 'Minus';

            if (partial[letter] && !partial[plus]) {
                scale[plus] = main + 4;
            }
            if (partial[letter] && !partial[minus]) {
                scale[minus] = main - 3;
            }
        }

        // Ensure descending order
        const order = ['aPlus', 'a', 'aMinus', 'bPlus', 'b', 'bMinus', 'cPlus', 'c', 'cMinus', 'dPlus', 'd', 'dMinus'];
        for (let i = 1; i < order.length; i++) {
            if (scale[order[i]] >= scale[order[i - 1]]) {
                scale[order[i]] = scale[order[i - 1]] - 1;
            }
        }

        return scale;
    }
};
