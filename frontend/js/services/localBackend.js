// LocalBackend — full client-side implementation of the API for guest mode.
// Mirrors the ASP.NET endpoints and response envelopes so every service and
// page works unchanged with data stored in localStorage. When real auth /
// billing / database are configured, signed-in users bypass this entirely.
const LocalBackend = {
    DB_KEY: 'gc_guest_db',

    // ---------------- storage ----------------
    _load() {
        const db = Storage.get(this.DB_KEY);
        if (db && Array.isArray(db.classes) && Array.isArray(db.semesters)) return db;
        return { seq: 1, semesters: [], classes: [] };
    },

    _save(db) {
        Storage.set(this.DB_KEY, db);
    },

    _nextId(db) {
        return db.seq++;
    },

    reset() {
        Storage.remove(this.DB_KEY);
    },

    // ---------------- envelopes ----------------
    _ok(data, message = null) {
        return { success: true, message, data };
    },

    _fail(message, status = 400) {
        const err = new Error(message);
        err.status = status;
        throw err;
    },

    // ---------------- router ----------------
    // Accepts the same (method, endpoint, body) the Api layer sends.
    async handle(method, endpoint, body) {
        // normalize: strip leading slashes, split query
        const [rawPath, rawQuery] = endpoint.replace(/^\/+/, '').split('?');
        const path = rawPath.replace(/\/+$/, '');
        const query = new URLSearchParams(rawQuery || '');
        const parts = path.split('/');
        const db = this._load();

        try {
            switch (parts[0]) {
                case 'classes':      return this._routeClasses(db, method, parts, query, body);
                case 'categories':   return this._routeCategories(db, method, parts, body);
                case 'grades':       return this._routeGrades(db, method, parts, body);
                case 'semesters':    return this._routeSemesters(db, method, parts, body);
                case 'syllabus':     return this._routeSyllabus(method, parts, body);
                case 'payments':     return this._routePayments(method, parts);
                case 'gradeadvisor': return this._fail('The Grade Advisor needs an account. Sign in to use it.');
                case 'auth':         return this._fail('Sign-in is not needed in guest mode.');
                default:             return this._fail(`Unknown endpoint: ${endpoint}`, 404);
            }
        } finally {
            // no-op; individual handlers save when they mutate
        }
    },

    // ---------------- classes ----------------
    _routeClasses(db, method, parts, query, body) {
        if (parts.length === 1 && method === 'GET') {
            let classes = db.classes;
            const semesterId = query.get('semesterId');
            if (semesterId) classes = classes.filter(c => c.semesterId === parseInt(semesterId));
            return this._ok(classes.map(c => this._mapClass(c)));
        }

        if (parts.length === 1 && method === 'POST') {
            const cls = {
                id: this._nextId(db),
                semesterId: body.semesterId ?? null,
                name: body.name,
                creditHours: Math.round(Number(body.creditHours) || 3),
                showOnlyCAndUp: !!body.showOnlyCAndUp,
                gradeScale: this._defaultScale(),
                categories: [
                    { id: this._nextId(db), name: 'Assignments', weight: 30, sortOrder: 0, gradeItems: [], rules: [] },
                    { id: this._nextId(db), name: 'Quizzes', weight: 20, sortOrder: 1, gradeItems: [], rules: [] },
                    { id: this._nextId(db), name: 'Exams', weight: 50, sortOrder: 2, gradeItems: [], rules: [] }
                ]
            };
            db.classes.push(cls);
            this._save(db);
            return this._ok(this._mapClass(cls));
        }

        const id = parseInt(parts[1]);
        const cls = db.classes.find(c => c.id === id);

        if (parts.length === 2) {
            if (!cls) return this._fail('Class not found', 404);
            if (method === 'GET') return this._ok(this._mapClass(cls));
            if (method === 'PUT') {
                cls.name = body.name;
                cls.creditHours = Math.round(Number(body.creditHours) || cls.creditHours);
                cls.showOnlyCAndUp = !!body.showOnlyCAndUp;
                if (body.semesterId !== undefined) cls.semesterId = body.semesterId;
                this._save(db);
                return this._ok(this._mapClass(cls));
            }
            if (method === 'DELETE') {
                db.classes = db.classes.filter(c => c.id !== id);
                this._save(db);
                return this._ok(true, 'Class deleted');
            }
        }

        if (parts.length === 3 && parts[2] === 'gradescale' && method === 'PUT') {
            if (!cls) return this._fail('Grade scale not found', 404);
            const keys = ['aPlus','a','aMinus','bPlus','b','bMinus','cPlus','c','cMinus','dPlus','d','dMinus'];
            keys.forEach(k => { if (body[k] !== undefined) cls.gradeScale[k] = Number(body[k]); });
            this._save(db);
            return this._ok({ ...cls.gradeScale });
        }

        return this._fail('Unknown classes route', 404);
    },

    // ---------------- categories ----------------
    _findCategory(db, id) {
        for (const cls of db.classes) {
            const cat = cls.categories.find(c => c.id === id);
            if (cat) return { cls, cat };
        }
        return null;
    },

    _routeCategories(db, method, parts, body) {
        if (parts.length === 1 && method === 'POST') {
            const cls = db.classes.find(c => c.id === body.classId);
            if (!cls) return this._fail('Class not found', 404);
            const cat = {
                id: this._nextId(db),
                name: body.name,
                weight: Number(body.weight) || 0,
                sortOrder: cls.categories.length,
                gradeItems: [],
                rules: []
            };
            cls.categories.push(cat);
            this._save(db);
            return this._ok(this._mapCategory(cat));
        }

        // DELETE /categories/rules/{ruleId}
        if (parts.length === 3 && parts[1] === 'rules' && method === 'DELETE') {
            const ruleId = parseInt(parts[2]);
            for (const cls of db.classes) {
                for (const cat of cls.categories) {
                    const before = cat.rules.length;
                    cat.rules = cat.rules.filter(r => r.id !== ruleId);
                    if (cat.rules.length !== before) {
                        this._save(db);
                        return this._ok(true, 'Rule deleted');
                    }
                }
            }
            return this._fail('Rule not found', 404);
        }

        const id = parseInt(parts[1]);
        const found = this._findCategory(db, id);

        if (parts.length === 2) {
            if (!found) return this._fail('Category not found', 404);
            if (method === 'GET') return this._ok(this._mapCategory(found.cat));
            if (method === 'PUT') {
                found.cat.name = body.name ?? found.cat.name;
                if (body.weight !== undefined) found.cat.weight = Number(body.weight);
                this._save(db);
                return this._ok(this._mapCategory(found.cat));
            }
            if (method === 'DELETE') {
                found.cls.categories = found.cls.categories.filter(c => c.id !== id);
                this._save(db);
                return this._ok(true, 'Category deleted');
            }
        }

        // POST /categories/{id}/rules
        if (parts.length === 3 && parts[2] === 'rules' && method === 'POST') {
            if (!found) return this._fail('Category not found', 404);
            const validTypes = ['DropLowest', 'CountHighest', 'WeightByScore'];
            if (!validTypes.includes(body.type)) return this._fail('Invalid rule type');
            const rule = {
                id: this._nextId(db),
                type: body.type,
                value: parseInt(body.value) || 0,
                weightDistribution: body.weightDistribution || null
            };
            found.cat.rules.push(rule);
            this._save(db);
            return this._ok({ ...rule });
        }

        return this._fail('Unknown categories route', 404);
    },

    // ---------------- grades ----------------
    _findGrade(db, id) {
        for (const cls of db.classes) {
            for (const cat of cls.categories) {
                const item = cat.gradeItems.find(g => g.id === id);
                if (item) return { cls, cat, item };
            }
        }
        return null;
    },

    _routeGrades(db, method, parts, body) {
        if (parts.length === 1 && method === 'POST') {
            const found = this._findCategory(db, body.categoryId);
            if (!found) return this._fail('Category not found', 404);
            const item = {
                id: this._nextId(db),
                name: body.name,
                pointsEarned: body.pointsEarned == null ? null : Number(body.pointsEarned),
                pointsPossible: Number(body.pointsPossible) || 100,
                isWhatIf: !!body.isWhatIf
            };
            found.cat.gradeItems.push(item);
            this._save(db);
            return this._ok(this._mapGradeItem(item));
        }

        const id = parseInt(parts[1]);
        const found = this._findGrade(db, id);
        if (!found) return this._fail('Grade not found', 404);

        if (parts.length === 2) {
            if (method === 'GET') return this._ok(this._mapGradeItem(found.item));
            if (method === 'PUT') {
                found.item.name = body.name ?? found.item.name;
                found.item.pointsEarned = body.pointsEarned == null ? null : Number(body.pointsEarned);
                if (body.pointsPossible !== undefined) found.item.pointsPossible = Number(body.pointsPossible) || 100;
                if (body.isWhatIf !== undefined) found.item.isWhatIf = !!body.isWhatIf;
                this._save(db);
                return this._ok(this._mapGradeItem(found.item));
            }
            if (method === 'DELETE') {
                found.cat.gradeItems = found.cat.gradeItems.filter(g => g.id !== id);
                this._save(db);
                return this._ok(true, 'Grade deleted');
            }
        }

        if (parts.length === 3 && parts[2] === 'whatif' && method === 'PUT') {
            found.item.isWhatIf = !found.item.isWhatIf;
            this._save(db);
            return this._ok(this._mapGradeItem(found.item));
        }

        return this._fail('Unknown grades route', 404);
    },

    // ---------------- semesters ----------------
    _routeSemesters(db, method, parts, body) {
        if (parts.length === 1 && method === 'GET') {
            const cumulative = this._cumulativeGpa(db);
            const sorted = [...db.semesters].sort((a, b) => b.year - a.year || (a.term > b.term ? 1 : -1));
            return this._ok(sorted.map(s => this._mapSemester(db, s, cumulative)));
        }

        if (parts.length === 1 && method === 'POST') {
            const sem = {
                id: this._nextId(db),
                name: body.name,
                year: parseInt(body.year),
                term: body.term,
                gpaGoal: body.gpaGoal == null ? null : Number(body.gpaGoal),
                createdAt: new Date().toISOString()
            };
            db.semesters.push(sem);
            this._save(db);
            return this._ok(this._mapSemester(db, sem, null));
        }

        const id = parseInt(parts[1]);
        const sem = db.semesters.find(s => s.id === id);
        if (!sem) return this._fail('Semester not found', 404);

        if (method === 'GET') return this._ok(this._mapSemester(db, sem, this._cumulativeGpa(db)));
        if (method === 'PUT') {
            sem.name = body.name;
            sem.year = parseInt(body.year);
            sem.term = body.term;
            sem.gpaGoal = body.gpaGoal == null ? null : Number(body.gpaGoal);
            this._save(db);
            return this._ok(this._mapSemester(db, sem, this._cumulativeGpa(db)));
        }
        if (method === 'DELETE') {
            db.semesters = db.semesters.filter(s => s.id !== id);
            // cascade like the real backend's SetNull
            db.classes.forEach(c => { if (c.semesterId === id) c.semesterId = null; });
            this._save(db);
            return this._ok(true, 'Semester deleted');
        }

        return this._fail('Unknown semesters route', 404);
    },

    // ---------------- syllabus / payments ----------------
    _routeSyllabus(method, parts, body) {
        if (parts[1] === 'parse' && method === 'POST') {
            const parsed = SyllabusParser.parse(body.syllabusText || '');
            if (!parsed || !parsed.categories || parsed.categories.length === 0) {
                return this._fail('Could not extract grading categories from this syllabus. Try pasting just the grading section.');
            }
            return this._ok(parsed);
        }
        return this._fail('Unknown syllabus route', 404);
    },

    _routePayments(method, parts) {
        if (parts[1] === 'subscription' && method === 'GET') {
            return this._ok({
                hasAccess: true,
                status: 'guest',
                trialEndsAt: null,
                currentPeriodEnd: null,
                billingConfigured: false
            });
        }
        return this._fail('Billing is not available in guest mode.');
    },

    // ================= grading math (mirrors the C# services) =================

    _defaultScale() {
        return {
            aPlus: 97, a: 93, aMinus: 90,
            bPlus: 87, b: 83, bMinus: 80,
            cPlus: 77, c: 73, cMinus: 70,
            dPlus: 67, d: 63, dMinus: 60
        };
    },

    _pct(item) {
        if (item.pointsEarned == null || !item.pointsPossible) return null;
        return (item.pointsEarned / item.pointsPossible) * 100;
    },

    // GradeRulesService.ApplyRules
    _applyRules(cat) {
        let items = cat.gradeItems.filter(g => g.pointsEarned != null);
        if (items.length === 0) return items;

        const order = { DropLowest: 0, CountHighest: 1, WeightByScore: 2 };
        const rules = [...cat.rules].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

        for (const rule of rules) {
            if (rule.type === 'DropLowest') {
                items = rule.value >= items.length
                    ? []
                    : [...items].sort((a, b) => (this._pct(a) ?? 0) - (this._pct(b) ?? 0)).slice(rule.value);
            } else if (rule.type === 'CountHighest') {
                if (rule.value < items.length) {
                    items = [...items].sort((a, b) => (this._pct(b) ?? 0) - (this._pct(a) ?? 0)).slice(0, rule.value);
                }
            }
        }
        return items;
    },

    // GpaCalculatorService.CalculateCategoryGrade
    _categoryGrade(cat) {
        const items = this._applyRules(cat);
        if (items.length === 0 || items.every(g => g.pointsEarned == null)) return null;

        const wbs = cat.rules.find(r => r.type === 'WeightByScore');
        if (wbs && wbs.weightDistribution && wbs.weightDistribution.length) {
            return this._weightedByScore(items, wbs.weightDistribution);
        }

        const scored = items.filter(g => g.pointsEarned != null);
        if (scored.length === 0) return null;
        const earned = scored.reduce((a, g) => a + g.pointsEarned, 0);
        const possible = scored.reduce((a, g) => a + g.pointsPossible, 0);
        if (possible === 0) return null;
        return (earned / possible) * 100;
    },

    _weightedByScore(items, weights) {
        const sorted = items
            .filter(g => g.pointsEarned != null)
            .sort((a, b) => (this._pct(b) ?? 0) - (this._pct(a) ?? 0));
        if (sorted.length === 0) return 0;

        let totalScore = 0, totalWeight = 0;
        for (let i = 0; i < sorted.length && i < weights.length; i++) {
            totalScore += (this._pct(sorted[i]) ?? 0) * weights[i];
            totalWeight += weights[i];
        }
        return totalWeight === 0 ? 0 : totalScore / totalWeight;
    },

    // GpaCalculatorService.CalculateClassGrade
    _classGrade(cls) {
        if (!cls.categories.length) return null;
        let weighted = 0, totalWeight = 0;
        for (const cat of cls.categories) {
            const g = this._categoryGrade(cat);
            if (g != null && cat.weight > 0) {
                weighted += g * (cat.weight / 100);
                totalWeight += cat.weight;
            }
        }
        if (totalWeight === 0) return null;
        return weighted / (totalWeight / 100);
    },

    _letterGrade(scale, pct) {
        if (pct >= scale.aPlus) return 'A+';
        if (pct >= scale.a) return 'A';
        if (pct >= scale.aMinus) return 'A-';
        if (pct >= scale.bPlus) return 'B+';
        if (pct >= scale.b) return 'B';
        if (pct >= scale.bMinus) return 'B-';
        if (pct >= scale.cPlus) return 'C+';
        if (pct >= scale.c) return 'C';
        if (pct >= scale.cMinus) return 'C-';
        if (pct >= scale.dPlus) return 'D+';
        if (pct >= scale.d) return 'D';
        if (pct >= scale.dMinus) return 'D-';
        return 'F';
    },

    _gpaPoints(letter) {
        const aPlus = (typeof CONFIG !== 'undefined' && CONFIG.A_PLUS_VALUE) || 4.0;
        const map = {
            'A+': aPlus, 'A': 4.0, 'A-': 3.67,
            'B+': 3.33, 'B': 3.0, 'B-': 2.67,
            'C+': 2.33, 'C': 2.0, 'C-': 1.67,
            'D+': 1.33, 'D': 1.0, 'D-': 0.67,
            'F': 0.0
        };
        return map[letter] ?? 0.0;
    },

    _classGpa(cls) {
        const grade = this._classGrade(cls);
        if (grade == null || !cls.gradeScale) return null;
        return this._gpaPoints(this._letterGrade(cls.gradeScale, grade));
    },

    _semesterGpa(classes) {
        let points = 0, credits = 0;
        for (const cls of classes) {
            const gpa = this._classGpa(cls);
            if (gpa != null) {
                points += gpa * cls.creditHours;
                credits += cls.creditHours;
            }
        }
        return credits === 0 ? null : points / credits;
    },

    _cumulativeGpa(db) {
        const gpa = this._semesterGpa(db.classes.filter(c => c.semesterId != null));
        return gpa == null ? null : Math.round(gpa * 100) / 100;
    },

    // ================= response mapping (mirrors the C# DTOs) =================

    _mapGradeItem(g) {
        return {
            id: g.id,
            name: g.name,
            pointsEarned: g.pointsEarned,
            pointsPossible: g.pointsPossible,
            percentage: this._pct(g),
            isWhatIf: g.isWhatIf
        };
    },

    _mapCategory(cat) {
        return {
            id: cat.id,
            name: cat.name,
            weight: cat.weight,
            currentGrade: this._categoryGrade(cat),
            gradeItems: cat.gradeItems.map(g => this._mapGradeItem(g)),
            rules: cat.rules.map(r => ({
                id: r.id,
                type: r.type,
                value: r.value,
                weightDistribution: r.weightDistribution
            }))
        };
    },

    _mapClass(cls) {
        const currentGrade = this._classGrade(cls);
        let letterGrade = null, gpa = null;
        if (currentGrade != null && cls.gradeScale) {
            letterGrade = this._letterGrade(cls.gradeScale, currentGrade);
            gpa = this._gpaPoints(letterGrade);
        }
        return {
            id: cls.id,
            name: cls.name,
            creditHours: cls.creditHours,
            showOnlyCAndUp: cls.showOnlyCAndUp,
            semesterId: cls.semesterId,
            currentGrade,
            letterGrade,
            gpa,
            gradeScale: cls.gradeScale ? { ...cls.gradeScale } : null,
            categories: cls.categories.map(c => this._mapCategory(c))
        };
    },

    _mapSemester(db, sem, cumulativeGpa) {
        const classes = db.classes.filter(c => c.semesterId === sem.id);
        const semesterGpa = this._semesterGpa(classes);
        const goalProgress = (semesterGpa != null && sem.gpaGoal > 0)
            ? Math.min(semesterGpa / sem.gpaGoal, 1.0)
            : null;

        return {
            id: sem.id,
            name: sem.name,
            year: sem.year,
            term: sem.term,
            gpaGoal: sem.gpaGoal,
            semesterGpa,
            cumulativeGpa,
            gpaGoalProgress: goalProgress,
            classCount: classes.length,
            classes: classes.map(c => this._mapClass(c)),
            createdAt: sem.createdAt
        };
    }
};
