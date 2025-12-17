// Validation Helper
const Validation = {
    // Check if value is empty
    isEmpty(value) {
        return value === null || value === undefined || value === '' || 
               (Array.isArray(value) && value.length === 0);
    },
    
    // Check if value is a number
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    // Check if value is positive number
    isPositiveNumber(value) {
        return this.isNumber(value) && parseFloat(value) > 0;
    },
    
    // Check if value is in range
    isInRange(value, min, max) {
        const num = parseFloat(value);
        return this.isNumber(value) && num >= min && num <= max;
    },
    
    // Validate class name
    validateClassName(name) {
        if (this.isEmpty(name)) {
            return { valid: false, error: 'Class name is required' };
        }
        if (name.length > 100) {
            return { valid: false, error: 'Class name must be less than 100 characters' };
        }
        return { valid: true };
    },
    
    // Validate credit hours
    validateCreditHours(hours) {
        if (!this.isNumber(hours)) {
            return { valid: false, error: 'Credit hours must be a number' };
        }
        if (!this.isInRange(hours, 0.5, 10)) {
            return { valid: false, error: 'Credit hours must be between 0.5 and 10' };
        }
        return { valid: true };
    },
    
    // Validate category weight
    validateCategoryWeight(weight) {
        if (!this.isNumber(weight)) {
            return { valid: false, error: 'Weight must be a number' };
        }
        if (!this.isInRange(weight, 0, 100)) {
            return { valid: false, error: 'Weight must be between 0 and 100' };
        }
        return { valid: true };
    },
    
    // Validate total weights equal 100
    validateTotalWeights(categories) {
        const total = categories.reduce((sum, cat) => sum + parseFloat(cat.weight || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
            return { valid: false, error: `Weights must total 100% (currently ${total.toFixed(1)}%)` };
        }
        return { valid: true };
    },
    
    // Validate grade scale (each value should be less than the one above)
    validateGradeScale(scale) {
        const order = ['aPlus', 'a', 'aMinus', 'bPlus', 'b', 'bMinus', 'cPlus', 'c', 'cMinus', 'dPlus', 'd', 'dMinus'];
        
        for (let i = 0; i < order.length - 1; i++) {
            const current = parseFloat(scale[order[i]]);
            const next = parseFloat(scale[order[i + 1]]);
            
            if (!this.isNumber(current) || !this.isNumber(next)) {
                return { valid: false, error: 'All grade values must be numbers' };
            }
            if (current <= next) {
                return { valid: false, error: `${order[i].toUpperCase()} must be greater than ${order[i + 1].toUpperCase()}` };
            }
        }
        return { valid: true };
    },
    
    // Validate grade input
    validateGradeInput(earned, possible) {
        if (earned !== null && earned !== '' && !this.isNumber(earned)) {
            return { valid: false, error: 'Points earned must be a number' };
        }
        if (!this.isPositiveNumber(possible)) {
            return { valid: false, error: 'Points possible must be a positive number' };
        }
        return { valid: true };
    }
};
