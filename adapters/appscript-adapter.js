const _AutomationPlatform = (typeof AutomationPlatform !== 'undefined')
    ? AutomationPlatform
    : (typeof require !== 'undefined' ? require('../automation-platform.js') : null);

const fs = (typeof require !== 'undefined') ? require('fs') : null;
const path = (typeof require !== 'undefined') ? require('path') : null;
const os = (typeof require !== 'undefined') ? require('os') : null;
const axios = (typeof require !== 'undefined') ? require('axios') : null;
const child_process = (typeof require !== 'undefined') ? require('child_process') : null;
const spawn = child_process ? child_process.spawn : null;


/**
 * App Script Adapter
 * specialized for Google Apps Script via Clasp
 */
class AppScriptAdapter extends _AutomationPlatform {
    constructor(config, credentials, workspacePath) {
        super(config, credentials, workspacePath);
        this.scriptsDir = (path && this.workspacePath) ? path.join(this.workspacePath, 'scripts') : null;
        this.isBrowser = typeof window !== 'undefined';
    }

    /**
     * Test connection to Google Apps Script
     * Checks if we have valid tokens in .clasprc.json or custom token file
     */
    async testConnection() {
        if (this.isBrowser) {
            return { success: true, message: 'Browser mode initialized' };
        }
        try {
            const tokenData = await this.getValidToken();
            if (tokenData && tokenData.accessToken) {
                return { success: true, message: 'Connected via ' + tokenData.source };
            }
            return { success: false, error: 'No valid tokens found. Please run clasp login.' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get list of Apps Script projects
     * Tries Direct API first, falls back to clasp list CLI
     */
    async getScenarios() {
        if (this.isBrowser) {
            console.log('[AppScript] Fetching scenarios from backend...');
            try {
                const response = await fetch(`/api/platforms/appscript/scenarios`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credentials: this.credentials })
                });
                const data = await response.json();
                return data.scenarios || [];
            } catch (e) {
                console.error('[AppScript] Failed to fetch scenarios:', e);
                throw e;
            }
        }
        console.log('Fetching available scripts from Google account (Node)...');

        // METHOD 1: Direct API
        try {
            const tokenData = await this.getValidToken();

            if (tokenData && tokenData.accessToken) {
                console.log(`Using token from ${tokenData.source}`);
                const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
                    params: {
                        q: "mimeType='application/vnd.google-apps.script' and trashed=false",
                        fields: "nextPageToken, files(id, name, webViewLink, modifiedTime)",
                        pageSize: 100
                    },
                    headers: { 'Authorization': `Bearer ${tokenData.accessToken}` }
                });

                if (driveResponse.status === 200 && driveResponse.data.files) {
                    console.log(`✅ Direct API success! Found ${driveResponse.data.files.length} scripts.`);

                    // Map to standard format
                    const scripts = driveResponse.data.files.map(f => ({
                        id: f.id,
                        name: f.name,
                        platform: 'appscript',
                        active: true,
                        url: f.webViewLink || `https://script.google.com/d/${f.id}/edit`,
                        lastModified: f.modifiedTime,
                        metadata: {
                            scriptId: f.id,
                            webViewLink: f.webViewLink
                        }
                    }));

                    return this.augmentWithLocalStatus(scripts);
                }
            }
        } catch (apiError) {
            console.warn('⚠️ Direct API failed, falling back to CLI:', apiError.message);
        }

        // METHOD 2: Fallback to clasp list CLI
        try {
            const output = await this.runClaspCommand(['list'], this.workspacePath);

            // Parse output
            // Strip ANSI codes
            const cleanOutput = output.replace(/\x1B\[\d+m/g, '');
            const lines = cleanOutput.split('\n');
            const availableScripts = [];

            // Regex formats
            const regexParen = /(.+)\s+\((?:https:\/\/script\.google\.com\/d\/|id:)([\w\-_]+)(?:\/edit)?\)/;
            const regexDash = /(.+?)\s+-\s+https:\/\/script\.google\.com\/d\/([\w\-_]+)(?:\/edit)?/;

            for (const line of lines) {
                if (!line.trim()) continue;

                let name = null;
                let id = null;

                let match = line.match(regexDash);
                if (match) {
                    name = match[1].trim();
                    id = match[2];
                } else {
                    match = line.match(regexParen);
                    if (match) {
                        name = match[1].trim();
                        id = match[2];
                    }
                }

                if (name && id) {
                    availableScripts.push({
                        id: id,
                        name: name,
                        platform: 'appscript',
                        active: true,
                        url: `https://script.google.com/d/${id}/edit`,
                        metadata: { scriptId: id }
                    });
                }
            }

            return this.augmentWithLocalStatus(availableScripts);

        } catch (cliError) {
            console.error('clasp list failed:', cliError);
            throw new Error('Failed to list scripts via CLI: ' + cliError.message);
        }
    }

    /**
     * Helper to mark scripts as locally available
     */
    augmentWithLocalStatus(scripts) {
        const localScriptIds = new Set();
        if (fs.existsSync(this.scriptsDir)) {
            try {
                const items = fs.readdirSync(this.scriptsDir);
                for (const item of items) {
                    const itemPath = path.join(this.scriptsDir, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        const claspConfigPath = path.join(itemPath, '.clasp.json');
                        if (fs.existsSync(claspConfigPath)) {
                            try {
                                const claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
                                if (claspConfig.scriptId) {
                                    localScriptIds.add(claspConfig.scriptId);
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (e) { }
        }

        return scripts.map(script => ({
            ...script,
            isLocal: localScriptIds.has(script.id)
        }));
    }

    /**
     * Pull/Clone a script
     * If directory exists, it pulls. If not, it clones.
     * @param {string} scenarioId - The script ID
     * @param {string} destination - Not used directly as we have a specific scripts structure, but required by interface
     */
    async pullScenario(scenarioId, destination) {
        // Find script name if possible, or use ID
        // In the platform manager flow, we might need more metadata. 
        // For now, let's assume if it's a clone, we need a name.
        // If it's a pull, we assume the directory exists.

        // NOTE: The generic pullScenario primarily implies "get latest to local".
        // Check if we have this script locally mapped to a folder

        const localProject = this.findLocalProjectByScriptId(scenarioId);

        if (localProject) {
            return this.performPull(localProject.path, localProject.name);
        } else {
            // It's a new clone. generic interface usually passes ID.
            // We need a name for the folder.
            // We'll fetch the name from Drive API first
            let projectName = `project-${scenarioId}`;
            try {
                const tokenData = await this.getValidToken();
                if (tokenData && tokenData.accessToken) {
                    const fileRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${scenarioId}`, {
                        params: { fields: 'name' },
                        headers: { 'Authorization': `Bearer ${tokenData.accessToken}` }
                    });
                    if (fileRes.data && fileRes.data.name) {
                        projectName = fileRes.data.name;
                    }
                }
            } catch (e) {
                console.warn('Could not fetch script name, using default', e.message);
            }

            return this.performClone(scenarioId, projectName);
        }
    }

    async performPull(projectPath, projectName) {
        console.log(`Pulling ${projectName} in ${projectPath}...`);

        try {
            await this.runClaspCommand(['pull'], projectPath);
            this.updateTracking(projectPath, 'pull');
            return {
                success: true,
                message: `Successfully pulled ${projectName}`,
                path: projectPath
            };
        } catch (error) {
            throw new Error(`Failed to pull project: ${error.message}`);
        }
    }

    async performClone(scriptId, name) {
        console.log(`Cloning script ${name} (${scriptId})...`);

        // Create safe directory name
        const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const projectPath = path.join(this.scriptsDir, safeName);

        if (fs.existsSync(projectPath)) {
            throw new Error(`Directory '${safeName}' already exists. Please delete it or rename the project.`);
        }

        try {
            if (!fs.existsSync(this.scriptsDir)) {
                fs.mkdirSync(this.scriptsDir, { recursive: true });
            }
            fs.mkdirSync(projectPath, { recursive: true });

            await this.runClaspCommand(['clone', scriptId], projectPath);

            // Create tracking file
            const trackingFile = path.join(projectPath, '.clasp-deployer.json');
            const trackingData = {
                created: new Date().toISOString(),
                lastPull: new Date().toISOString(),
                scriptId: scriptId
            };
            fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));

            return {
                success: true,
                message: `Successfully cloned ${name}`,
                path: projectPath
            };
        } catch (error) {
            // Cleanup on fail
            if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length === 0) {
                fs.rmdirSync(projectPath);
            }
            throw new Error(`Failed to clone script: ${error.message}`);
        }
    }

    /**
     * Create a new script
     */
    async createScenario(name, options = {}) {
        console.log(`Creating new script: ${name}`);

        const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const projectPath = path.join(this.scriptsDir, safeName);

        if (fs.existsSync(projectPath)) {
            throw new Error(`Directory '${safeName}' already exists.`);
        }

        try {
            if (!fs.existsSync(this.scriptsDir)) {
                fs.mkdirSync(this.scriptsDir, { recursive: true });
            }
            fs.mkdirSync(projectPath, { recursive: true });

            // Type can be 'sheet', 'standalone', 'docs', 'slides', 'forms', 'webapp', 'api'
            const type = options.type || 'standalone';
            const args = ['create', '--title', name, '--type', type];
            if (options.parentId) {
                args.push('--parentId', options.parentId);
            }

            await this.runClaspCommand(args, projectPath);

            // Get the script ID from the new .clasp.json
            let scriptId = null;
            const claspJsonPath = path.join(projectPath, '.clasp.json');
            if (fs.existsSync(claspJsonPath)) {
                const claspConfig = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));
                scriptId = claspConfig.scriptId;
            }

            // Tracking
            const trackingFile = path.join(projectPath, '.clasp-deployer.json');
            const trackingData = {
                created: new Date().toISOString(),
                lastPull: new Date().toISOString(),
                scriptId: scriptId
            };
            fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));

            return {
                success: true,
                message: `Successfully created ${name}`,
                path: projectPath,
                id: scriptId
            };

        } catch (error) {
            if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length === 0) {
                fs.rmdirSync(projectPath);
            }
            throw new Error(`Failed to create script: ${error.message}`);
        }
    }

    /**
     * Push changes
     */
    async pushScenario(scenarioId) {
        // Find local path for this scriptId
        const localProject = this.findLocalProjectByScriptId(scenarioId);
        if (!localProject) {
            throw new Error(`Project for script ${scenarioId} not found locally.`);
        }

        try {
            await this.runClaspCommand(['push', '-f'], localProject.path);
            this.updateTracking(localProject.path, 'push');
            return {
                success: true,
                message: `Successfully pushed ${localProject.name}`
            };
        } catch (error) {
            throw new Error(`Failed to push: ${error.message}`);
        }
    }

    /**
     * Run an Apps Script function
     */
    async runFunction(scenarioId, functionName, options = {}) {
        const localProject = this.findLocalProjectByScriptId(scenarioId);
        if (!localProject) {
            throw new Error(`Project for script ${scenarioId} not found locally.`);
        }

        console.log(`Running function ${functionName} in project ${localProject.name}...`);

        try {
            const args = ['run', functionName];
            if (options.params) {
                // clasp run expects parameters as a JSON string
                args.push('--params', JSON.stringify(options.params));
            }

            const output = await this.runClaspCommand(args, localProject.path);
            return {
                success: true,
                message: `Successfully ran function ${functionName}`,
                output: output
            };
        } catch (error) {
            console.error(`Failed to run function ${functionName}:`, error);
            throw new Error(`Execution failed: ${error.message}`);
        }
    }

    /**
     * Get Apps Script logs
     */
    async getLogs(scenarioId, options = {}) {
        const localProject = this.findLocalProjectByScriptId(scenarioId);
        if (!localProject) {
            throw new Error(`Project for script ${scenarioId} not found locally.`);
        }

        console.log(`Fetching logs for project ${localProject.name}...`);

        try {
            const args = ['logs'];
            if (options.setup) args.push('--setup');
            if (options.watch) args.push('--watch');

            // Note: clasp logs --json output is easier to parse but we'll take raw for now
            const output = await this.runClaspCommand(args, localProject.path);
            return {
                success: true,
                message: 'Logs fetched successfully',
                logs: output
            };
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            throw new Error(`Failed to fetch logs: ${error.message}`);
        }
    }

    /**
     * Get list of functions in the script
     */
    async getFunctions(scenarioId) {
        const localProject = this.findLocalProjectByScriptId(scenarioId);
        if (!localProject) {
            throw new Error(`Project for script ${scenarioId} not found locally.`);
        }

        const functions = new Set();
        try {
            // Scan for .js and .ts files
            const files = fs.readdirSync(localProject.path);
            for (const file of files) {
                if (file.endsWith('.js') || file.endsWith('.ts')) {
                    const content = fs.readFileSync(path.join(localProject.path, file), 'utf8');
                    // Improved regex to find top-level function declarations
                    // Matches: function name(), export function name(), async function name()
                    const regex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        if (match[1]) functions.add(match[1]);
                    }

                    // Also match arrow functions assigned to const/let/var
                    // Matches: const name = () =>, export const name = () =>
                    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/g;
                    while ((match = arrowRegex.exec(content)) !== null) {
                        if (match[1]) functions.add(match[1]);
                    }
                }
            }
        } catch (error) {
            console.warn(`Error scanning functions in ${localProject.name}:`, error.message);
        }

        // Always include main as a fallback
        if (functions.size === 0) {
            functions.add('main');
        }

        return {
            success: true,
            functions: Array.from(functions)
        };
    }

    // --- Helpers ---

    findLocalProjectByScriptId(scriptId) {
        if (!fs.existsSync(this.scriptsDir)) return null;

        const items = fs.readdirSync(this.scriptsDir);
        for (const item of items) {
            const itemPath = path.join(this.scriptsDir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                const claspConfigPath = path.join(itemPath, '.clasp.json');
                if (fs.existsSync(claspConfigPath)) {
                    try {
                        const claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
                        if (claspConfig.scriptId === scriptId) {
                            return { name: item, path: itemPath };
                        }
                    } catch (e) { }
                }
            }
        }
        return null;
    }

    async runClaspCommand(args, cwd) {
        return new Promise((resolve, reject) => {
            const proc = spawn('npx', ['clasp', ...args], {
                cwd: cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false
            });

            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', d => output += d.toString());
            proc.stderr.on('data', d => errorOutput += d.toString());

            proc.on('close', code => {
                if (code !== 0) {
                    reject(new Error(errorOutput || output || `Command failed with code ${code}`));
                } else {
                    resolve(output);
                }
            });
        });
    }

    updateTracking(projectPath, operation) {
        const trackingFile = path.join(projectPath, '.clasp-deployer.json');
        let trackingData = {};
        if (fs.existsSync(trackingFile)) {
            try {
                trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
            } catch (e) { }
        }

        const now = new Date().toISOString();
        if (operation === 'push') trackingData.lastPush = now;
        if (operation === 'pull') trackingData.lastPull = now;

        try {
            fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));
        } catch (e) {
            console.warn('Failed to update tracking file', e);
        }
    }

    async getValidToken() {
        const clasprcPath = path.join(os.homedir(), '.clasprc.json');
        const customTokenPath = path.join(os.homedir(), '.clasp-deployer-token.json');

        let tokenSource = null;
        let tokens = null;
        let clientId, clientSecret;

        // Try custom token
        if (fs.existsSync(customTokenPath)) {
            try {
                tokens = JSON.parse(fs.readFileSync(customTokenPath, 'utf8'));
                tokenSource = { type: 'custom', path: customTokenPath, name: 'Custom Token' };
                // Keep clientId/Secret if available in clasprc to use for refresh
                if (fs.existsSync(clasprcPath)) {
                    const c = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
                    clientId = c.oauth2ClientSettings.clientId;
                    clientSecret = c.oauth2ClientSettings.clientSecret;
                }
            } catch (e) { }
        }

        // Try standard clasprc if no custom token
        if (!tokens && fs.existsSync(clasprcPath)) {
            try {
                const c = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
                tokens = c.token;
                clientId = c.oauth2ClientSettings.clientId;
                clientSecret = c.oauth2ClientSettings.clientSecret;
                tokenSource = { type: 'clasprc', path: clasprcPath, name: '.clasprc.json' };
            } catch (e) { }
        }

        if (!tokens) return null;

        // Check expiry and refresh if needed
        const expiryDate = tokens.expiry_date;
        const isExpired = expiryDate && (new Date().getTime() > expiryDate - 300000); // 5 min buffer

        if (isExpired && tokens.refresh_token && clientId && clientSecret) {
            console.log(`Refreshing expired token from ${tokenSource.name}...`);
            try {
                const refreshResponse = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: tokens.refresh_token,
                    grant_type: 'refresh_token'
                });

                if (refreshResponse.data && refreshResponse.data.access_token) {
                    const newAccessToken = refreshResponse.data.access_token;
                    // Update tokens object
                    tokens.access_token = newAccessToken;
                    if (refreshResponse.data.expires_in) {
                        tokens.expiry_date = new Date().getTime() + (refreshResponse.data.expires_in * 1000);
                    }

                    // Save back
                    if (tokenSource.type === 'custom') {
                        const newTokensFile = { ...tokens, ...refreshResponse.data }; // merge
                        fs.writeFileSync(customTokenPath, JSON.stringify(newTokensFile, null, 2));
                    }
                    // Note: We don't typically overwrite .clasprc.json automatically to avoid messing with official clasp, 
                    // but for this adapter to work persistently it might be needed. 
                    // For now, let's just use the new token in memory if it's clasprc, 
                    // or maybe we should rely on clasp itself to refresh when running commands.
                    // But for Direct API we need a valid token.
                }
            } catch (e) {
                console.error("Token refresh failed", e.message);
            }
        }

        return {
            accessToken: tokens.access_token,
            source: tokenSource.name
        };
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppScriptAdapter;
}

