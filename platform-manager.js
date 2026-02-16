/**
 * Platform Manager
 * Unified manager for all automation platform integrations
 */

class PlatformManager {
    constructor() {
        this.platforms = {};
        this.adapters = {};
        this.initialized = false;
    }

    /**
     * Initialize platform manager with user settings
     */
    async initialize() {
        console.log('📦 Initializing Platform Manager...');

        // Load platform configurations
        const allPlatforms = getAllPlatforms();
        allPlatforms.forEach(config => {
            this.platforms[config.id] = config;
        });

        // Initialize enabled platforms
        await this.loadEnabledPlatforms();

        this.initialized = true;
        console.log('✅ Platform Manager initialized');
    }

    /**
     * Load and initialize enabled platform adapters
     */
    async loadEnabledPlatforms() {
        const settings = this.getSettings();

        for (const [platformId, platformSettings] of Object.entries(settings.platforms || {})) {
            if (platformSettings.enabled && platformSettings.credentials) {
                try {
                    await this.enablePlatform(platformId, platformSettings.credentials);
                } catch (error) {
                    console.error(`Failed to enable platform ${platformId}:`, error);
                }
            }
        }
    }

    /**
     * Enable a platform with credentials
     */
    async enablePlatform(platformId, credentials) {
        const config = this.platforms[platformId];
        if (!config) {
            throw new Error(`Unknown platform: ${platformId}`);
        }

        console.log(`🔌 Enabling platform: ${config.name}`);

        // Create adapter instance based on platform type
        let adapter;
        switch (platformId) {
            case 'make':
                adapter = new MakeAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'zapier':
                adapter = new ZapierAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'n8n':
                adapter = new N8nAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'appscript':
                adapter = new AppScriptAdapter(config, credentials, this.getWorkspacePath());
                break;
            default:
                throw new Error(`No adapter implementation for platform: ${platformId}`);
        }

        // Test connection
        const connectionTest = await adapter.testConnection();
        if (!connectionTest.success) {
            throw new Error(`Connection test failed: ${connectionTest.error}`);
        }

        this.adapters[platformId] = adapter;
        console.log(`✅ Platform ${config.name} enabled`);

        return connectionTest;
    }

    /**
     * Disable a platform
     */
    disablePlatform(platformId) {
        delete this.adapters[platformId];
        console.log(`🔌 Platform ${platformId} disabled`);
    }

    /**
     * Get adapter for a platform
     */
    getAdapter(platformId) {
        const adapter = this.adapters[platformId];
        if (!adapter) {
            throw new Error(`Platform ${platformId} is not enabled or configured`);
        }
        return adapter;
    }

    /**
     * Get all enabled platforms
     */
    getEnabledPlatforms() {
        return Object.keys(this.adapters);
    }

    /**
     * Get platform configuration
     */
    getPlatformConfig(platformId) {
        return this.platforms[platformId];
    }

    /**
     * Get all scenarios from all enabled platforms
     */
    async getAllScenarios() {
        const allScenarios = [];

        for (const [platformId, adapter] of Object.entries(this.adapters)) {
            try {
                const scenarios = await adapter.getScenarios();
                allScenarios.push(...scenarios);
            } catch (error) {
                console.error(`Error fetching scenarios from ${platformId}:`, error);
            }
        }

        return allScenarios;
    }

    /**
     * Get scenarios from a specific platform
     */
    async getScenarios(platformId) {
        const adapter = this.getAdapter(platformId);
        return await adapter.getScenarios();
    }

    /**
     * Get scenario details from a specific platform
     */
    async getScenarioDetails(platformId, scenarioId) {
        const adapter = this.getAdapter(platformId);
        return await adapter.getScenarioDetails(scenarioId);
    }

    /**
     * Pull scenario from platform to local storage
     */
    async pullScenario(platformId, scenarioId) {
        const adapter = this.getAdapter(platformId);
        const localPath = adapter.getStorageDirectory();
        return await adapter.pullScenario(scenarioId, localPath);
    }

    /**
     * Push scenario from local storage to platform
     */
    async pushScenario(platformId, scenarioId) {
        const adapter = this.getAdapter(platformId);
        const localPath = adapter.getStorageDirectory();
        return await adapter.pushScenario(scenarioId, localPath);
    }

