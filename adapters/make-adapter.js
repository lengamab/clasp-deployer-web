/**
 * Make.com Platform Adapter
 * Wraps existing Make.com functionality into the platform abstraction
 */

const AutomationPlatform = require('../automation-platform.js');

class MakeAdapter extends AutomationPlatform {
    constructor(config, credentials) {
        super(config, credentials);
        this.region = credentials.region || 'eu1';
    }

    /**
     * Fetch all scenarios from Make.com API
     */
    async getScenarios() {
        try {
            console.log(`[Make.com] Fetching scenarios...`);

            // Try different regions if needed
            const regions = [this.region, 'eu1', 'us1', 'ap1'];
            let scenarios = null;

            for (const region of regions) {
                try {
                    const url = this.buildApiUrl(this.config.api.endpoints.scenarios, {}, region);
                    const data = await this.makeApiRequest(url);

                    if (data.scenarios) {
                        scenarios = data.scenarios;
                        this.region = region; // Update region for future requests
                        break;
                    }
                } catch (err) {
                    console.warn(`[Make.com] Failed to fetch from ${region}:`, err.message);
                }
            }

            if (!scenarios) {
                throw new Error('Failed to fetch scenarios from all regions');
            }

            return scenarios.map(s => this.normalizeScenario(s));
        } catch (error) {
            console.error('[Make.com] Error fetching scenarios:', error);
            throw error;
        }
    }

    /**
     * Fetch detailed information about a specific scenario
     */
    async getScenarioDetails(scenarioId) {
        try {
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: scenarioId },
                this.region
            );

            const data = await this.makeApiRequest(url);
            return this.normalizeScenario(data.scenario || data);
        } catch (error) {
            console.error(`[Make.com] Error fetching scenario ${scenarioId}:`, error);
            throw error;
        }
    }

    /**
     * Pull scenario from Make.com to local storage
     */
    async pullScenario(scenarioId, localPath) {
        try {
            console.log(`[Make.com] Pulling scenario ${scenarioId}...`);

            // Get scenario details including blueprint
            const scenario = await this.getScenarioDetails(scenarioId);

            // Create local directory
            const fs = require('fs');
            const path = require('path');
            const scenarioDir = path.join(localPath, scenarioId.toString());

            if (!fs.existsSync(scenarioDir)) {
                fs.mkdirSync(scenarioDir, { recursive: true });
            }

            // Save metadata
            const metadata = {
                id: scenario.id,
                name: scenario.name,
                platform: 'make',
                teamId: scenario.raw.teamId,
                folderId: scenario.raw.folderId,
                lastPull: new Date().toISOString(),
                scheduling: scenario.raw.scheduling
            };

            fs.writeFileSync(
                path.join(scenarioDir, this.config.storage.metadataFile),
                JSON.stringify(metadata, null, 2)
            );

            // Save blueprint
            fs.writeFileSync(
                path.join(scenarioDir, this.config.storage.scenarioFile),
                JSON.stringify(scenario.raw.flow || scenario.raw, null, 2)
            );

            console.log(`[Make.com] Successfully pulled scenario to ${scenarioDir}`);

            return {
                success: true,
                scenarioId,
                localPath: scenarioDir,
                metadata
            };
        } catch (error) {
            console.error(`[Make.com] Error pulling scenario ${scenarioId}:`, error);
            throw error;
        }
    }

    /**
     * Push local scenario changes to Make.com
     */
    async pushScenario(scenarioId, localPath) {
        try {
            console.log(`[Make.com] Pushing scenario ${scenarioId}...`);

            const fs = require('fs');
            const path = require('path');
            const scenarioDir = path.join(localPath, scenarioId.toString());

            // Read local files
            const blueprintPath = path.join(scenarioDir, this.config.storage.scenarioFile);
            const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

            // Update scenario via API
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: scenarioId },
                this.region
            );

            await this.makeApiRequest(url, {
                method: 'PATCH',
                body: {
                    flow: blueprint
                }
            });

            // Update metadata
            const metadataPath = path.join(scenarioDir, this.config.storage.metadataFile);
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            metadata.lastPush = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            console.log(`[Make.com] Successfully pushed scenario ${scenarioId}`);

            return {
                success: true,
                scenarioId,
                pushedAt: metadata.lastPush
            };
        } catch (error) {
            console.error(`[Make.com] Error pushing scenario ${scenarioId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new scenario on Make.com
     */
    async createScenario(name, options = {}) {
        try {
            console.log(`[Make.com] Creating scenario: ${name}`);

            const url = this.buildApiUrl(this.config.api.endpoints.scenarios, {}, this.region);

            const body = {
                name,
                flow: [],
                scheduling: { type: 'indefinitely' },
                ...options
            };

            if (options.teamId) body.teamId = options.teamId;
            if (options.folderId) body.folderId = options.folderId;

            const data = await this.makeApiRequest(url, {
                method: 'POST',
                body
            });

            return this.normalizeScenario(data.scenario || data);
        } catch (error) {
            console.error(`[Make.com] Error creating scenario:`, error);
            throw error;
        }
    }

    /**
     * Delete a scenario from Make.com
     */
    async deleteScenario(scenarioId) {
        try {
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: scenarioId },
                this.region
            );

            await this.makeApiRequest(url, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error(`[Make.com] Error deleting scenario ${scenarioId}:`, error);
            return false;
        }
    }

    /**
     * Test Make.com API connection
     */
    async testConnection() {
        try {
            const url = this.buildApiUrl(this.config.api.endpoints.users, {}, this.region);
            const data = await this.makeApiRequest(url);

            return {
                success: true,
                user: data.authUser?.email || 'Unknown',
                region: this.region,
                message: 'Successfully connected to Make.com API'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to connect to Make.com API'
            };
        }
    }

    /**
     * Normalize Make.com scenario to common format
     */
    normalizeScenario(rawScenario) {
        return {
            id: rawScenario.id,
            name: rawScenario.name || 'Untitled Scenario',
            platform: 'make',
            isActive: rawScenario.scheduling?.active || false,
            lastModified: rawScenario.updatedAt || null,
            description: rawScenario.description || null,
            operations: rawScenario.flow?.length || 0,
            folder: rawScenario.folderName || 'Root',
            raw: rawScenario
        };
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MakeAdapter;
}
