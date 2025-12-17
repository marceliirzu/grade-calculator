// API Helper
const Api = {
    // Make a request
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        
        const defaultHeaders = {
            'Content-Type': 'application/json'
        };
        
        // Add auth token if available
        const token = Storage.getToken();
        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                Storage.removeToken();
                Storage.removeUser();
                // Optionally redirect to login
                window.location.reload();
                throw new Error('Unauthorized');
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // GET request
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    // POST request
    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },
    
    // PUT request
    async put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },
    
    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
