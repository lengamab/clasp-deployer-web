/**
 * Automation Platform Base Class
 * Abstract interface that all platform adapters must implement
 */

class AutomationPlatform {
    constructor(config, credentials, workspacePath = null) {
        if (this.constructor === AutomationPlatform) {
            throw new Error("AutomationPlatform is an abstract class and cannot be instantiated directly");
        }

        this.config = config;
        this.credentials = credentials;
        this.platformId = config.id;
        this.platformName = config.name;
        this.workspacePath = workspacePath || '/Users/bricelengama/Documents/Marketing Opti/Cursor';
    }

    // ============================================================
    // ABSTRACT METHODS - Must be implemented by subclasses
    // ============================================================

    /**
     * Fetch all scenarios/workflows from the platform API
     * @returns {Promise<Array>} Array of scenario objects
     */
    async getScenarios() {
        throw new Error("Method 'getScenarios()' must be implemented by subclass");
    }

    /**
     * Fetch detailed information about a specific scenario
     * @param {string} scenarioId - The scenario/workflow ID
     * @returns {Promise<object>} Scenario details
     */
    async getScenarioDetails(scenarioId) {
        throw new Error("Method 'getScenarioDetails()' must be implemented by subclass");
    }

    /**
     * Pull (download) a scenario from the platform to local storage
     * @param {string} scenarioId - The scenario/workflow ID
     * @param {string} localPath - Local directory path to save to
     * @returns {Promise<object>} Result with status and metadata
     */
    async pullScenario(scenarioId, localPath) {
        throw new Error("Method 'pullScenario()' must be implemented by subclass");
    }

    /**
     * Push (upload) local scenario changes to the platform
     * @param {string} scenarioId - The scenario/workflow ID
     * @param {string} localPath - Local directory path to read from
     * @returns {Promise<object>} Result with status
     */
    async pushScenario(scenarioId, localPath) {
        throw new Error("Method 'pushScenario()' must be implemented by subclass");
    }

    /**
     * Create a new scenario on the platform
     * @param {string} name - Scenario name
     * @param {object} options - Additional options (description, folder, etc.)
     * @returns {Promise<object>} Created scenario details
     */
    async createScenario(name, options = {}) {
        throw new Error("Method 'createScenario()' must be implemented by subclass");
    }

    /**
     * Delete a scenario from the platform
     * @param {string} scenarioId - The scenario/workflow ID
     * @returns {Promise<boolean>} True if successful
     */
    async deleteScenario(scenarioId) {
        throw new Error("Method 'deleteScenario()' must be implemented by subclass");
    }

    /**
     * Test the API connection and credentials
     * @returns {Promise<object>} Status object with success/error info
     */
    async testConnection() {
        throw new Error("Method 'testConnection()' must be implemented by subclass");
    }

    // ============================================================
    // CONCRETE HELPER METHODS - Available to all subclasses
    // ============================================================

    /**
     * Build API URL from endpoint pattern
     * @param {string} endpoint - Endpoint pattern (e.g., '/scenarios/:id')
     * @param {object} params - Parameters to replace in pattern
     * @param {string} region - Region/version to use (defaults to platform default)
     * @returns {string} Full API URL
     */
    buildApiUrl(endpoint, params = {}, region = null) {
        region = region || this.config.api.defaultRegion;
        const baseUrl = this.config.api.baseUrls[region];

        if (!baseUrl) {
            throw new Error(`Invalid region '${region}' for platform '${this.platformId}'`);
        }

        // Replace URL parameters
        let url = baseUrl + endpoint;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, value);
        }

        return url;
    }

    /**
     * Make authenticated API request
     * @param {string} url - Full API URL
     * @param {object} options - Fetch options (method, body, headers, etc.)
     * @returns {Promise<object>} Response data
     */
    async makeApiRequest(url, options = {}) {
        const headers = this.getAuthHeaders();

        const fetchOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers,
                ...(options.headers || {})
            }
        };

        if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message ||
                    `API request failed: ${response.status} ${response.statusText}`
                );
            }

            return await response.json();
        } catch (error) {
            console.error(`[${this.platformName}] API Error:`, error);
            throw error;
        }
    }

    /**
     * Get authentication headers for API requests
     * @returns {object} Headers object
     */
    getAuthHeaders() {
        const authType = this.config.api.authType;

        switch (authType) {
            case 'token':
                return {
                    'Authorization': `Token ${this.credentials.apiToken}`
                };
            case 'apikey':
                return {
                    'X-API-Key': this.credentials.apiKey
                };
            case 'oauth':
                return {
                    'Authorization': `Bearer ${this.credentials.accessToken}`
                };
            default:
                return {};
        }
    }

    /**
     * Format scenario object to common structure
     * @param {object} rawScenario - Platform-specific scenario data
     * @returns {object} Normalized scenario object
     */
    normalizeScenario(rawScenario) {
        // Default implementation - subclasses should override
        return {
            id: rawScenario.id,
            name: rawScenario.name || 'Untitled',
            platform: this.platformId,
            isActive: rawScenario.active || false,
            lastModified: rawScenario.updatedAt || null,
            raw: rawScenario // Keep original data
        };
    }

    /**
     * Get local storage directory for this platform
     * @returns {string} Directory path
     */
    getStorageDirectory() {
        return `${this.workspacePath}/${this.config.storage.directory}`;
    }

    /**
     * Check if platform supports a specific feature
     * @param {string} feature - Feature name (e.g., 'supportsPush')
     * @returns {boolean} True if feature is supported
     */
    supportsFeature(feature) {
        return this.config.features[feature] || false;
    }

    /**
     * Get platform display color
     * @returns {string} Hex color code
     */
    getColor() {
        return this.config.color;
    }

    /**
     * Get platform icon class
     * @returns {string} Font Awesome icon class
     */
    getIcon() {
        return this.config.icon;
    }

    /**
     * Get web URL for viewing scenario in platform UI
     * @param {string} scenarioId - Scenario ID
     * @returns {string} Web URL
     */
    getWebUrl(scenarioId) {
        if (!this.config.ui.webUrl) return null;
        return this.config.ui.webUrl.replace(':id', scenarioId);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutomationPlatform;
}
