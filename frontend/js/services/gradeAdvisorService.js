// Grade Advisor Service - AI-powered grade chat
const GradeAdvisorService = {
    _history: [],

    async chat(message, semesterId = null) {
        const response = await Api.post('gradeadvisor/chat', {
            message,
            semesterId,
            history: this._history
        });
        // Update history from response
        if (response.updatedHistory) {
            this._history = response.updatedHistory;
        }
        return response.message || '';
    },

    async getTargetGrade(classId, targetGrade = 'A') {
        return await Api.get(`gradeadvisor/target?classId=${classId}&targetGrade=${encodeURIComponent(targetGrade)}`);
    },

    clearHistory() {
        this._history = [];
    },

    getHistory() {
        return [...this._history];
    }
};
