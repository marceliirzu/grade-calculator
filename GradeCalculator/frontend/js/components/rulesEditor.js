// Rules Editor Component
const RulesEditor = {
    render(rules = []) {
        if (rules.length === 0) {
            return `
                <div class="rules-section">
                    <div class="rules-header">
                        <h3 class="rules-title">Grading Rules</h3>
                        <button class="btn btn-secondary btn-sm" id="addRuleBtn">+ Add Rule</button>
                    </div>
                    <p class="text-gray-500 text-sm">No rules applied. Add rules like "drop lowest" or "count highest".</p>
                </div>
            `;
        }
        
        const ruleItems = rules.map(rule => `
            <div class="rule-item" data-rule-id="${rule.id}">
                <div class="rule-description">
                    <span class="rule-icon">📏</span>
                    <span>${Formatters.ruleDescription(rule)}</span>
                </div>
                <button class="btn btn-ghost btn-icon delete-rule-btn" title="Remove Rule">🗑️</button>
            </div>
        `).join('');
        
        return `
            <div class="rules-section">
                <div class="rules-header">
                    <h3 class="rules-title">Grading Rules</h3>
                    <button class="btn btn-secondary btn-sm" id="addRuleBtn">+ Add Rule</button>
                </div>
                ${ruleItems}
            </div>
        `;
    }
};
