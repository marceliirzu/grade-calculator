// Gradebook Service - AI parsing of gradebook data
const GradebookService = {
    async parse(content) {
        try {
            const response = await Api.post('/syllabus/parse-gradebook', { content });
            return response.data;
        } catch (error) {
            console.error('Gradebook parse error:', error);
            throw error;
        }
    }
};
