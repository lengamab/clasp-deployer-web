/**
 * Settings Manager
 * Handles user preferences, API tokens, and UI themes for multiple platforms.
 */
class SettingsManager {
    constructor() {
        this.elements = {
            modal: document.getElementById('settingsModal'),
            toggleContainer: document.getElementById('themeToggleContainer'),
            toggleOptions: document.querySelectorAll('.toggle-option'),
            trigger: document.getElementById('settingsBtn'),
            workspacePath: document.getElementById('setting-workspace-path')
        };

        // Platform-specific elements
        this.platformElements = {
            make: {
                enabled: document.getElementById('platform-make-enabled'),
                token: document.getElementById('platform-make-token'),
                status: document.getElementById('platform-make-status')
            },
            zapier: {
                enabled: document.getElementById('platform-zapier-enabled'),
                apiKey: document.getElementById('platform-zapier-apikey'),
                status: document.getElementById('platform-zapier-status')
            },
            n8n: {
                enabled: document.getElementById('platform-n8n-enabled'),
                url: document.getElementById('platform-n8n-url'),
                apiKey: document.getElementById('platform-n8n-apikey'),
                status: document.getElementById('platform-n8n-status')
            }
        };

        this.currentTheme = 'system';

        this.init();
    }

    init() {
        console.log('⚙️ Settings Manager Initializing...');

        // Load saved settings
        this.loadSettings();

        // Bind toggle options
        this.elements.toggleOptions.forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedTheme = btn.dataset.theme;
                this.setToggleActive(selectedTheme);
                this.applyTheme(selectedTheme);
            });
        });

        // Bind trigger
        if (this.elements.trigger) {
            this.elements.trigger.addEventListener('click', () => {
                this.elements.modal.style.display = 'flex';
                this.testAllPlatforms();
            });
        }

        // Expose to window
        window.settingsManager = this;
    }

    loadSettings() {
        const theme = localStorage.getItem('ui-theme') || 'system';
        this.currentTheme = theme;
        this.setToggleActive(theme);
        this.applyTheme(theme);

        // API Token is handled by server mostly, but we can show partial
        const token = localStorage.getItem('make-token');
        if (token) {
            if (this.platformElements.make.token) {
                this.platformElements.make.token.value = token;
            }
        }

        // Load IDE settings asynchronously
        this.loadIDESettings();

        // Load platform settings
        const platformSettings = JSON.parse(localStorage.getItem('platformSettings') || '{}');

        // Sync from server if authenticated
        if (window.AuthManager && window.AuthManager.isAuthenticated()) {
            this.fetchCredentialsFromServer();
        }

        // Make.com
        if (this.platformElements.make.enabled) {
            this.platformElements.make.enabled.checked = platformSettings.platforms?.make?.enabled !== false;
        }
        if (this.platformElements.make.token && platformSettings.platforms?.make?.credentials?.apiToken) {
            this.platformElements.make.token.value = platformSettings.platforms.make.credentials.apiToken;
        }

        // Zapier
        if (this.platformElements.zapier.enabled) {
            this.platformElements.zapier.enabled.checked = platformSettings.platforms?.zapier?.enabled || false;
        }
        if (this.platformElements.zapier.apiKey && platformSettings.platforms?.zapier?.credentials?.apiKey) {
            this.platformElements.zapier.apiKey.value = platformSettings.platforms.zapier.credentials.apiKey;
        }

        // n8n
        if (this.platformElements.n8n.enabled) {
            this.platformElements.n8n.enabled.checked = platformSettings.platforms?.n8n?.enabled || false;
        }
        if (this.platformElements.n8n.url && platformSettings.platforms?.n8n?.credentials?.instanceUrl) {
            this.platformElements.n8n.url.value = platformSettings.platforms.n8n.credentials.instanceUrl;
        }
        if (this.platformElements.n8n.apiKey && platformSettings.platforms?.n8n?.credentials?.apiKey) {
            this.platformElements.n8n.apiKey.value = platformSettings.platforms.n8n.credentials.apiKey;
        }

        // Workspace Path
        if (this.elements.workspacePath && window.platformManager) {
            this.elements.workspacePath.value = window.platformManager.getWorkspacePath();
        }
    }

    setToggleActive(theme) {
        this.currentTheme = theme;
        this.elements.toggleOptions.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        if (this.elements.toggleContainer) {
            this.elements.toggleContainer.setAttribute('data-active-theme', theme);
        }
    }

    async saveSettings() {
        const theme = this.currentTheme;

        // Build platform settings
        const platformSettings = {
            platforms: {
                make: {
                    enabled: this.platformElements.make.enabled?.checked || false,
                    credentials: null
                },
                zapier: {
                    enabled: this.platformElements.zapier.enabled?.checked || false,
                    credentials: null
                },
                n8n: {
                    enabled: this.platformElements.n8n.enabled?.checked || false,
                    credentials: null
                }
            }
        };

        // Make.com credentials
        if (this.platformElements.make.token?.value) {
            platformSettings.platforms.make.credentials = {
                apiToken: this.platformElements.make.token.value
            };
        }

        // Zapier credentials
        if (this.platformElements.zapier.apiKey?.value) {
            platformSettings.platforms.zapier.credentials = {
                apiKey: this.platformElements.zapier.apiKey.value
            };
        }

        // n8n credentials
        if (this.platformElements.n8n.url?.value && this.platformElements.n8n.apiKey?.value) {
            platformSettings.platforms.n8n.credentials = {
                instanceUrl: this.platformElements.n8n.url.value,
                apiKey: this.platformElements.n8n.apiKey.value
            };
        }

        // Save to localStorage
        localStorage.setItem('ui-theme', theme);
        localStorage.setItem('platformSettings', JSON.stringify(platformSettings));

        // Sync to server if authenticated
        if (window.AuthManager && window.AuthManager.isAuthenticated()) {
            await this.syncCredentialsToServer(platformSettings);
        }

        // Save Workspace Path
        if (this.elements.workspacePath && window.platformManager) {
            const newPath = this.elements.workspacePath.value;
            if (newPath && newPath !== window.platformManager.getWorkspacePath()) {
                await window.platformManager.setWorkspacePath(newPath);
            }
        }

        this.applyTheme(theme);
        this.elements.modal.style.display = 'none';

        // Re-initialize platform manager
        if (window.platformManager) {
            await window.platformManager.initialize();
            // Trigger navigation update
            window.dispatchEvent(new Event('platformsUpdated'));
        }

        // Provide feedback
        if (window.claspDeployer && window.claspDeployer.showNotification) {
            window.claspDeployer.showNotification('✅ Settings saved successfully!', 'success');
        } else {
            console.log('✅ Settings saved!');
        }
    }

    async syncCredentialsToServer(platformSettings) {
        console.log('🔄 Syncing credentials to server...');
        const token = window.AuthManager.getToken();

        const syncPromises = [];

        // Sync Make token
        if (platformSettings.platforms?.make?.credentials?.apiToken) {
            syncPromises.push(this.saveCredentialToServer('make', 'apiToken', platformSettings.platforms.make.credentials.apiToken, token));
        }

        // Sync Zapier API Key
        if (platformSettings.platforms?.zapier?.credentials?.apiKey) {
            syncPromises.push(this.saveCredentialToServer('zapier', 'apiKey', platformSettings.platforms.zapier.credentials.apiKey, token));
        }

        // Sync n8n credentials
        if (platformSettings.platforms?.n8n?.credentials) {
            const creds = platformSettings.platforms.n8n.credentials;
            if (creds.instanceUrl) syncPromises.push(this.saveCredentialToServer('n8n', 'instanceUrl', creds.instanceUrl, token));
            if (creds.apiKey) syncPromises.push(this.saveCredentialToServer('n8n', 'apiKey', creds.apiKey, token));
        }

        try {
            await Promise.all(syncPromises);
            console.log('✅ Credentials synced to server');
        } catch (error) {
            console.error('❌ Failed to sync some credentials:', error);
        }
    }

    async saveCredentialToServer(platformId, key, value, authToken) {
        return fetch('/api/settings/credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ platformId, key, value })
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to save ${platformId} ${key}`);
            return res.json();
        });
    }

    async browseWorkspace() {
        try {
            const authToken = window.AuthManager && typeof window.AuthManager.getToken === 'function'
                ? window.AuthManager.getToken()
                : localStorage.getItem('scriptflow_auth_token');

            const response = await fetch('/api/utils/browse-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                }
            });
            if (!response.ok) {
                const fallbackPath = prompt('Folder picker failed. Enter workspace path manually:');
                if (fallbackPath && this.elements.workspacePath) {
                    this.elements.workspacePath.value = fallbackPath.trim();
                }
                throw new Error(`Browse failed with status ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.path) {
                if (this.elements.workspacePath) {
                    this.elements.workspacePath.value = data.path;
                }
            } else {
                const fallbackPath = prompt('Folder picker failed. Enter workspace path manually:');
                if (fallbackPath && this.elements.workspacePath) {
                    this.elements.workspacePath.value = fallbackPath.trim();
                }
            }
        } catch (e) {
            console.error('Failed to browse folder:', e);
            if (window.claspDeployer && window.claspDeployer.showNotification) {
                window.claspDeployer.showNotification('❌ Browse failed. Enter path manually and Save.', 'error');
            }
        }
    }

    applyTheme(theme) {
        console.log(`Applying theme: ${theme}`);

        // Remove old theme classes
        document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-system');

        // Set data-theme attribute and class
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.add(`theme-${theme}`);

        // Update CSS Variables for specific overrides (if any)
        const root = document.documentElement;
        this.clearRootStyles(root);
    }

    clearRootStyles(root) {
        root.style.removeProperty('--bg-darker');
        root.style.removeProperty('--bg-dark');
        root.style.removeProperty('--glass-panel');
        root.style.removeProperty('--glass-border');
        root.style.removeProperty('--text-secondary');
    }

    togglePlatformTokenVisibility(platformId) {
        let input;
        if (platformId === 'make') {
            input = this.platformElements.make.token;
        } else if (platformId === 'zapier') {
            input = this.platformElements.zapier.apiKey;
        } else if (platformId === 'n8n') {
            input = this.platformElements.n8n.apiKey;
        }

        if (input) {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;

            // Update icon (find the button next to this input)
            const button = input.parentElement.querySelector('.glass-btn');
            const icon = button?.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        }
    }

    async fetchCredentialsFromServer() {
        console.log('🔄 Fetching credentials from server...');
        const token = window.AuthManager.getToken();
        const platforms = ['make', 'zapier', 'n8n'];

        for (const platformId of platforms) {
            try {
                const response = await fetch(`/api/settings/credentials/${platformId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();

                if (data.success && data.credentials) {
                    this.restorePlatformCredentials(platformId, data.credentials);
                }
            } catch (error) {
                console.error(`❌ Failed to fetch ${platformId} credentials:`, error);
            }
        }
    }

    restorePlatformCredentials(platformId, credentials) {
        // Map of UI elements
        const elements = this.platformElements[platformId];
        if (!elements) return;

        // Populate fields if they are empty
        if (platformId === 'make' && elements.token && !elements.token.value) {
            elements.token.value = credentials.find(c => c.credential_key === 'apiToken')?.credential_value || '';
        } else if (platformId === 'zapier' && elements.apiKey && !elements.apiKey.value) {
            elements.apiKey.value = credentials.find(c => c.credential_key === 'apiKey')?.credential_value || '';
        } else if (platformId === 'n8n') {
            if (elements.url && !elements.url.value) {
                elements.url.value = credentials.find(c => c.credential_key === 'instanceUrl')?.credential_value || '';
            }
            if (elements.apiKey && !elements.apiKey.value) {
                elements.apiKey.value = credentials.find(c => c.credential_key === 'apiKey')?.credential_value || '';
            }
        }

        // After restoring, we should update localStorage to stay in sync
        this.updatePlatformSettingsInStorage(platformId, credentials);
    }

    updatePlatformSettingsInStorage(platformId, credentials) {
        const platformSettings = JSON.parse(localStorage.getItem('platformSettings') || '{"platforms":{}}');
        if (!platformSettings.platforms) platformSettings.platforms = {};
        if (!platformSettings.platforms[platformId]) platformSettings.platforms[platformId] = { enabled: true };

        const credsObj = {};
        credentials.forEach(c => {
            credsObj[c.credential_key] = c.credential_value;
        });

        platformSettings.platforms[platformId].credentials = credsObj;
        localStorage.setItem('platformSettings', JSON.stringify(platformSettings));
    }

    async refreshGoogleLogin() {
        console.log('🔄 Refreshing Google Login...');

        if (window.claspDeployer && window.claspDeployer.showNotification) {
            window.claspDeployer.showNotification('🚀 Starting Google authentication flow...', 'info');
        }

        try {
            const response = await fetch('/api/clasp/login', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                if (window.claspDeployer && window.claspDeployer.showNotification) {
                    window.claspDeployer.showNotification('✅ Login flow started! Check your browser or terminal.', 'success');
                }
            } else {
                throw new Error(data.error || 'Failed to start login flow');
            }
        } catch (error) {
            console.error('❌ Login refresh error:', error);
            if (window.claspDeployer && window.claspDeployer.showNotification) {
                window.claspDeployer.showNotification(`❌ Error: ${error.message}`, 'error');
            }
        }
    }

    async testAllPlatforms() {
        // Test enabled platforms
        const platforms = ['make', 'zapier', 'n8n'];

        for (const platformId of platforms) {
            const elements = this.platformElements[platformId];
            if (!elements.enabled?.checked) {
                if (elements.status) {
                    elements.status.textContent = 'Disabled';
                    elements.status.className = 'status-badge';
                }
                continue;
            }

            await this.testPlatformConnection(platformId);
        }
    }

    async testPlatformConnection(platformId) {
        const elements = this.platformElements[platformId];
        if (!elements.status) return;

        elements.status.textContent = 'Testing...';
        elements.status.className = 'status-badge';

        try {
            // Get credentials
            let credentials = null;
            if (platformId === 'make') {
                credentials = { apiToken: elements.token?.value };
            } else if (platformId === 'zapier') {
                credentials = { apiKey: elements.apiKey?.value };
            } else if (platformId === 'n8n') {
                credentials = {
                    instanceUrl: elements.url?.value,
                    apiKey: elements.apiKey?.value
                };
            }

            if (!credentials || Object.values(credentials).some(v => !v)) {
                elements.status.textContent = 'No Credentials';
                elements.status.classList.add('error');
                return;
            }

            const response = await fetch(`/api/platforms/${platformId}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials })
            });

            const data = await response.json();

            if (data.success) {
                elements.status.textContent = 'Connected';
                elements.status.classList.add('success');
            } else {
                elements.status.textContent = 'Auth Failed';
                elements.status.classList.add('error');
            }
        } catch (error) {
            console.error('Failed to test platform:', error);
            elements.status.textContent = 'Error';
            elements.status.classList.add('error');
        }
    }

    // ===== IDE Management =====

    async loadIDESettings() {
        try {
            const response = await fetch('/api/settings/ide/available');
            const data = await response.json();

            if (data.success) {
                this.renderIDESelector(data.all, data.recommended);
                const prefResponse = await fetch('/api/settings/ide');
                const prefData = await prefResponse.json();
                if (prefData.success && prefData.preferredIDE) {
                    this.selectedIDE = prefData.preferredIDE;
                } else {
                    this.selectedIDE = data.recommended;
                }
                this.updateIDESelection();
            }
        } catch (error) {
            console.error('Failed to load IDE settings:', error);
        }
    }

    renderIDESelector(ides, recommendedIDE) {
        const grid = document.getElementById('ideSelectorGrid');
        if (!grid) return;

        const ideIcons = {
            'vscode': 'fab fa-microsoft',
            'cursor': 'fas fa-edit',
            'antigravity': 'fas fa-rocket',
            'webstorm': 'fab fa-js',
            'intellij': 'fas fa-code',
            'pycharm': 'fab fa-python',
            'sublime': 'fas fa-file-code',
            'vim': 'fas fa-terminal',
            'neovim': 'fas fa-terminal',
            'zed': 'fas fa-bolt'
        };

        grid.innerHTML = ides.map(ide => `
            <div class="ide-card ${ide.installed ? 'installed' : 'not-installed'}" 
                 data-ide-id="${ide.id}"
                 onclick="window.settingsManager.selectIDE('${ide.id}')">
                <i class="${ideIcons[ide.id] || 'fas fa-code'}"></i>
                <span class="ide-name">${ide.name}</span>
                ${ide.installed ? '<span class="badge-installed">✓</span>' : '<span class="badge-not-installed">Not Detected</span>'}
                ${ide.id === recommendedIDE ? '<span class="badge-recommended">Rec</span>' : ''}
            </div>
        `).join('');
    }

    async selectIDE(ideId) {
        this.selectedIDE = ideId;
        this.updateIDESelection();

        try {
            const response = await fetch('/api/settings/ide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ideId })
            });

            const result = await response.json();
            if (result.success && window.claspDeployer && window.claspDeployer.showNotification) {
                window.claspDeployer.showNotification(`✅ ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to save IDE preference:', error);
        }
    }

    updateIDESelection() {
        const cards = document.querySelectorAll('.ide-card');
        cards.forEach(card => {
            if (card.dataset.ideId === this.selectedIDE) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    async getSelectedIDE() {
        try {
            const response = await fetch('/api/settings/ide');
            const data = await response.json();
            return data.success ? data.activeIDE : null;
        } catch (error) {
            console.error('Failed to get selected IDE:', error);
            return null;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});
