// Authentication Service with Google OAuth
const AuthService = {
    tokenKey: 'gc_token',
    userKey: 'gc_user',
    
    // Initialize Google Sign-In
    initGoogleSignIn() {
        return new Promise((resolve) => {
            if (typeof google === 'undefined') {
                console.log('Google API not loaded yet, waiting...');
                setTimeout(() => this.initGoogleSignIn().then(resolve), 100);
                return;
            }
            
            google.accounts.id.initialize({
                client_id: '131903826542-7qnjr23brvee37re47v2dcc93nknr3uf.apps.googleusercontent.com',
                callback: (response) => this.handleGoogleCallback(response),
                auto_select: false,
                cancel_on_tap_outside: true
            });
            
            resolve();
        });
    },
    
    // Handle Google Sign-In callback
    async handleGoogleCallback(response) {
        try {
            // Send the credential to our backend
            const result = await Api.post('/auth/google', {
                idToken: response.credential
            });
            
            if (result.success && result.data) {
                this.setToken(result.data.token);
                this.setUser(result.data.user);
                
                // Refresh the app
                App.updateAuthUI();
                App.navigate('landing');
            } else {
                alert('Sign in failed. Please try again.');
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert('Sign in failed. Please try again.');
        }
    },
    
    // Show Google Sign-In popup
    signInWithGoogle() {
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
                // Fall back to button click
                this.renderGoogleButton();
            }
        });
    },
    
    // Render Google Sign-In button (fallback)
    renderGoogleButton(elementId = 'googleSignInButton') {
        const element = document.getElementById(elementId);
        if (element) {
            google.accounts.id.renderButton(element, {
                theme: 'filled_black',
                size: 'large',
                width: 280,
                text: 'continue_with'
            });
        }
    },
    
    // Dev login (for local testing without Google)
    async devLogin() {
        try {
            const response = await Api.post('/auth/dev-login', {
                email: 'dev@gradecalculator.local'
            });
            
            if (response.success && response.data) {
                this.setToken(response.data.token);
                this.setUser(response.data.user);
                return response.data;
            }
            throw new Error(response.message || 'Dev login failed');
        } catch (error) {
            console.error('Dev login failed:', error);
            throw error;
        }
    },
    
    // Logout
    logout() {
        Storage.remove(this.tokenKey);
        Storage.remove(this.userKey);
        
        // Sign out from Google too
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
        }
        
        App.updateAuthUI();
        App.navigate('landing');
    },
    
    // Token management
    getToken() {
        return Storage.get(this.tokenKey);
    },
    
    setToken(token) {
        Storage.set(this.tokenKey, token);
    },
    
    // User management
    getCurrentUser() {
        return Storage.get(this.userKey);
    },
    
    setUser(user) {
        Storage.set(this.userKey, user);
    },
    
    isLoggedIn() {
        return !!this.getToken();
    }
};
