// Class Service
const ClassService = {
    // Get all classes
    async getAll() {
        const response = await Api.get('/classes');
        return response.data || [];
    },
    
    // Get single class
    async getById(id) {
        const response = await Api.get(`/classes/${id}`);
        return response.data;
    },
    
    // Create class
    async create(classData) {
        const response = await Api.post('/classes', classData);
        return response.data;
    },
    
    // Update class
    async update(id, classData) {
        const response = await Api.put(`/classes/${id}`, classData);
        return response.data;
    },
    
    // Delete class
    async delete(id) {
        await Api.delete(`/classes/${id}`);
    },
    
    // Update grade scale
    async updateGradeScale(classId, gradeScale) {
        const response = await Api.put(`/classes/${classId}/gradescale`, gradeScale);
        return response.data;
    },
    
    // Calculate GPA for all classes (local calculation)
    calculateOverallGpa(classes) {
        if (!classes || classes.length === 0) return null;
        
        let totalQualityPoints = 0;
        let totalCreditHours = 0;
        
        for (const cls of classes) {
            if (cls.gpa !== null && cls.gpa !== undefined) {
                totalQualityPoints += cls.gpa * cls.creditHours;
                totalCreditHours += cls.creditHours;
            }
        }
        
        if (totalCreditHours === 0) return null;
        return totalQualityPoints / totalCreditHours;
    }
};
