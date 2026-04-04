// Gradebook Parser - Imports grades from pasted text/CSV
// Supports Canvas, Blackboard, and generic CSV/table formats
const GradebookParser = {

    parse(text) {
        if (!text || !text.trim()) return [];

        const cleaned = text.trim();

        // Try CSV first
        let grades = this._parseCSV(cleaned);
        if (grades.length > 0) return grades;

        // Try tab-separated
        grades = this._parseTSV(cleaned);
        if (grades.length > 0) return grades;

        // Try line-by-line patterns
        grades = this._parseLines(cleaned);
        if (grades.length > 0) return grades;

        return [];
    },

    // ==================== CSV Parser ====================
    _parseCSV(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];

        // Detect delimiter
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const delimiter = tabCount > commaCount ? '\t' : ',';

        const headers = this._splitRow(lines[0], delimiter).map(h => h.toLowerCase().trim());

        // Find relevant columns
        const nameCol = this._findColumn(headers, ['assignment', 'name', 'item', 'title', 'assessment', 'grade item']);
        const earnedCol = this._findColumn(headers, ['score', 'earned', 'points earned', 'grade', 'points', 'mark', 'your score']);
        const possibleCol = this._findColumn(headers, ['possible', 'points possible', 'out of', 'max', 'total', 'total points', 'max score']);

        if (nameCol === -1 && earnedCol === -1) return [];

        const grades = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = this._splitRow(lines[i], delimiter);
            if (cols.length <= Math.max(nameCol, earnedCol)) continue;

            const name = nameCol >= 0 ? cols[nameCol]?.trim() : `Grade ${i}`;
            const earnedStr = earnedCol >= 0 ? cols[earnedCol]?.trim() : '';
            const possibleStr = possibleCol >= 0 ? cols[possibleCol]?.trim() : '';

            if (!name && !earnedStr) continue;

            const earned = this._parseNumber(earnedStr);
            const possible = this._parseNumber(possibleStr) || 100;

            // Skip totals and headers that snuck in
            if (this._isSkipRow(name)) continue;

            grades.push({
                name: name || `Grade ${grades.length + 1}`,
                pointsEarned: earned,
                pointsPossible: possible,
                isWhatIf: false
            });
        }

        return grades;
    },

    // ==================== TSV Parser ====================
    _parseTSV(text) {
        if (!text.includes('\t')) return [];
        return this._parseCSV(text); // Already handles tab detection
    },

    // ==================== Line-by-Line Parser ====================
    _parseLines(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const grades = [];

        for (const line of lines) {
            // Pattern: "Assignment Name: 85/100" or "Assignment Name 85/100"
            let match = line.match(/^(.+?)\s*[:–—-]\s*(\d+(?:\.\d+)?)\s*[/]\s*(\d+(?:\.\d+)?)/);
            if (!match) {
                // Pattern: "Assignment Name: 85%"
                match = line.match(/^(.+?)\s*[:–—-]\s*(\d+(?:\.\d+)?)\s*%/);
                if (match) {
                    const name = match[1].replace(/^[-•*\d.)\s]+/, '').trim();
                    if (name.length > 0 && !this._isSkipRow(name)) {
                        grades.push({
                            name,
                            pointsEarned: parseFloat(match[2]),
                            pointsPossible: 100,
                            isWhatIf: false
                        });
                    }
                    continue;
                }

                // Pattern: "85/100 Assignment Name"
                match = line.match(/^(\d+(?:\.\d+)?)\s*[/]\s*(\d+(?:\.\d+)?)\s+(.+)/);
                if (match) {
                    const name = match[3].trim();
                    if (name.length > 0 && !this._isSkipRow(name)) {
                        grades.push({
                            name,
                            pointsEarned: parseFloat(match[1]),
                            pointsPossible: parseFloat(match[2]),
                            isWhatIf: false
                        });
                    }
                    continue;
                }

                continue;
            }

            const name = match[1].replace(/^[-•*\d.)\s]+/, '').trim();
            if (name.length > 0 && !this._isSkipRow(name)) {
                grades.push({
                    name,
                    pointsEarned: parseFloat(match[2]),
                    pointsPossible: parseFloat(match[3]),
                    isWhatIf: false
                });
            }
        }

        return grades;
    },

    // ==================== Helpers ====================

    _splitRow(line, delimiter) {
        // Handle quoted fields
        const fields = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current.trim());
        return fields;
    },

    _findColumn(headers, candidates) {
        for (const candidate of candidates) {
            const idx = headers.findIndex(h => h.includes(candidate));
            if (idx >= 0) return idx;
        }
        return -1;
    },

    _parseNumber(str) {
        if (!str) return null;
        // Remove % signs, commas, spaces
        const cleaned = str.replace(/[%,\s]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    },

    _isSkipRow(name) {
        if (!name) return true;
        const skip = [
            /^total/i, /^final\s+grade/i, /^course\s+total/i,
            /^weighted/i, /^cumulative/i, /^overall/i,
            /^current\s+score/i, /^current\s+grade/i,
            /^unposted/i, /^read\s+state/i
        ];
        return skip.some(p => p.test(name.trim()));
    }
};
