// Local Data Service - Stores all data in localStorage for non-Google users
const LocalDataService = {
    STORAGE_KEY: 'gc_local_classes',
    
    // Get all classes from local storage
    getClasses() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Error parsing local classes:', e);
            return [];
        }
    },
    
    // Save all classes to local storage
    saveClasses(classes) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(classes));
    },
    
    // Get a single class by ID
    getClass(classId) {
        const classes = this.getClasses();
        return classes.find(c => c.id === classId) || null;
    },
    
    // Create a new class
    createClass(classData) {
        const classes = this.getClasses();
        const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
        
        const newClass = {
            id: newId,
            name: classData.name,
            creditHours: classData.creditHours || 3,
            showOnlyCAndUp: classData.showOnlyCAndUp || false,
            categories: [],
            gradeScale: classData.gradeScale || this.getDefaultGradeScale(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        classes.push(newClass);
        this.saveClasses(classes);
        return newClass;
    },
    
    // Update a class
    updateClass(classId, updates) {
        const classes = this.getClasses();
        const index = classes.findIndex(c => c.id === classId);
        if (index === -1) return null;
        
        classes[index] = {
            ...classes[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveClasses(classes);
        return classes[index];
    },
    
    // Delete a class
    deleteClass(classId) {
        const classes = this.getClasses();
        const filtered = classes.filter(c => c.id !== classId);
        this.saveClasses(filtered);
        return true;
    },
    
    // Add a category to a class
    addCategory(classId, categoryData) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return null;
        
        const categories = classes[classIndex].categories || [];
        const newId = categories.length > 0 ? Math.max(...categories.map(c => c.id)) + 1 : 1;
        
        const newCategory = {
            id: newId,
            classId: classId,
            name: categoryData.name,
            weight: categoryData.weight || 0,
            sortOrder: categories.length,
            items: [],
            rules: [],
            createdAt: new Date().toISOString()
        };
        
        categories.push(newCategory);
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return newCategory;
    },
    
    // Update a category
    updateCategory(classId, categoryId, updates) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return null;
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return null;
        
        categories[catIndex] = {
            ...categories[catIndex],
            ...updates
        };
        
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return categories[catIndex];
    },
    
    // Delete a category
    deleteCategory(classId, categoryId) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return false;
        
        classes[classIndex].categories = (classes[classIndex].categories || [])
            .filter(c => c.id !== categoryId);
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return true;
    },
    
    // Add a grade item to a category
    addGradeItem(classId, categoryId, itemData) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return null;
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return null;
        
        const items = categories[catIndex].items || [];
        const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
        
        const newItem = {
            id: newId,
            categoryId: categoryId,
            name: itemData.name,
            pointsEarned: itemData.pointsEarned,
            pointsPossible: itemData.pointsPossible || 100,
            isWhatIf: itemData.isWhatIf || false,
            sortOrder: items.length,
            createdAt: new Date().toISOString()
        };
        
        items.push(newItem);
        categories[catIndex].items = items;
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return newItem;
    },
    
    // Update a grade item
    updateGradeItem(classId, categoryId, itemId, updates) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return null;
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return null;
        
        const items = categories[catIndex].items || [];
        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return null;
        
        items[itemIndex] = {
            ...items[itemIndex],
            ...updates
        };
        
        categories[catIndex].items = items;
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return items[itemIndex];
    },
    
    // Delete a grade item
    deleteGradeItem(classId, categoryId, itemId) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return false;
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return false;
        
        categories[catIndex].items = (categories[catIndex].items || [])
            .filter(i => i.id !== itemId);
        
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return true;
    },
    
    // Add a rule to a category
    addRule(classId, categoryId, ruleData) {
        console.log('LocalDataService.addRule called:', { classId, categoryId, ruleData });
        
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) {
            console.error('Class not found:', classId);
            return null;
        }
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) {
            console.error('Category not found:', categoryId);
            return null;
        }
        
        const rules = categories[catIndex].rules || [];
        const newId = rules.length > 0 ? Math.max(...rules.map(r => r.id)) + 1 : 1;
        
        const newRule = {
            id: newId,
            categoryId: categoryId,
            type: ruleData.type,
            value: ruleData.value,
            weightDistribution: ruleData.weightDistribution || null,
            createdAt: new Date().toISOString()
        };
        
        rules.push(newRule);
        categories[catIndex].rules = rules;
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        
        console.log('Rule saved. Updated category:', categories[catIndex]);
        console.log('All classes after save:', this.getClasses());
        
        return newRule;
    },
    
    // Delete a rule
    deleteRule(classId, categoryId, ruleId) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return false;
        
        const categories = classes[classIndex].categories || [];
        const catIndex = categories.findIndex(c => c.id === categoryId);
        if (catIndex === -1) return false;
        
        categories[catIndex].rules = (categories[catIndex].rules || [])
            .filter(r => r.id !== ruleId);
        
        classes[classIndex].categories = categories;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return true;
    },
    
    // Update grade scale for a class
    updateGradeScale(classId, gradeScale) {
        const classes = this.getClasses();
        const classIndex = classes.findIndex(c => c.id === classId);
        if (classIndex === -1) return null;
        
        classes[classIndex].gradeScale = gradeScale;
        classes[classIndex].updatedAt = new Date().toISOString();
        
        this.saveClasses(classes);
        return gradeScale;
    },
    
    // Get default grade scale
    getDefaultGradeScale() {
        return {
            aPlusGpaValue: CONFIG.A_PLUS_VALUE || 4.0,
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
        };
    },
    
    // Import class with categories and grades (for gradebook import)
    importClassWithGrades(classData, categories) {
        const newClass = this.createClass(classData);
        
        categories.forEach(cat => {
            const newCategory = this.addCategory(newClass.id, {
                name: cat.name,
                weight: cat.weight || 0
            });
            
            if (cat.items && cat.items.length > 0) {
                cat.items.forEach(item => {
                    this.addGradeItem(newClass.id, newCategory.id, {
                        name: item.name,
                        pointsEarned: item.pointsEarned,
                        pointsPossible: item.pointsPossible || 100
                    });
                });
            }
        });
        
        return this.getClass(newClass.id);
    }
};
