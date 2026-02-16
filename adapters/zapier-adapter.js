/**
 * Zapier Platform Adapter
 * Integration with Zapier API
 */

const AutomationPlatform = require('../automation-platform.js');

class ZapierAdapter extends AutomationPlatform {
    constructor(config, credentials) {
        super(config, credentials);
    }

    /**
     * Fetch all Zaps from Zapier API
     */
    async getScenarios() {
        try {
            console.log(`[Zapier] Fetching Zaps...`);

            const url = this.buildApiUrl(this.config.api.endpoints.scenarios);
            const data = await this.makeApiRequest(url);

            // Zapier API returns objects array directly or in a data property
            const zaps = data.objects || data.data || data;

            return zaps.map(z => this.normalizeScenario(z));
        } catch (error) {
            console.error('[Zapier] Error fetching Zaps:', error);
            throw error;
        }
    }

    /**
     * Fetch detailed information about a specific Zap
     */
    async getScenarioDetails(zapId) {
        try {
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: zapId }
            );

            const data = await this.makeApiRequest(url);
            return this.normalizeScenario(data);
        } catch (error) {
            console.error(`[Zapier] Error fetching Zap ${zapId}:`, error);
            throw error;
        }
    }

    /**
     * Pull Zap from Zapier to local storage
     */
    async pullScenario(zapId, localPath) {
        try {
            console.log(`[Zapier] Pulling Zap ${zapId}...`);

            // Get Zap details
            const zap = await this.getScenarioDetails(zapId);

            // Create local directory
            const fs = require('fs');
            const path = require('path');
            const zapDir = path.join(localPath, zapId.toString());

            if (!fs.existsSync(zapDir)) {
                fs.mkdirSync(zapDir, { recursive: true });
            }

            // Save metadata
            const metadata = {
                id: zap.id,
                name: zap.name,
                platform: 'zapier',
                lastPull: new Date().toISOString(),
                state: zap.raw.state,
                url: zap.raw.url
            };

            fs.writeFileSync(
                path.join(zapDir, this.config.storage.metadataFile),
                JSON.stringify(metadata, null, 2)
            );

            // Save Zap configuration
            fs.writeFileSync(
                path.join(zapDir, this.config.storage.scenarioFile),
                JSON.stringify(zap.raw, null, 2)
            );

            console.log(`[Zapier] Successfully pulled Zap to ${zapDir}`);

            return {
                success: true,
                scenarioId: zapId,
                localPath: zapDir,
                metadata
            };
        } catch (error) {
            console.error(`[Zapier] Error pulling Zap ${zapId}:`, error);
            throw error;
        }
    }

    /**
     * Push local Zap changes to Zapier (NOT SUPPORTED)
     */
    async pushScenario(zapId, localPath) {
        throw new Error('Zapier API does not support programmatic updates to Zaps. Please edit your Zap at https://zapier.com/app/editor/' + zapId);
    }

    /**
     * Create a new Zap on Zapier (NOT SUPPORTED via simple API)
     */
    async createScenario(name, options = {}) {
        throw new Error('Zapier API requires OAuth and complex setup for creating Zaps. Please create Zaps directly in the Zapier interface at https://zapier.com/app/zaps');
    }

    /**
     * Delete a Zap from Zapier (NOT SUPPORTED)
     */
    async deleteScenario(zapId) {
        throw new Error('Zapier API does not support deleting Zaps programmatically. Please delete your Zap at https://zapier.com/app/editor/' + zapId);
    }

    /**
     * Test Zapier API connection
     */
    async testConnection() {
        try {
            const url = this.buildApiUrl(this.config.api.endpoints.user);
            const data = await this.makeApiRequest(url);

            return {
                success: true,
                user: data.email || data.full_name || 'Unknown',
                message: 'Successfully connected to Zapier API'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to connect to Zapier API. Please verify your API key at https://zapier.com/app/settings/api'
            };
        }
    }

    /**
     * Get authentication headers for Zapier API
     */
    getAuthHeaders() {
        return {
            'X-API-Key': this.credentials.apiKey
        };
    }

    /**
     * Normalize Zapier Zap to common format
     */
    normalizeScenario(rawZap) {
        return {
            id: rawZap.id,
            name: rawZap.title || rawZap.name || 'Untitled Zap',
            platform: 'zapier',
            isActive: rawZap.state === 'on',
            lastModified: rawZap.modified_at || null,
            description: rawZap.description || null,
            operations: rawZap.steps?.length || 0,
            url: rawZap.url || null,
            raw: rawZap
        };
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZapierAdapter;
}
