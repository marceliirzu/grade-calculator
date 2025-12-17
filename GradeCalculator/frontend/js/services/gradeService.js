// Grade Service
const GradeService = {
    // Create grade
    async create(gradeData) {
        const response = await Api.post('/grades', gradeData);
        return response.data;
    },
    
    // Get grade
    async getById(id) {
        const response = await Api.get(`/grades/${id}`);
        return response.data;
    },
    
    // Update grade
    async update(id, gradeData) {
        const response = await Api.put(`/grades/${id}`, gradeData);
        return response.data;
    },
    
    // Delete grade
    async delete(id) {
        await Api.delete(`/grades/${id}`);
    },
    
    // Toggle what-if mode
    async toggleWhatIf(id) {
        const response = await Api.put(`/grades/${id}/whatif`);
        return response.data;
    }
};
