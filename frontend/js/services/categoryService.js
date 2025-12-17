// Category Service
const CategoryService = {
    // Create category
    async create(categoryData) {
        const response = await Api.post('/categories', categoryData);
        return response.data;
    },
    
    // Get category
    async getById(id) {
        const response = await Api.get(`/categories/${id}`);
        return response.data;
    },
    
    // Update category
    async update(id, categoryData) {
        const response = await Api.put(`/categories/${id}`, categoryData);
        return response.data;
    },
    
    // Delete category
    async delete(id) {
        await Api.delete(`/categories/${id}`);
    },
    
    // Add rule to category
    async addRule(categoryId, ruleData) {
        const response = await Api.post(`/categories/${categoryId}/rules`, ruleData);
        return response.data;
    },
    
    // Delete rule
    async deleteRule(ruleId) {
        await Api.delete(`/categories/rules/${ruleId}`);
    }
};
