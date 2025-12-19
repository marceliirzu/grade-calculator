// Configuration
const CONFIG = {
    API_BASE_URL: 'https://grade-calculator-production-7ca8.up.railway.app/api',
    
    // A+ GPA value (can be 4.0 or 4.33)
    A_PLUS_VALUE: 4.0,
    
    // Default grade scale
    DEFAULT_GRADE_SCALE: {
        aPlus: 97,
        a: 93,
        aMinus: 90,
        bPlus: 87,
        b: 83,
        bMinus: 80,
        cPlus: 77,
        c: 73,
        cMinus: 70,
        dPlus: 67,
        d: 63,
        dMinus: 60
    },
    
    // Default categories
    DEFAULT_CATEGORIES: [
        { name: 'Assignments', weight: 30 },
        { name: 'Quizzes', weight: 20 },
        { name: 'Exams', weight: 50 }
    ],
    
    // GPA scale (A+ is dynamic based on A_PLUS_VALUE)
    getGpaScale() {
        return {
            'A+': this.A_PLUS_VALUE,
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
    },
    
    // Set A+ value
    setAPlusValue(value) {
        this.A_PLUS_VALUE = value;
        // Save to localStorage
        Storage.set('gc_aplus_value', value);
    },
    
    // Load A+ value from storage
    loadAPlusValue() {
        const saved = Storage.get('gc_aplus_value');
        if (saved !== null) {
            this.A_PLUS_VALUE = saved;
        }
    },
    
    // Rule types
    RULE_TYPES: {
        DROP_LOWEST: 'DropLowest',
        COUNT_HIGHEST: 'CountHighest',
        WEIGHT_BY_SCORE: 'WeightByScore'
    }
};
