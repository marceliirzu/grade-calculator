// Semester Service - manages semesters (list, create, update, delete)
const SemesterService = {

    async getAll() {
        return await Api.get('semesters');
    },

    async getById(id) {
        return await Api.get(`semesters/${id}`);
    },

    async create(data) {
        // data: { name, year, term, gpaGoal? }
        return await Api.post('semesters', data);
    },

    async update(id, data) {
        // data: { name, year, term, gpaGoal? }
        return await Api.put(`semesters/${id}`, data);
    },

    async delete(id) {
        return await Api.delete(`semesters/${id}`);
    },

    // Helpers for current semester context (stored in localStorage)
    getCurrentSemesterId() {
        const val = Storage.get('gc_current_semester_id');
        return val ? parseInt(val) : null;
    },

    setCurrentSemesterId(id) {
        if (id === null || id === undefined) {
            Storage.remove('gc_current_semester_id');
        } else {
            Storage.set('gc_current_semester_id', id);
        }
    },

    // Returns display string for a semester
    formatSemesterName(semester) {
        return semester.name || `${semester.term} ${semester.year}`;
    },

    // Sort semesters most-recent first
    sortByRecent(semesters) {
        return [...semesters].sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            const termOrder = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 };
            return (termOrder[b.term] || 0) - (termOrder[a.term] || 0);
        });
    }
};
