// Make Manager for Make.com Scenarios
console.log('🤖 Make Manager loaded!');

class MakeManager {
    constructor() {
        console.log('MakeManager constructor called');
        this.isInitialized = false;
        this.currentState = 'input'; // input, progress, success, error
        this.currentEventSource = null; // For SSE connection
        this.scenarios = []; // Store loaded scenarios for history access
    }

    initialize() {
        if (this.isInitialized) return;

        console.log('Initializing Make Manager...');
        this.initializeElements();
        this.bindEvents();
        this.isInitialized = true;

        // Load scenarios automatically on startup
        this.loadScenarios();

        // Set default tab to local
        this.switchTab('local');
    }

    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };

        const authToken = window.AuthManager && typeof window.AuthManager.getToken === 'function'
            ? window.AuthManager.getToken()
            : localStorage.getItem('scriptflow_auth_token');
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Try getting from localStorage directly (simplest bridge to settings.js)
        // Check platformSettings first
        const platformSettingsStr = localStorage.getItem('platformSettings');
        if (platformSettingsStr) {
            try {
                const settings = JSON.parse(platformSettingsStr);
                if (settings.platforms?.make?.credentials?.apiToken) {
                    headers['X-Make-Token'] = settings.platforms.make.credentials.apiToken;
                    return headers;
                }
            } catch (e) { console.error('Error parsing settings:', e); }
        }

        // Fallback to legacy key
        const token = localStorage.getItem('make-token');
        if (token) headers['X-Make-Token'] = token;

        return headers;
    }

    switchTab(tab) {
        // Update active tab link
        if (this.tabLinks) {
            this.tabLinks.forEach(link => {
                if (link.getAttribute('data-tab') === tab) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }

        // Show/hide sections
        if (tab === 'local') {
            if (this.scenariosSection) this.scenariosSection.style.display = 'block';
            if (this.availableScenariosSection) this.availableScenariosSection.style.display = 'none';
        } else if (tab === 'available') {
            if (this.scenariosSection) this.scenariosSection.style.display = 'none';
            if (this.availableScenariosSection) this.availableScenariosSection.style.display = 'block';
            // Load available scenarios when switching to this tab
            this.loadAvailableScenarios();
        }
    }

    async loadAvailableScenarios() {
        console.log('Loading available scenarios from Make.com...');

        if (!this.availableScenariosGrid) return;

        this.availableScenariosGrid.innerHTML = '<div class="loading">Loading available scenarios from Make.com...</div>';

        try {
            const response = await fetch('/api/make/scenarios/available', {
                headers: this.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success && data.scenarios) {
                this.renderAvailableScenarios(data.scenarios);
            } else if (data.requiresAuth) {
                // API token not configured
                this.availableScenariosGrid.innerHTML = `
                    <div class="no-projects" style="text-align: center; padding: 2rem;">
                        <div style="margin-bottom: 1rem;">
                            <i class="fas fa-key" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        </div>
                        <h3 style="margin-bottom: 1rem;">Make.com API Token Required</h3>
                        <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                            ${data.error || 'Please configure your Make.com API token to fetch scenarios.'}
                        </p>
                        <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: var(--border-radius); text-align: left; max-width: 600px; margin: 0 auto;">
                            <h4 style="margin-bottom: 1rem;">How to set up:</h4>
                            <ol style="margin-left: 1.5rem; line-height: 2;">
                                <li>Get your API token from <a href="https://www.make.com/en/settings/api" target="_blank" style="color: var(--accent-secondary);">Make.com Settings → API</a></li>
                                <li>Create a file <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">.make-config.json</code> in the server directory</li>
                                <li>Add: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">{"apiToken": "YOUR_TOKEN_HERE"}</code></li>
                                <li>Or set environment variable: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">MAKE_API_TOKEN=your_token</code></li>
                                <li>Restart the server</li>
                            </ol>
                        </div>
                    </div>
                `;
            } else {
                // Show error message with helpful instructions
                const errorMsg = data.error || 'Check your connection.';
                const isPermissionError = errorMsg.includes('Access denied') ||
                    errorMsg.includes('403') ||
                    errorMsg.includes('Not authorized') ||
                    errorMsg.includes('401') ||
                    errorMsg.includes('Permission denied');

                let helpMessage = '';
                if (isPermissionError) {
                    helpMessage = `
                        <div class="help-box" style="background: linear-gradient(135deg, rgba(255,107,107,0.1), rgba(255,193,7,0.1)); border: 3px solid #ff6b6b; border-radius: 12px; padding: 2rem; margin: 2rem auto; max-width: 650px; text-align: left; box-shadow: 0 4px 20px rgba(255,107,107,0.3);">
                            <h2 style="margin: 0 0 1rem 0; color: #ff6b6b; font-size: 1.5rem;">🔑 API Token Missing Required Permissions</h2>
                            <p style="font-size: 1.1rem; margin-bottom: 1.5rem; font-weight: 600;">Your current API token lacks <code style="background: rgba(0,0,0,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; color: #ffc107;">scenarios:read</code> permission.</p>
                            
                            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin: 1rem 0;">
                                <h3 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1.2rem;">✅ Step-by-Step Fix:</h3>
                                <ol style="line-height: 2; font-size: 1.05rem; padding-left: 1.5rem;">
                                    <li style="margin-bottom: 0.5rem;">
                                        <strong>Open Make.com API Settings:</strong><br>
                                        <a href="https://www.make.com/en/settings/api" target="_blank" style="color: #4CAF50; font-weight: bold; text-decoration: underline; font-size: 1.1rem;">
                                            👉 Click here: https://www.make.com/en/settings/api
                                        </a>
                                    </li>
                                    <li style="margin-bottom: 0.5rem;">Click <strong>"Create a new token"</strong></li>
                                    <li style="margin-bottom: 0.5rem;">Name it <code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 3px;">"Development Deployer"</code></li>
                                    <li style="margin-bottom: 0.5rem;"><strong style="color: #ffc107;">⚠️ IMPORTANT:</strong> Select <strong>ALL scopes</strong> (check every box!)</li>
                                    <li style="margin-bottom: 0.5rem;">Click "Save" and <strong>copy the token immediately</strong> (shown only once!)</li>
                                    <li style="margin-bottom: 0.5rem;">Open <code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 3px;">.make-config.json</code> in your project folder</li>
                                    <li style="margin-bottom: 0.5rem;">Replace <code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 3px;">apiToken</code> value with your new token</li>
                                    <li>Restart the server (close terminal and relaunch)</li>
                                </ol>
                            </div>
                            
                            <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,193,7,0.1); border-left: 4px solid #ffc107; border-radius: 4px;">
                                <strong>📍 Config file location:</strong><br>
                                <code style="background: rgba(0,0,0,0.3); padding: 0.3rem 0.6rem; border-radius: 3px; font-size: 0.9rem;">
                                    ${window.platformManager ? window.platformManager.getWorkspacePath() : '/Users/bricelengama/Documents/Marketing Opti/Cursor'}/clasp-deployer-web/.make-config.json
                                </code>
                            </div>
                            
                            <p style="margin-top: 1.5rem; text-align: center;">
                                <a href="MAKE_API_TROUBLESHOOTING.md" target="_blank" style="color: var(--accent-color); font-weight: bold; text-decoration: underline;">
                                    📖 View detailed troubleshooting guide
                                </a>
                            </p>
                        </div>
                    `;
                }

                this.availableScenariosGrid.innerHTML = `
                    <div class="no-projects" style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                        <h3>Unable to load scenarios from Make.com</h3>
                        <p>${errorMsg}</p>
                        ${helpMessage}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load available scenarios:', error);
            this.availableScenariosGrid.innerHTML = `
                <div class="no-projects" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--status-warning); margin-bottom: 1rem;"></i>
                    <h3>Failed to load scenarios</h3>
                    <p style="color: var(--text-secondary);">${error.message || 'Please check your Make.com API configuration and try again.'}</p>
                </div>
            `;
        }
    }

    renderAvailableScenarios(scenarios) {
        if (!scenarios || scenarios.length === 0) {
            this.availableScenariosGrid.innerHTML = '<div class="no-projects">No scenarios found in your Make.com account.</div>';
            return;
        }

        const scenarioCards = scenarios.map(scenario => this.createAvailableScenarioCard(scenario)).join('');
        this.availableScenariosGrid.innerHTML = scenarioCards;

        // Attach UI effects
        this.attachCardInteractions();
    }

    createAvailableScenarioCard(scenario) {
        const status = scenario.scheduling?.active ? 'active' : 'inactive';
        const statusIcon = scenario.scheduling?.active ? '🟢' : '🔴';
        const isLocal = scenario.isLocal;
        const lastRun = scenario.lastRun ? new Date(scenario.lastRun).toLocaleString() : 'Never';

        return `
            <div class="project-card scenario-card available-scenario-card ${isLocal ? 'local-scenario' : ''}" data-id="${scenario.id}">
                <div class="project-header">
                    <div class="project-status">
                        <div class="status-dot status-${status}"></div>
                    </div>
                    <h3 class="project-name">${scenario.name}</h3>
                    <div class="project-controls">
                        ${isLocal ? '<span class="local-badge"><i class="fas fa-check-circle"></i> Local</span>' : ''}
                        ${isLocal ? `
                        <button class="glass-btn icon-only small" onclick="window.makeManager.openInCursor('${scenario.id}', event)" title="Open in Cursor">
                            <i class="fas fa-code"></i>
                        </button>` : ''}
                        <button class="glass-btn icon-only small" onclick="window.makeManager.openInMake('${scenario.id}', event)" title="Open in Make.com">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="project-content">
                    ${scenario.description ? `
                    <div class="scenario-description">
                        <p>${scenario.description}</p>
                    </div>
                    ` : ''}
                    
                    <div class="project-script-id">
                        <code class="script-id">ID: ${scenario.id}</code>
                    </div>

                    <div class="project-meta">
                        <div class="meta-item">
                            <i class="fas fa-circle" style="color: ${status === 'active' ? '#10b981' : '#ef4444'}; font-size: 8px;"></i>
                            <span>${statusIcon} ${status === 'active' ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-folder"></i>
                            <span>${scenario.folderName || 'Root'}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-puzzle-piece"></i>
                            <span>${scenario.operations || 0} operations</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-plug"></i>
                            <span>${scenario.connections || 0} connections</span>
                        </div>
                        ${scenario.lastRun ? `
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>Last run: ${lastRun}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="project-footer">
                    ${isLocal ? `
                        <button class="glass-btn primary small" onclick="window.makeManager.pullScenario('${scenario.id}')" title="Refresh from Make.com">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                        <button class="glass-btn primary small" onclick="window.makeManager.pushScenario('${scenario.id}', event)" title="Push changes to Make.com">
                            <i class="fas fa-upload"></i>
                            Push
                        </button>
                    ` : `
                        <button class="glass-btn small" onclick="window.makeManager.convertToAppScript('${scenario.id}', event)" title="Convert logic to Google Apps Script">
                            <i class="fas fa-magic" style="color: var(--accent-secondary);"></i>
                            Convert
                        </button>
                        <button class="glass-btn primary small pull-to-cursor-btn" onclick="window.makeManager.pullScenario('${scenario.id}')" title="Pull scenario to Cursor">
                            <i class="fas fa-download"></i>
                            Pull to Cursor
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    initializeElements() {
        console.log('Initializing Make elements...');

        // Scenarios elements
        this.scenariosSection = document.getElementById('makeScenariosSection');
        this.scenariosGrid = document.getElementById('makeScenariosGrid');
        this.refreshScenariosBtn = document.getElementById('makeRefreshScenariosBtn');

        // Available scenarios elements
        this.availableScenariosSection = document.getElementById('makeAvailableScenariosSection');
        this.availableScenariosGrid = document.getElementById('makeAvailableScenariosGrid');
        this.refreshAvailableBtn = document.getElementById('makeRefreshAvailableBtn');

        // Tab navigation
        this.tabLinks = document.querySelectorAll('[data-tab]');

        // Settings elements
        this.settingsBtn = document.getElementById('makeSettingsBtn');
        this.settingsDropdown = document.getElementById('makeSettingsDropdown');
        this.themeToggle = document.getElementById('makeThemeToggle');

        // Input elements
        this.scenarioNameInput = document.getElementById('makeScenarioName');
        this.createBtn = document.getElementById('makeCreateBtn');

        console.log('Make elements check:', {
            scenariosSection: !!this.scenariosSection,
            scenariosGrid: !!this.scenariosGrid,
            refreshScenariosBtn: !!this.refreshScenariosBtn,
            availableScenariosSection: !!this.availableScenariosSection,
            availableScenariosGrid: !!this.availableScenariosGrid,
            refreshAvailableBtn: !!this.refreshAvailableBtn,
            settingsBtn: !!this.settingsBtn,
            settingsDropdown: !!this.settingsDropdown,
            themeToggle: !!this.themeToggle,
            scenarioNameInput: !!this.scenarioNameInput,
            createBtn: !!this.createBtn
        });
    }

    bindEvents() {
        console.log('Binding Make events...');

        // Refresh scenarios
        if (this.refreshScenariosBtn) {
            this.refreshScenariosBtn.addEventListener('click', () => this.loadScenarios());
        }

        // Refresh available scenarios
        if (this.refreshAvailableBtn) {
            this.refreshAvailableBtn.addEventListener('click', () => this.loadAvailableScenarios());
        }

        const refreshAvailableBtnGrid = document.getElementById('makeRefreshAvailableBtnGrid');
        if (refreshAvailableBtnGrid) {
            refreshAvailableBtnGrid.addEventListener('click', () => this.loadAvailableScenarios());
        }

        // Tab navigation
        if (this.tabLinks) {
            this.tabLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tab = link.getAttribute('data-tab');
                    this.switchTab(tab);
                });
            });
        }

        // Settings dropdown
        if (this.settingsBtn && this.settingsDropdown) {
            this.settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.settingsDropdown.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!this.settingsBtn.contains(e.target) && !this.settingsDropdown.contains(e.target)) {
                    this.settingsDropdown.classList.remove('active');
                }
            });
        }

        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', (e) => {
                const selectedTheme = e.target.value;
                if (window.claspDeployer) {
                    window.claspDeployer.applyTheme(selectedTheme);
                }
            });
        }

        // Create scenario
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.createScenario());
        }

        // Enter key on scenario name input
        if (this.scenarioNameInput) {
            this.scenarioNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.createScenario();
                }
            });
        }

        // Close buttons for Success/Error views
        const closeSuccessBtn = document.getElementById('makeNewOperationBtn');
        if (closeSuccessBtn) {
            closeSuccessBtn.addEventListener('click', () => this.setState('input'));
        }

        const closeErrorBtn = document.getElementById('makeNewOperationErrorBtn');
        if (closeErrorBtn) {
            closeErrorBtn.addEventListener('click', () => this.setState('input'));
        }

        const retryBtn = document.getElementById('makeRetryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.createScenario()); // Assumes retry means retry creation
        }
    }

    async loadScenarios() {
        console.log('Loading Make scenarios...');

        if (!this.scenariosGrid) return;

        this.scenariosGrid.innerHTML = '<div class="loading">Loading scenarios...</div>';

        try {
            const response = await fetch('/api/make/scenarios');
            const data = await response.json();

            if (data.success && data.scenarios) {
                // Store scenarios for later access (e.g., history modal)
                this.scenarios = data.scenarios;
                this.renderScenarios(data.scenarios);
            } else {
                this.scenarios = [];
                this.scenariosGrid.innerHTML = '<div class="no-projects">Unable to load scenarios. Check your Make.com connection.</div>';
            }
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            this.scenariosGrid.innerHTML = '<div class="no-projects">Failed to load scenarios. Please try again.</div>';
        }
    }

    renderScenarios(scenarios) {
        if (!scenarios || scenarios.length === 0) {
            this.scenariosGrid.innerHTML = '<div class="no-projects">No existing scenarios found. Create your first scenario using the panel on the right!</div>';
            return;
        }

        const scenarioCards = scenarios.map(scenario => this.createScenarioCard(scenario)).join('');
        this.scenariosGrid.innerHTML = scenarioCards;

        // Attach UI effects
        this.attachCardInteractions();
    }

    attachCardInteractions() {
        const cards = document.querySelectorAll('.scenario-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    }

    createScenarioCard(scenario) {
        const status = scenario.scheduling?.active ? 'active' : 'inactive';
        const lastRun = scenario.lastRun ? new Date(scenario.lastRun).toLocaleString() : 'Never';

        return `
            <div class="project-card scenario-card" data-id="${scenario.id}">
                <div class="project-header">
                    <div class="project-status">
                        <div class="status-dot status-${status}"></div>
                    </div>
                    <h3 class="project-name">${scenario.name}</h3>
                    <div class="project-controls">
                        <button class="glass-btn icon-only small" title="Open in Cursor" onclick="window.makeManager.openInCursor('${scenario.id}', event)">
                            <i class="fas fa-code"></i>
                        </button>
                        <button class="glass-btn icon-only small" onclick="window.makeManager.openInMake('${scenario.id}', event)" title="Open in Make.com">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="project-content">
                    <div class="project-script-id">
                        <code class="script-id">${this.truncateScenarioId(scenario.id)}</code>
                    </div>

                    <div class="project-meta">
                        ${scenario.lastPush ? `<div class="meta-item"><i class="fas fa-upload"></i><span>Last push: ${this.formatDeploymentTime(scenario.lastPush)}</span></div>` : '<div class="meta-item"><i class="fas fa-upload"></i><span>No pushes yet</span></div>'}
                        ${scenario.lastPull ? `<div class="meta-item"><i class="fas fa-download"></i><span>Last pull: ${this.formatDeploymentTime(scenario.lastPull)}</span></div>` : '<div class="meta-item"><i class="fas fa-download"></i><span>No pulls yet</span></div>'}
                        ${scenario.lastRun ? `<div class="meta-item"><i class="fas fa-calendar"></i><span>Last run: ${new Date(scenario.lastRun).toLocaleString()}</span></div>` : ''}
                    </div>
                </div>

                <div class="project-footer">
                    <button class="glass-btn small" onclick="window.makeManager.convertToAppScript('${scenario.id}', event)" title="Convert logic to Google Apps Script">
                        <i class="fas fa-magic" style="color: var(--accent-secondary);"></i>
                        Convert
                    </button>
                    <button class="glass-btn primary small" onclick="window.makeManager.pullScenario('${scenario.id}')" title="Pull latest changes from Make.com">
                        <i class="fas fa-download"></i>
                        Pull
                    </button>
                    <button class="glass-btn primary small" onclick="window.makeManager.pushScenario('${scenario.id}')" title="Push changes to Make.com">
                        <i class="fas fa-upload"></i>
                        Push
                    </button>
                    <button class="glass-btn small" onclick="window.makeManager.showDeploymentHistory('${scenario.id}')" title="View deployment history">
                        <i class="fas fa-history"></i>
                        History
                    </button>
                </div>
            </div>
        `;
    }

    truncateScenarioId(scenarioId) {
        const idStr = scenarioId.toString();
        if (idStr.length <= 20) return idStr;
        return idStr.substring(0, 17) + '...';
    }

    formatDeploymentTime(isoString) {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    async createScenario() {
        const scenarioName = this.scenarioNameInput?.value?.trim();
        if (!scenarioName) {
            this.showNotification('Please enter a scenario name', 'warning');
            return;
        }

        console.log('Creating scenario:', scenarioName);

        try {
            this.setState('progress');
            this.updateProgress('Creating scenario...', 30);

            const response = await fetch('/api/make/scenarios', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    name: scenarioName
                })
            });

            const data = await response.json();

            if (data.success) {
                this.updateProgress('Scenario created successfully!', 100);
                setTimeout(() => {
                    this.setState('success', {
                        message: `Scenario "${scenarioName}" created successfully!`,
                        scenarioId: data.scenarioId,
                        scenarioName: scenarioName
                    });
                    this.scenarioNameInput.value = '';
                    this.loadScenarios(); // Refresh the list
                }, 1000);
            } else {
                throw new Error(data.error || 'Failed to create scenario');
            }

        } catch (error) {
            console.error('Failed to create scenario:', error);
            this.setState('error', error.message);
        }
    }

    async pullScenario(scenarioId) {
        const pullBtn = event.target.closest('button');
        const originalText = pullBtn.innerHTML;
        pullBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pulling...';
        pullBtn.disabled = true;

        try {
            const response = await fetch(`/api/make/scenarios/${scenarioId}/pull`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                this.showNotification(`✅ Successfully pulled latest changes for scenario "${scenarioId}"!`, 'success');
                // Reload scenarios list to show updated status
                this.loadScenarios();
            } else {
                this.showNotification(`❌ Failed to pull scenario "${scenarioId}": ${data.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Failed to pull scenario:', error);
            this.showNotification(`❌ Error pulling scenario "${scenarioId}": ${error.message}`, 'error');
        } finally {
            pullBtn.innerHTML = originalText;
            pullBtn.disabled = false;
        }
    }

    async pushScenario(scenarioId, event) {
        // Find the button that was clicked
        let pushBtn = null;
        if (event && event.target) {
            pushBtn = event.target.closest('button');
        }

        // If we couldn't find the button from event, try to find it by scenario ID
        if (!pushBtn) {
            const buttons = document.querySelectorAll(`button[onclick*="pushScenario('${scenarioId}')"]`);
            if (buttons.length > 0) {
                pushBtn = buttons[0];
            }
        }

        const originalText = pushBtn ? pushBtn.innerHTML : '';
        if (pushBtn) {
            pushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing...';
            pushBtn.disabled = true;
        }

        try {
            const response = await fetch(`/api/make/scenarios/${scenarioId}/push`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                this.showNotification(`✅ Successfully pushed changes for scenario "${scenarioId}"!`, 'success');
                // Reload scenarios list to show updated status
                this.loadScenarios();
            } else {
                this.showNotification(`❌ Failed to push scenario "${scenarioId}": ${data.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Failed to push scenario:', error);
            this.showNotification(`❌ Error pushing scenario "${scenarioId}": ${error.message}`, 'error');
        } finally {
            if (pushBtn) {
                pushBtn.innerHTML = originalText;
                pushBtn.disabled = false;
            }
        }
    }

    async showDeploymentHistory(scenarioId) {
        try {
            // For now, show basic history from tracking file
            // TODO: Implement full deployment history similar to Apps Script
            const scenario = this.getScenarioById(scenarioId);

            if (!scenario) {
                this.showNotification('Scenario not found', 'error');
                return;
            }

            // Create simple history modal
            const historyItems = [];

            if (scenario.lastPush) {
                historyItems.push({
                    type: 'push',
                    timestamp: scenario.lastPush,
                    status: 'completed'
                });
            }

            if (scenario.lastPull) {
                historyItems.push({
                    type: 'pull',
                    timestamp: scenario.lastPull,
                    status: 'completed'
                });
            }

            if (historyItems.length === 0) {
                this.showNotification('No deployment history found for this scenario', 'info');
                return;
            }

            // Sort by timestamp (most recent first)
            historyItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const historyHtml = historyItems.map(item => {
                const statusIcon = item.status === 'completed' ? '✅' : '⏳';
                const typeLabel = item.type === 'push' ? 'Push' : 'Pull';
                const typeIcon = item.type === 'push' ? 'fa-upload' : 'fa-download';

                return `
                    <div class="history-item status-success">
                        <div class="history-header">
                            <div class="history-version">
                                <i class="fas ${typeIcon}"></i> ${typeLabel}
                            </div>
                            <div class="history-status">${statusIcon} ${item.status}</div>
                        </div>
                        <div class="history-details">
                            <div class="history-time">${this.formatDeploymentTime(item.timestamp)}</div>
                            <div class="history-date">${new Date(item.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            }).join('');

            const modalHtml = `
                <div class="modal-overlay" onclick="if(event.target === this) this.remove()">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h2>📋 Deployment History - ${scenario.name || scenarioId}</h2>
                            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                        </div>

                        <div class="modal-body">
                            <div class="history-list">
                                ${historyHtml}
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

        } catch (error) {
            console.error('Failed to show deployment history:', error);
            this.showNotification(`❌ Failed to load deployment history: ${error.message}`, 'error');
        }
    }

    getScenarioById(scenarioId) {
        // Get scenario from stored scenarios array
        const scenario = this.scenarios.find(s => s.id.toString() === scenarioId.toString());
        if (scenario) return scenario;

        // Fallback: get from the grid
        const scenarioCard = document.querySelector(`[data-id="${scenarioId}"]`);
        if (!scenarioCard) return null;

        return {
            id: scenarioId,
            name: scenarioCard.querySelector('.project-name')?.textContent || scenarioId
        };
    }

    openInMake(scenarioId, event) {
        // Prevent event propagation if event is provided
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Open the scenario in Make.com web interface
        // Format: https://eu1.make.celonis.com/{teamId}/scenarios/{scenarioId}/edit
        const teamId = 2154; // Default teamId for this account
        const url = `https://eu1.make.celonis.com/${teamId}/scenarios/${scenarioId}/edit`;
        console.log(`Opening Make.com scenario: ${url}`);

        // Use window.open with proper options
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
            // If popup blocked, try direct navigation
            console.warn('Popup blocked, trying direct navigation');
            window.location.href = url;
        }
    }

    async openInCursor(scenarioId, event) {
        console.log('🔍 openInCursor called with scenarioId:', scenarioId);

        // Prevent event propagation if event is provided
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        console.log(`📂 Opening scenario ${scenarioId} in Cursor...`);

        try {
            // Open the blueprint.json file directly (same as pull does)
            const workspaceDir = window.platformManager ? window.platformManager.getWorkspacePath() : '/Users/bricelengama/Documents/Marketing Opti/Cursor';
            const blueprintPath = `${workspaceDir}/make-scenarios/scenarios/${scenarioId}/blueprint.json`;
            console.log('📄 Blueprint path:', blueprintPath);

            const response = await fetch('/api/open-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filePath: blueprintPath  // Use filePath parameter for direct file opening
                })
            });

            console.log('📡 Response status:', response.status);
            const data = await response.json();
            console.log('📦 Response data:', data);

            if (data.success) {
                this.showNotification(`✅ Opened blueprint.json in Cursor!`, 'success');
            } else {
                this.showNotification(`❌ Failed to open in Cursor: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Failed to open in Cursor:', error);
            this.showNotification('Failed to open in Cursor', 'error');
        }
    }

    showScenarioMenu(scenarioId, event) {
        event.stopPropagation();
        // TODO: Implement scenario context menu
        console.log('Scenario menu for:', scenarioId);
    }

    setState(state, data = null) {
        console.log('Setting state:', state, data);
        this.currentState = state;

        // Hide all deployment panel SECTIONS (but keep the list visible)
        // Note: makeScenariosSection is NOT hidden anymore as we switched to split layout
        const sections = ['makeNewScenarioSection', 'makeProgressSection', 'makeSuccessSection', 'makeErrorSection'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
        });

        // Show appropriate section inside the panel
        switch (state) {
            case 'input':
                if (document.getElementById('makeNewScenarioSection')) document.getElementById('makeNewScenarioSection').style.display = 'block';
                break;
            case 'progress':
                if (document.getElementById('makeProgressSection')) document.getElementById('makeProgressSection').style.display = 'block';
                break;
            case 'success':
                if (document.getElementById('makeSuccessSection')) document.getElementById('makeSuccessSection').style.display = 'block';
                if (data) this.populateSuccessSection(data);
                break;
            case 'error':
                if (document.getElementById('makeErrorSection')) document.getElementById('makeErrorSection').style.display = 'block';
                if (data) this.populateErrorSection(data);
                break;
        }
    }

    updateProgress(message, percentage) {
        const progressFill = document.getElementById('makeProgressFill');
        const progressText = document.querySelector('#makeProgressSection h3');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${message}`;

        // Add log entry
        this.addLogEntry(message);
    }

    addLogEntry(message) {
        const logOutput = document.getElementById('makeLogOutput');
        if (logOutput) {
            const logLine = document.createElement('div');
            logLine.className = 'log-line';
            logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logOutput.appendChild(logLine);
            logOutput.scrollTop = logOutput.scrollHeight;
        }
    }

    populateSuccessSection(data) {
        const successMessage = document.getElementById('makeSuccessMessage');
        const scenarioInfo = document.getElementById('makeScenarioInfo');

        if (successMessage) {
            successMessage.textContent = data.message;
        }

        if (scenarioInfo) {
            scenarioInfo.innerHTML = `
                <div class="project-info-item">
                    <span class="project-info-label">Scenario ID</span>
                    <span class="project-info-value">${data.scenarioId}</span>
                </div>
                ${data.scenarioName ? `
                <div class="project-info-item">
                    <span class="project-info-label">Scenario Name</span>
                    <span class="project-info-value">${data.scenarioName}</span>
                </div>
                ` : ''}
                ${data.localPath ? `
                <div class="project-info-item">
                    <span class="project-info-label">Local Path</span>
                    <span class="project-info-value">${data.localPath}</span>
                </div>
                ` : ''}
            `;
        }
    }

    populateErrorSection(errorMessage) {
        const errorMessageEl = document.getElementById('makeErrorMessage');
        const errorDetails = document.getElementById('makeErrorDetails');

        if (errorMessageEl) {
            errorMessageEl.textContent = errorMessage;
        }

        if (errorDetails) {
            errorDetails.innerHTML = `<pre>${errorMessage}</pre>`;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">${message}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Theme management
    applyTheme(theme) {
        const root = document.documentElement;

        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark');

        if (theme === 'light') {
            document.body.classList.add('theme-light');
            this.setLightTheme();
        } else if (theme === 'dark') {
            document.body.classList.add('theme-dark');
            this.setDarkTheme();
        } else if (theme === 'system') {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add('theme-dark');
                this.setDarkTheme();
            } else {
                document.body.classList.add('theme-light');
                this.setLightTheme();
            }

            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'system') {
                    if (e.matches) {
                        document.body.classList.remove('theme-light');
                        document.body.classList.add('theme-dark');
                        this.setDarkTheme();
                    } else {
                        document.body.classList.remove('theme-dark');
                        document.body.classList.add('theme-light');
                        this.setLightTheme();
                    }
                }
            });
        }
    }

    setLightTheme() {
        const root = document.documentElement;
        root.style.setProperty('--bg-primary', '#FFFFFF');
        root.style.setProperty('--bg-secondary', '#F8FAFC');
        root.style.setProperty('--bg-tertiary', '#F1F5F9');
        root.style.setProperty('--bg-hover', '#E2E8F0');
        root.style.setProperty('--border-primary', 'rgba(0, 0, 0, 0.08)');
        root.style.setProperty('--border-hover', 'rgba(0, 0, 0, 0.15)');
        root.style.setProperty('--text-primary', '#0F172A');
        root.style.setProperty('--text-secondary', '#334155');
        root.style.setProperty('--text-muted', '#64748B');
        root.style.setProperty('--text-subtle', '#94A3B8');
    }

    setDarkTheme() {
        const root = document.documentElement;
        root.style.setProperty('--bg-primary', '#0A0A0A');
        root.style.setProperty('--bg-secondary', '#111111');
        root.style.setProperty('--bg-tertiary', '#1A1A1A');
        root.style.setProperty('--bg-hover', '#1F1F1F');
        root.style.setProperty('--border-primary', 'rgba(255, 255, 255, 0.08)');
        root.style.setProperty('--border-hover', 'rgba(255, 255, 255, 0.15)');
        root.style.setProperty('--text-primary', '#FFFFFF');
        root.style.setProperty('--text-secondary', '#F1F5F9');
        root.style.setProperty('--text-muted', '#94A3B8');
        root.style.setProperty('--text-subtle', '#64748B');
    }
}

// Initialize Make Manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Creating Make Manager instance...');
    window.makeManager = new MakeManager();
    window.makeManager.initialize();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MakeManager;
}
