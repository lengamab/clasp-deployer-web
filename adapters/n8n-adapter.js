/**
 * n8n Platform Adapter
 * Integration with n8n self-hosted or cloud instances
 */

const AutomationPlatform = require('../automation-platform.js');

class N8nAdapter extends AutomationPlatform {
    constructor(config, credentials) {
        super(config, credentials);
        this.instanceUrl = credentials.instanceUrl;

        if (!this.instanceUrl) {
            throw new Error('n8n instance URL is required');
        }

        // Ensure URL doesn't have trailing slash
        this.instanceUrl = this.instanceUrl.replace(/\/$/, '');
    }

    /**
     * Build API URL for n8n instance
     */
    buildApiUrl(endpoint, params = {}) {
        let url = `${this.instanceUrl}/api/v1${endpoint}`;

        // Replace URL parameters
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, value);
        }

        return url;
    }

    /**
     * Fetch all workflows from n8n
     */
    async getScenarios() {
        try {
            console.log(`[n8n] Fetching workflows from ${this.instanceUrl}...`);

            const url = this.buildApiUrl(this.config.api.endpoints.scenarios);
            const data = await this.makeApiRequest(url);

            // n8n returns { data: [...] }
            const workflows = data.data || data;

            return workflows.map(w => this.normalizeScenario(w));
        } catch (error) {
            console.error('[n8n] Error fetching workflows:', error);
            throw error;
        }
    }

    /**
     * Fetch detailed information about a specific workflow
     */
    async getScenarioDetails(workflowId) {
        try {
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: workflowId }
            );

            const data = await this.makeApiRequest(url);
            return this.normalizeScenario(data.data || data);
        } catch (error) {
            console.error(`[n8n] Error fetching workflow ${workflowId}:`, error);
            throw error;
        }
    }

    /**
     * Pull workflow from n8n to local storage
     */
    async pullScenario(workflowId, localPath) {
        try {
            console.log(`[n8n] Pulling workflow ${workflowId}...`);

            // Get workflow details
            const workflow = await this.getScenarioDetails(workflowId);

            // Create local directory
            const fs = require('fs');
            const path = require('path');
            const workflowDir = path.join(localPath, workflowId.toString());

            if (!fs.existsSync(workflowDir)) {
                fs.mkdirSync(workflowDir, { recursive: true });
            }

            // Save metadata
            const metadata = {
                id: workflow.id,
                name: workflow.name,
                platform: 'n8n',
                instanceUrl: this.instanceUrl,
                lastPull: new Date().toISOString(),
                active: workflow.raw.active,
                tags: workflow.raw.tags || []
            };

            fs.writeFileSync(
                path.join(workflowDir, this.config.storage.metadataFile),
                JSON.stringify(metadata, null, 2)
            );

            // Save workflow JSON
            fs.writeFileSync(
                path.join(workflowDir, this.config.storage.scenarioFile),
                JSON.stringify(workflow.raw, null, 2)
            );

            console.log(`[n8n] Successfully pulled workflow to ${workflowDir}`);

            return {
                success: true,
                scenarioId: workflowId,
                localPath: workflowDir,
                metadata
            };
        } catch (error) {
            console.error(`[n8n] Error pulling workflow ${workflowId}:`, error);
            throw error;
        }
    }

    /**
     * Push local workflow changes to n8n
     */
    async pushScenario(workflowId, localPath) {
        try {
            console.log(`[n8n] Pushing workflow ${workflowId}...`);

            const fs = require('fs');
            const path = require('path');
            const workflowDir = path.join(localPath, workflowId.toString());

            // Read local workflow file
            const workflowPath = path.join(workflowDir, this.config.storage.scenarioFile);
            const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

            // Update workflow via API
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: workflowId }
            );

            await this.makeApiRequest(url, {
                method: 'PATCH',
                body: workflow
            });

            // Update metadata
            const metadataPath = path.join(workflowDir, this.config.storage.metadataFile);
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            metadata.lastPush = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            console.log(`[n8n] Successfully pushed workflow ${workflowId}`);

            return {
                success: true,
                scenarioId: workflowId,
                pushedAt: metadata.lastPush
            };
        } catch (error) {
            console.error(`[n8n] Error pushing workflow ${workflowId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new workflow on n8n
     */
    async createScenario(name, options = {}) {
        try {
            console.log(`[n8n] Creating workflow: ${name}`);

            const url = this.buildApiUrl(this.config.api.endpoints.scenarios);

            const body = {
                name,
                nodes: [],
                connections: {},
                active: false,
                settings: {},
                ...options
            };

            const data = await this.makeApiRequest(url, {
                method: 'POST',
                body
            });

            return this.normalizeScenario(data.data || data);
        } catch (error) {
            console.error(`[n8n] Error creating workflow:`, error);
            throw error;
        }
    }

    /**
     * Delete a workflow from n8n
     */
    async deleteScenario(workflowId) {
        try {
            const url = this.buildApiUrl(
                this.config.api.endpoints.scenario,
                { id: workflowId }
            );

            await this.makeApiRequest(url, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error(`[n8n] Error deleting workflow ${workflowId}:`, error);
            return false;
        }
    }

    /**
     * Test n8n API connection
     */
    async testConnection() {
        try {
            // n8n doesn't have a dedicated user endpoint, so we test by fetching workflows
            const url = this.buildApiUrl(this.config.api.endpoints.scenarios);
            await this.makeApiRequest(url);

            return {
                success: true,
                instanceUrl: this.instanceUrl,
                message: 'Successfully connected to n8n instance'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                instanceUrl: this.instanceUrl,
                message: 'Failed to connect to n8n instance. Please verify your instance URL and API key.'
            };
        }
    }

    /**
     * Get authentication headers for n8n API
     */
    getAuthHeaders() {
        return {
            'X-N8N-API-KEY': this.credentials.apiKey
        };
    }

    /**
     * Get web URL for viewing workflow in n8n UI
     */
    getWebUrl(workflowId) {
        return `${this.instanceUrl}/workflow/${workflowId}`;
    }

    /**
     * Normalize n8n workflow to common format
     */
    normalizeScenario(rawWorkflow) {
        return {
            id: rawWorkflow.id,
            name: rawWorkflow.name || 'Untitled Workflow',
            platform: 'n8n',
            isActive: rawWorkflow.active || false,
            lastModified: rawWorkflow.updatedAt || null,
            description: rawWorkflow.description || null,
            operations: rawWorkflow.nodes?.length || 0,
            tags: rawWorkflow.tags || [],
            raw: rawWorkflow
        };
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = N8nAdapter;
}
