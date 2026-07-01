// Grade Advisor Service - AI-powered grade chat
const GradeAdvisorService = {
    _history: [],

    async chat(message, semesterId = null) {
        const response = await Api.post('/gradeadvisor/chat', {
            message,
            semesterId,
            history: this._history
        });
        // ApiResponse envelope: { success, message, data: { message, updatedHistory } }
        const data = response.data || response;
        if (data.updatedHistory) {
            this._history = data.updatedHistory;
        }
        return data.message || '';
    },

    async getTargetGrade(classId, targetGrade = 'A') {
        const response = await Api.get(`/gradeadvisor/target?classId=${classId}&targetGrade=${encodeURIComponent(targetGrade)}`);
        return response.data || response;
    },

    clearHistory() {
        this._history = [];
    },

    getHistory() {
        return [...this._history];
    }
};
