// Storage utility for localStorage operations
const Storage = {
    // Keys
    TOKEN_KEY: 'gc_token',
    USER_KEY: 'gc_user',
    APLUS_KEY: 'gc_aplus_value',
    LOCAL_MODE_KEY: 'gc_local_mode',
    
    // Token methods
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },
    
    setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    },
    
    removeToken() {
        localStorage.removeItem(this.TOKEN_KEY);
    },
    
    // User methods
    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    },
    
    setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },
    
    removeUser() {
        localStorage.removeItem(this.USER_KEY);
    },
    
    // Check if user is logged in with Google (not local mode)
    isGoogleUser() {
        const user = this.getUser();
        if (!user) return false;
        // Google users have a real googleId that doesn't start with 'local-' or 'dev-'
        return user.googleId && 
               !user.googleId.startsWith('local-') && 
               !user.googleId.startsWith('dev-');
    },
    
    // Check if using local storage mode
    isLocalMode() {
        return localStorage.getItem(this.LOCAL_MODE_KEY) === 'true';
    },
    
    // Set local user mode (for "continue without signing in")
    setLocalUser() {
        const localUser = {
            id: 0,
            googleId: 'local-' + Date.now(),
            email: 'local@device',
            name: 'Local User'
        };
        this.setUser(localUser);
        localStorage.setItem(this.LOCAL_MODE_KEY, 'true');
    },
    
    // Clear local mode
    clearLocalMode() {
        localStorage.removeItem(this.LOCAL_MODE_KEY);
    },
    
    // A+ value methods
    getAPlusValue() {
        const value = localStorage.getItem(this.APLUS_KEY);
        return value ? parseFloat(value) : 4.0;
    },
    
    setAPlusValue(value) {
        localStorage.setItem(this.APLUS_KEY, value.toString());
    },
    
    // Generic get/set
    get(key) {
        const value = localStorage.getItem(key);
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    },
    
    set(key, value) {
        if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            localStorage.setItem(key, value);
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    },
    
    // Clear all app data
    clearAll() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.LOCAL_MODE_KEY);
        // Don't clear A+ preference or local classes
    },
    
    // Full clear including local data
    clearEverything() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('gc_'));
        keys.forEach(k => localStorage.removeItem(k));
    }
};