    /**
     * Create new scenario on platform
     */
    async createScenario(platformId, name, options = {}) {
        const adapter = this.getAdapter(platformId);
        return await adapter.createScenario(name, options);
    }

    /**
     * Delete scenario from platform
     */
    async deleteScenario(platformId, scenarioId) {
        const adapter = this.getAdapter(platformId);
        return await adapter.deleteScenario(scenarioId);
    }

    /**
     * Test connection to a platform
     */
    async testPlatformConnection(platformId, credentials) {
        const config = this.platforms[platformId];
        if (!config) {
            throw new Error(`Unknown platform: ${platformId}`);
        }

        // Create temporary adapter instance
        let adapter;
        switch (platformId) {
            case 'make':
                adapter = new MakeAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'zapier':
                adapter = new ZapierAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'n8n':
                adapter = new N8nAdapter(config, credentials, this.getWorkspacePath());
                break;
            case 'appscript':
                adapter = new AppScriptAdapter(config, credentials, this.getWorkspacePath());
                break;
            default:
                throw new Error(`No adapter for platform: ${platformId}`);
        }

        return await adapter.testConnection();
    }

    /**
     * Get or create settings object
     */
    getSettings() {
        const settings = localStorage.getItem('platformSettings');
        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                // Ensure appscript exists in settings if it's a new platform
                if (parsed.platforms && !parsed.platforms.appscript) {
                    parsed.platforms.appscript = { enabled: true, credentials: {} };
                    this.saveSettings(parsed);
                }
                return parsed;
            } catch (e) {
                console.error('Failed to parse platform settings', e);
            }
        }

        // Default settings structure
        return {
            workspacePath: '/Users/bricelengama/Documents/Marketing Opti/Cursor',
            platforms: {
                make: { enabled: true, credentials: null },
                zapier: { enabled: false, credentials: null },
                n8n: { enabled: false, credentials: null },
                appscript: { enabled: true, credentials: {} } // Enabled by default
            }
        };
    }

    /**
     * Get current workspace path
     */
    getWorkspacePath() {
        const settings = this.getSettings();
        return settings.workspacePath || '/Users/bricelengama/Documents/Marketing Opti/Cursor';
    }

    /**
     * Set workspace path
     */
    async setWorkspacePath(path) {
        const settings = this.getSettings();
        settings.workspacePath = path;
        this.saveSettings(settings);

        // Notify backend
        try {
            const authToken = window.AuthManager && typeof window.AuthManager.getToken === 'function'
                ? window.AuthManager.getToken()
                : localStorage.getItem('scriptflow_auth_token');
            await fetch('/api/settings/workspace', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({ workspacePath: path })
            });
        } catch (e) {
            console.warn('Failed to sync workspace path to secondary backend', e);
        }

        // Re-initialize adapters with new path
        await this.loadEnabledPlatforms();

        // Refresh UI if possible
        if (window.dashboardManager) {
            window.dashboardManager.refreshAll();
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings(settings) {
        localStorage.setItem('platformSettings', JSON.stringify(settings));
    }

    /**
     * Update platform credentials
     */
    async updatePlatformCredentials(platformId, credentials) {
        const settings = this.getSettings();

        if (!settings.platforms[platformId]) {
            settings.platforms[platformId] = { enabled: false };
        }

        settings.platforms[platformId].credentials = credentials;
        this.saveSettings(settings);

        // Re-enable platform if it was already enabled
        if (this.adapters[platformId]) {
            await this.enablePlatform(platformId, credentials);
        }
    }

    /**
     * Toggle platform enabled state
     */
    async togglePlatform(platformId, enabled) {
        const settings = this.getSettings();

        if (!settings.platforms[platformId]) {
            settings.platforms[platformId] = { enabled: false, credentials: null };
        }

        settings.platforms[platformId].enabled = enabled;
        this.saveSettings(settings);

        if (enabled && settings.platforms[platformId].credentials) {
            await this.enablePlatform(platformId, settings.platforms[platformId].credentials);
        } else if (!enabled) {
            this.disablePlatform(platformId);
        }
    }
}

// Initialize global instance
window.platformManager = new PlatformManager();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.platformManager.initialize();
    } catch (error) {
        console.error('Failed to initialize Platform Manager:', error);
    }
});
