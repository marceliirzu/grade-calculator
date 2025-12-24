// Syllabus Parsing Service
const SyllabusService = {
    async parse(syllabusText) {
        const response = await Api.post('/syllabus/parse', { 
            content: syllabusText 
        });
        
        if (!response.success) {
            throw new Error(response.message || 'Failed to parse syllabus');
        }
        
        // Transform the response to match our frontend format
        const data = response.data;
        
        return {
            className: data.className || '',
            creditHours: data.creditHours || 3,
            categories: (data.categories || []).map(cat => ({
                name: cat.name,
                weight: cat.weight
            })),
            gradeScale: data.gradeScale ? {
                aPlus: data.gradeScale.aPlus || 97,
                a: data.gradeScale.a || 93,
                aMinus: data.gradeScale.aMinus || 90,
                bPlus: data.gradeScale.bPlus || 87,
                b: data.gradeScale.b || 83,
                bMinus: data.gradeScale.bMinus || 80,
                cPlus: data.gradeScale.cPlus || 77,
                c: data.gradeScale.c || 73,
                cMinus: data.gradeScale.cMinus || 70,
                dPlus: data.gradeScale.dPlus || 67,
                d: data.gradeScale.d || 63,
                dMinus: data.gradeScale.dMinus || 60
            } : null
        };
    }
};
