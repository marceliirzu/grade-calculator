// Formatting Helper
const Formatters = {
    // Format percentage
    percentage(value, decimals = 1) {
        if (value === null || value === undefined) return '—';
        return parseFloat(value).toFixed(decimals) + '%';
    },
    
    // Format GPA - 2 decimal places, but whole numbers stay clean (4.0, 3.0)
    gpa(value) {
        if (value === null || value === undefined) return '—';
        const num = parseFloat(value);
        // Check if it's a whole number (4.0, 3.0, 2.0, 1.0, 0.0)
        if (num % 1 === 0) {
            return num.toFixed(1); // 4.0, 3.0, etc.
        }
        return num.toFixed(2); // 3.67, 3.33, etc.
    },
    
    // Format number
    number(value, decimals = 2) {
        if (value === null || value === undefined) return '—';
        return parseFloat(value).toFixed(decimals);
    },
    
    // Get letter grade from percentage using a grade scale
    letterGrade(percentage, gradeScale) {
        if (percentage === null || percentage === undefined) return '—';
        
        const scale = gradeScale || CONFIG.DEFAULT_GRADE_SCALE;
        const p = parseFloat(percentage);
        
        if (p >= scale.aPlus) return 'A+';
        if (p >= scale.a) return 'A';
        if (p >= scale.aMinus) return 'A-';
        if (p >= scale.bPlus) return 'B+';
        if (p >= scale.b) return 'B';
        if (p >= scale.bMinus) return 'B-';
        if (p >= scale.cPlus) return 'C+';
        if (p >= scale.c) return 'C';
        if (p >= scale.cMinus) return 'C-';
        if (p >= scale.dPlus) return 'D+';
        if (p >= scale.d) return 'D';
        if (p >= scale.dMinus) return 'D-';
        return 'F';
    },
    
    // Get grade color class
    gradeColorClass(letterGrade) {
        if (!letterGrade || letterGrade === '—') return '';
        
        const letter = letterGrade.charAt(0).toUpperCase();
        switch (letter) {
            case 'A': return 'grade-a';
            case 'B': return 'grade-b';
            case 'C': return 'grade-c';
            case 'D': return 'grade-d';
            case 'F': return 'grade-f';
            default: return '';
        }
    },
    
    // Get GPA points from letter grade (uses configurable A+ value)
    gpaPoints(letterGrade, aPlusValue = 4.0) {
        const scale = {
            'A+': aPlusValue,
            'A': 4.0,
            'A-': 3.67,
            'B+': 3.33,
            'B': 3.0,
            'B-': 2.67,
            'C+': 2.33,
            'C': 2.0,
            'C-': 1.67,
            'D+': 1.33,
            'D': 1.0,
            'D-': 0.67,
            'F': 0.0
        };
        return scale[letterGrade] ?? 0;
    },
    
    // Format rule type for display
    ruleType(type) {
        switch (type) {
            case 'DropLowest': return 'Drop Lowest';
            case 'CountHighest': return 'Count Highest';
            case 'WeightByScore': return 'Weight by Score';
            default: return type;
        }
    },
    
    // Format rule description
    ruleDescription(rule) {
        switch (rule.type) {
            case 'DropLowest':
                return `Drop lowest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
            case 'CountHighest':
                return `Count highest ${rule.value} grade${rule.value > 1 ? 's' : ''}`;
            case 'WeightByScore':
                return 'Weight grades by score (highest = most weight)';
            default:
                return rule.type;
        }
    },
    
    // Truncate text
    truncate(text, maxLength = 30) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
};
