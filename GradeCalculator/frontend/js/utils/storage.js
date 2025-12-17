// Local Storage Helper
const Storage = {
    // Keys
    KEYS: {
        AUTH_TOKEN: 'gc_auth_token',
        USER: 'gc_user',
        THEME: 'gc_theme'
    },
    
    // Get item
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },
    
    // Set item
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    // Remove item
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },
    
    // Clear all
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Storage clear error:', e);
            return false;
        }
    },
    
    // Auth helpers
    getToken() {
        return this.get(this.KEYS.AUTH_TOKEN);
    },
    
    setToken(token) {
        return this.set(this.KEYS.AUTH_TOKEN, token);
    },
    
    removeToken() {
        return this.remove(this.KEYS.AUTH_TOKEN);
    },
    
    getUser() {
        return this.get(this.KEYS.USER);
    },
    
    setUser(user) {
        return this.set(this.KEYS.USER, user);
    },
    
    removeUser() {
        return this.remove(this.KEYS.USER);
    }
};
