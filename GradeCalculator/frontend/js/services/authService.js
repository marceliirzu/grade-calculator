// Auth Service
const AuthService = {
    isLoggedIn() {
        return Storage.getUser() !== null;
    },
    
    isGoogleUser() {
        return Storage.isGoogleUser();
    },
    
    getUser() {
        return Storage.getUser();
    },
    
    logout() {
        Storage.clearAll();
        App.navigate('landing');
    },
    
    // Dev login - uses backend
    async devLogin() {
        try {
            const response = await Api.post('/auth/dev-login', {});
            
            if (response.data) {
                Storage.setToken(response.data.token);
                Storage.setUser(response.data.user);
                return response.data;
            }
            
            throw new Error('Login failed');
        } catch (error) {
            console.error('Dev login error:', error);
            throw error;
        }
    },
    
    // Google Sign-in
    signInWithGoogle() {
        // Check if Google Identity Services is loaded
        if (typeof google === 'undefined' || !google.accounts) {
            alert('Google Sign-in is not available. Please try again later or continue without logging in.');
            return;
        }
        
        try {
            google.accounts.id.initialize({
                client_id: CONFIG.GOOGLE_CLIENT_ID || '131903826542-7qnjr23brvee37re47v2dcc93nknr3uf.apps.googleusercontent.com',
                callback: this.handleGoogleCallback.bind(this),
                auto_select: false
            });
            
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed()) {
                    console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
                    // Fallback to redirect method
                    this.googleRedirectSignIn();
                } else if (notification.isSkippedMoment()) {
                    console.log('Google prompt skipped:', notification.getSkippedReason());
                }
            });
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert('Google Sign-in failed. Please try again or continue without logging in.');
        }
    },
    
    // Handle Google callback
    async handleGoogleCallback(response) {
        if (response.credential) {
            try {
                // Send the token to our backend
                const result = await Api.post('/auth/google', {
                    idToken: response.credential
                });
                
                if (result.data) {
                    Storage.setToken(result.data.token);
                    Storage.setUser(result.data.user);
                    Storage.clearLocalMode();
                    
                    App.updateAuthUI();
                    App.navigate('landing');
                }
            } catch (error) {
                console.error('Google auth error:', error);
                alert('Sign-in failed. Please try again.');
            }
        }
    },
    
    // Fallback redirect method for Google sign-in
    googleRedirectSignIn() {
        const clientId = CONFIG.GOOGLE_CLIENT_ID || '131903826542-7qnjr23brvee37re47v2dcc93nknr3uf.apps.googleusercontent.com';
        const redirectUri = `${CONFIG.API_BASE_URL}/auth/google-callback`;
        const scope = 'email profile';
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scope)}&` +
            `access_type=offline&` +
            `prompt=consent`;
        
        window.location.href = authUrl;
    }
};

