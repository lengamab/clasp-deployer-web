/**
 * ScriptFlow Authentication Manager
 * Handles login, logout, token management, and protected route access.
 */

const AuthManager = {
    // Configuration
    TOKEN_KEY: 'scriptflow_auth_token',
    USER_KEY: 'scriptflow_user',

    // Core Functions

    /**
     * Login user and save token
     */
    login: async (username, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Save session
            localStorage.setItem(AuthManager.TOKEN_KEY, data.token);
            localStorage.setItem(AuthManager.USER_KEY, JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Logout user and clear session
     */
    logout: () => {
        const token = AuthManager.getToken();

        // Notify server (optional, best effort)
        if (token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => { });
        }

        // Clear local storage
        localStorage.removeItem(AuthManager.TOKEN_KEY);
        localStorage.removeItem(AuthManager.USER_KEY);

        // Redirect to landing
        window.location.href = '/';
    },

    /**
     * Get current auth token
     */
    getToken: () => {
        return localStorage.getItem(AuthManager.TOKEN_KEY);
    },

    /**
     * Get current user info from storage
     */
    getUser: () => {
        const userStr = localStorage.getItem(AuthManager.USER_KEY);
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: () => {
        const token = AuthManager.getToken();
        // In a real app we would check expiration, but server will reject if expired
        return !!token;
    },

    /**
     * Middleware to enforce authentication on pages
     */
    requireAuth: () => {
        if (!AuthManager.isAuthenticated()) {
            console.log('🔒 Authentication required. Redirecting to login...');
            // Save return URL if needed
            sessionStorage.setItem('returnUrl', window.location.href);
            window.location.href = '/login';
            return false;
        }
        return true;
    },

    /**
     * Redirect enabled users away from public pages (like login/landing) to app
     */
    redirectIfAuthenticated: () => {
        if (AuthManager.isAuthenticated()) {
            window.location.href = '/app';
            return true;
        }
        return false;
    },

    /**
     * Add Authorization header to fetch options
     */
    authHeader: () => {
        const token = AuthManager.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    /**
     * Initialize global fetch interceptor
     */
    initInterceptor: () => {
        const originalFetch = window.fetch;
        window.fetch = async function (url, options = {}) {
            // Don't modify auth requests to avoid cycles
            if (url.includes('/api/auth/login')) {
                return originalFetch(url, options);
            }

            // Add auth header if token exists
            const token = AuthManager.getToken();
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }

            try {
                const response = await originalFetch(url, options);

                // Handle 401/403 Unauthorized globally
                if (response.status === 401 || response.status === 403) {
                    console.warn('Unauthorized access. Redirecting to login...');
                    AuthManager.logout();
                }

                return response;
            } catch (error) {
                throw error;
            }
        };
        console.log('🔒 Auth interceptor initialized');
    }
};

// Expose to window
window.AuthManager = AuthManager;

// Auto-initialize interceptor
AuthManager.initInterceptor();
