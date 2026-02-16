// ScriptFlow Web App
console.log('🚀 ScriptFlow JavaScript loaded!');

class ClaspDeployer {
    constructor() {
        console.log('ClaspDeployer constructor called');
        this.isInitialized = false;
        this.currentState = 'input'; // input, progress, success, error
        this.currentEventSource = null; // For SSE connection
    }

    initialize() {
        if (this.isInitialized) {
            console.log('CLASP Deployer already initialized, skipping...');
            return;
        }

        console.log('Initializing CLASP Deployer...');
        this.initializeElements();
        this.bindEvents();
        this.isInitialized = true;

        // Load projects automatically on startup
        this.loadExistingProjects();
    }

    initializeElements() {
        console.log('Initializing elements...');

        // Projects elements
        this.projectsSection = document.getElementById('claspProjectsSection');
        this.projectsGrid = document.getElementById('claspProjectsGrid');
        this.refreshProjectsBtn = document.getElementById('claspRefreshProjectsBtn');

        // Apps Script Browser elements
        this.availableScriptsSection = document.getElementById('claspAvailableScriptsSection');
        this.availableScriptsGrid = document.getElementById('claspAvailableScriptsGrid');
        this.refreshAvailableBtn = document.getElementById('claspRefreshAvailableBtn');

        // Tab navigation
        this.claspTabLinks = document.querySelectorAll('#claspPage .tab-item');

        console.log('Element check:', {
            projectsSection: !!this.projectsSection,
            projectsGrid: !!this.projectsGrid,
            refreshProjectsBtn: !!this.refreshProjectsBtn,
            availableScriptsSection: !!this.availableScriptsSection,
            availableScriptsGrid: !!this.availableScriptsGrid,
            refreshAvailableBtn: !!this.refreshAvailableBtn
        });

        // Initialize tabs
        if (this.claspTabLinks) {
            this.claspTabLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tab = link.getAttribute('data-tab');
                    this.switchTab(tab);
                });
            });
        }

        // Available scripts refresh
        if (this.refreshAvailableBtn) {
            this.refreshAvailableBtn.addEventListener('click', () => this.loadAvailableScripts());
        }

        // Input elements
        this.scriptUrlInput = document.getElementById('claspScriptUrl');
        this.projectNameInput = document.getElementById('claspProjectName');
        this.sheetUrlInput = document.getElementById('claspSheetUrl');
        this.deployBtn = document.getElementById('claspDeployBtn');

        console.log('Input elements:', {
            scriptUrlInput: !!this.scriptUrlInput,
            projectNameInput: !!this.projectNameInput,
            sheetUrlInput: !!this.sheetUrlInput,
            deployBtn: !!this.deployBtn
        });

        // Progress elements
        this.progressSection = document.getElementById('claspProgressSection');
        this.progressFill = document.getElementById('claspProgressFill');
        this.logOutput = document.getElementById('claspLogOutput');

        // Success elements
        this.successSection = document.getElementById('claspSuccessSection');
        this.projectInfo = document.getElementById('claspProjectInfo');
        this.openProjectBtn = document.getElementById('claspOpenProjectBtn');
        this.openScriptBtn = document.getElementById('claspOpenScriptBtn');
        this.newDeployBtn = document.getElementById('claspNewDeployBtn');

        // Error elements
        this.errorSection = document.getElementById('claspErrorSection');
        this.errorMessage = document.getElementById('claspErrorMessage');
        this.errorDetails = document.getElementById('claspErrorDetails');
        this.retryBtn = document.getElementById('claspRetryBtn');
        this.newDeployErrorBtn = document.getElementById('claspNewDeployErrorBtn');

        // Footer links
        this.helpLink = document.getElementById('claspHelpLink');

        console.log('Elements initialization complete');
    }

    initializeTheme() {
        // Initialize theme on page load
        const savedTheme = localStorage.getItem('theme') || 'system';
        this.applyTheme(savedTheme);
    }

    bindEvents() {
        console.log('Binding events...');
        // Projects events
        if (this.refreshProjectsBtn) {
            console.log('Binding refresh button click event');
            this.refreshProjectsBtn.addEventListener('click', () => this.loadExistingProjects());
        } else {
            console.log('Refresh button not found, skipping event binding');
        }

        // Deploy button
        if (this.deployBtn) {
            this.deployBtn.addEventListener('click', () => this.startDeployment());
        }

        // Enter key in inputs
        if (this.scriptUrlInput) {
            this.scriptUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.startDeployment();
            });
        }
        if (this.projectNameInput) {
            this.projectNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.startDeployment();
            });
        }

        // Success actions
        if (this.openProjectBtn) {
            this.openProjectBtn.addEventListener('click', () => this.showFolderInstructions());
        }
        if (this.openScriptBtn) {
            this.openScriptBtn.addEventListener('click', () => this.showScriptInstructions());
        }
        if (this.newDeployBtn) {
            this.newDeployBtn.addEventListener('click', () => this.resetToInput());
        }

        // Error actions
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.startDeployment());
        }
        if (this.newDeployErrorBtn) {
            this.newDeployErrorBtn.addEventListener('click', () => this.resetToInput());
        }

        // Footer links
        if (this.helpLink) {
            this.helpLink.addEventListener('click', () => this.showHelp());
        }

        // Event delegation for sheet buttons (they're dynamically generated)
        console.log('Adding click listener to document for sheet buttons...');
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            if (action === 'add-sheet' || action === 'edit-sheet') {
                e.preventDefault();
                const projectName = btn.getAttribute('data-project-name');
                const sheetUrl = btn.getAttribute('data-sheet-url') || '';
                console.log('🎯 Sheet action captured!', { action, projectName, sheetUrl });
                this.openSheetManager(projectName, sheetUrl);
            }
        });
    }

    getAuthToken() {
        if (window.AuthManager && typeof window.AuthManager.getToken === 'function') {
            return window.AuthManager.getToken();
        }
        return localStorage.getItem('scriptflow_auth_token');
    }

    withAuthHeaders(headers = {}) {
        const token = this.getAuthToken();
        if (!token) {
            return { ...headers };
        }
        return {
            ...headers,
            'Authorization': `Bearer ${token}`
        };
    }

    async loadExistingProjects() {
        console.log('Loading projects...');
        this.projectsGrid.innerHTML = '<div class="loading">Loading projects...</div>';

        // Add a timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
            const response = await fetch('/api/projects', {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.projects = data.projects || [];
            this.displayProjects(this.projects);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Failed to load projects:', error);

            if (error.name === 'AbortError') {
                console.log('Request timed out');
            }

            // Fallback: show demo projects so user can see the interface works
            console.log('Showing fallback demo projects');
            const demoProjects = [
                {
                    name: "Demo Project 1",
                    scriptId: "1ABC123DEF456789",
                    lastModifiedDisplay: "2h ago",
                    lastModifiedFile: "Code.ts"
                },
                {
                    name: "Demo Project 2",
                    scriptId: "2DEF456GHI789012",
                    lastModifiedDisplay: "1d ago",
                    lastModifiedFile: "Code.js"
                }
            ];

            this.displayProjects(demoProjects);

            // Show error message
            setTimeout(() => {
                alert(`⚠️ Could not load real projects from server.\nShowing demo projects instead.\n\nError: ${error.message}\n\nPlease check that the server is running on http://localhost:3002`);
            }, 1000);
        }
    }

    displayProjects(projects) {
        console.log('Displaying projects:', projects.length, 'projects found');

        // Check if projectsGrid exists (might be on wrong page)
        if (!this.projectsGrid) {
            console.warn('projectsGrid element not found, skipping display');
            return;
        }

        // Add "Create New Project" card as the first item
        if (projects.length === 0) {
            console.log('No projects found');
            this.projectsGrid.innerHTML = '<div class="no-projects">No existing projects found. Import or create a project on the right!</div>';
            return;
        }

        const projectsHtml = projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <div class="project-status">
                        <div class="status-dot status-active"></div>
                    </div>
                    <h3 class="project-name">${project.name}</h3>
                    <div class="project-controls">
                        <button class="glass-btn icon-only small" onclick="window.claspDeployer.toggleAutoDeploy('${project.name}')" title="Toggle Auto-Deploy" id="watch-${project.name}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="glass-btn icon-only small" onclick="window.claspDeployer.openProjectFolder('${project.name}')" title="Open in Cursor">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>

                </div>

                <div class="project-content">

                    <div class="project-script-id">
                        <code class="script-id">${this.truncateScriptId(project.scriptId)}</code>
                        <a href="https://script.google.com/d/${project.scriptId}/edit" target="_blank" class="apps-script-link" title="Open in Google Apps Script">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        ${project.description && project.description.sheetUrl ? `
                        <div class="sheet-button-group">
                            <a href="${project.description.sheetUrl}" target="_blank" class="glass-btn success small sheet-btn" title="Open Google Sheet">
                                <i class="fas fa-file-spreadsheet"></i>
                                SHEET
                            </a>
                            <button class="glass-btn icon-only small edit-sheet-btn" data-action="edit-sheet" data-project-name="${project.name}" data-sheet-url="${project.description.sheetUrl}" title="Edit Sheet Link">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                        </div>
                        ` : `
                        <button class="glass-btn secondary small associate-sheet-btn" data-action="add-sheet" data-project-name="${project.name}" title="Associate Google Sheet">
                            <i class="fas fa-plus"></i> Sheet
                        </button>
                        `}
                    </div>

                    <div class="project-meta">
                        ${project.lastPush ? `<div class="meta-item"><i class="fas fa-upload"></i><span>Last push: ${this.formatDeploymentTime(project.lastPush)}</span></div>` : '<div class="meta-item"><i class="fas fa-upload"></i><span>No pushes yet</span></div>'}
                        ${project.lastPull ? `<div class="meta-item"><i class="fas fa-download"></i><span>Last pull: ${this.formatDeploymentTime(project.lastPull)}</span></div>` : '<div class="meta-item"><i class="fas fa-download"></i><span>No pulls yet</span></div>'}
                    </div>
                    ${project.description ? `
                    <div class="project-description">
                        <button class="description-toggle" onclick="this.parentElement.classList.toggle('expanded')">
                            <i class="fas fa-chevron-down"></i>
                            <span>${project.description.title}</span>
                        </button>
                        <div class="description-content">
                            <p class="description-text">${project.description.description}</p>
                            <div class="description-features">
                                ${project.description.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="project-footer">
                    <button class="glass-btn primary small" onclick="window.claspDeployer.deployProject('${project.name}')">
                        <i class="fas fa-rocket"></i>
                        Deploy
                    </button>
                    <button class="glass-btn small" onclick="window.claspDeployer.runProject('${project.name}', '${project.scriptId}')" title="Run a function in this script">
                        <i class="fas fa-play"></i>
                        Run
                    </button>
                    <button class="glass-btn small" onclick="window.claspDeployer.viewProjectLogs('${project.name}', '${project.scriptId}')" title="View script logs">
                        <i class="fas fa-list"></i>
                        Logs
                    </button>
                    <button class="glass-btn small" onclick="window.claspDeployer.refreshProject('${project.name}')" title="Pull latest changes from Google Apps Script">
                        <i class="fas fa-download"></i>
                        Pull
                    </button>
                    <button class="glass-btn small" onclick="window.claspDeployer.showDeploymentHistory('${project.name}')" title="View deployment history">
                        <i class="fas fa-history"></i>
                        History
                    </button>
                </div>

            </div>
        `).join('');

        this.projectsGrid.innerHTML = projectsHtml;

        // Set auto-deploy button states
        projects.forEach(project => {
            this.updateAutoDeployButtonState(project.name);
        });
    }

    openSheetManager(projectName, currentUrl) {
        console.log('openSheetManager called with:', projectName, currentUrl);
        const modal = document.getElementById('sheetModal');
        const urlInput = document.getElementById('sheetModalUrl');
        const nameInput = document.getElementById('sheetModalProjectName');

        console.log('Found elements:', { modal: !!modal, urlInput: !!urlInput, nameInput: !!nameInput });

        if (modal && urlInput && nameInput) {
            urlInput.value = currentUrl || '';
            nameInput.value = projectName;

            // CRITICAL FIX: Move modal to document.body if it's not already there
            // This ensures it's not constrained by any parent container
            if (modal.parentElement !== document.body) {
                console.log('📦 Moving modal from', modal.parentElement?.tagName, 'to document.body');
                document.body.appendChild(modal);
            }

            // Completely replace the inline style to force visibility
            modal.setAttribute('style', `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                min-width: 100vw !important;
                min-height: 100vh !important;
                align-items: center !important;
                justify-content: center !important;
                background: rgba(0, 0, 0, 0.8) !important;
                z-index: 10000 !important;
                pointer-events: auto !important;
            `.trim());

            setTimeout(() => {
                urlInput.focus();
                const rect = modal.getBoundingClientRect();
                console.log('✅ Modal dimensions (after body move):', rect.width, 'x', rect.height);
                console.log('🎉 Modal is visible?', rect.width > 0 && rect.height > 0 ? 'YES!!!' : 'NO');
            }, 100);
        } else {
            console.error('Missing modal elements!', { modal, urlInput, nameInput });
        }
    }

    async saveSheetAssociation(event) {
        const urlInput = document.getElementById('sheetModalUrl');
        const nameInput = document.getElementById('sheetModalProjectName');
        const modal = document.getElementById('sheetModal');

        if (!urlInput || !nameInput) return;

        const sheetUrl = urlInput.value.trim();
        const projectName = nameInput.value;
        const saveBtn = event.currentTarget || event.target;
        if (!saveBtn) return;
        const originalText = saveBtn.innerHTML;

        try {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            const response = await fetch('/api/project/metadata', {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    projectName,
                    sheetUrl: sheetUrl || null // Send null if empty to remove association
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('✅ Spreadsheet association updated!');
                if (modal) modal.style.display = 'none';
                this.loadExistingProjects(); // Refresh UI
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    truncateScriptId(scriptId) {
        if (scriptId.length <= 20) return scriptId;
        return scriptId.substring(0, 17) + '...';
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


    async refreshProject(projectName) {
        const refreshBtn = event.target;
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pulling...';
        refreshBtn.disabled = true;

        try {
            const response = await fetch('/api/refresh', {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({ projectName })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`✅ Successfully pulled latest changes for "${projectName}"!`, 'success');
                // Reload projects list to show updated status
                this.loadExistingProjects();
            } else {
                this.showNotification(`❌ Failed to pull changes for "${projectName}": ${result.message}`, 'error');
            }
        } catch (error) {
            this.showNotification(`❌ Error pulling changes for "${projectName}": ${error.message}`, 'error');
        } finally {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }

    async runProject(projectName, scriptId) {
        this.setState('progress');
        this.clearLogs();
        this.addLog(`🔍 Analyzing project "${projectName}" for executable functions...`);

        let availableFunctions = ['main'];

        try {
            const funcResponse = await fetch(`/api/platforms/appscript/scenarios/${scriptId}/functions`, {
                headers: this.withAuthHeaders()
            });
            const funcData = await funcResponse.json();
            if (funcData.success && funcData.functions && funcData.functions.length > 0) {
                availableFunctions = funcData.functions;
            }
        } catch (error) {
            console.warn('Could not fetch functions:', error);
        }

        this.showRunModal(projectName, scriptId, availableFunctions);
    }

    showRunModal(projectName, scriptId, functions) {
        const modalId = 'run-function-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content glass-panel" style="max-width: 400px; border: 1px solid var(--accent-blue-glow);">
                <div class="modal-header">
                    <h2><i class="fas fa-play" style="color: var(--accent-blue);"></i> Run Function</h2>
                    <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="text-secondary" style="margin-bottom: 20px; font-size: 14px;">Select a function to execute in <span style="color: var(--text-primary); font-weight: 600;">${projectName}</span>:</p>
                    <div class="function-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto; padding-right: 6px;">
                        ${functions.map(fn => `
                            <button class="glass-btn text-left w-100 highlight-on-hover" onclick="window.claspDeployer.executeFunction('${scriptId}', '${fn}', '${projectName}')" style="justify-content: flex-start; padding: 14px 16px; position: relative;">
                                <div style="display: flex; align-items: center; width: 100%;">
                                    <i class="fas fa-code-branch" style="opacity: 0.6; margin-right: 12px; font-size: 14px; color: var(--accent-blue);"></i>
                                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px;">${fn}</span>
                                    <i class="fas fa-chevron-right" style="margin-left: auto; opacity: 0.3; font-size: 12px;"></i>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 24px; background: rgba(0,0,0,0.1);">
                    <button class="glass-btn small" onclick="document.getElementById('${modalId}').style.display='none'">Cancel</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    async executeFunction(scriptId, functionName, projectName) {
        const modal = document.getElementById('run-function-modal');
        if (modal) modal.style.display = 'none';

        this.setState('progress');
        this.clearLogs();
        this.addLog(`🚀 [AppScript] Executing function: ${functionName}`);
        this.addLog(`📂 Project: ${projectName}`);
        this.addLog(`--------------------------------------------------`);

        try {
            const response = await fetch(`/api/platforms/appscript/scenarios/${scriptId}/run`, {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    credentials: {}, // Backend handles credentials
                    functionName
                })
            });

            const result = await response.json();

            if (result.success) {
                this.addLog('✅ Execution successful!');
                this.addLog('\n--- Output ---');
                this.addLog(result.output || '(No output)');
                this.addLog('--------------');

                this.showNotification(`✅ Function "${functionName}" executed successfully!`, 'success');
            } else {
                this.handleError({ output: result.error || 'Execution failed' });
            }
        } catch (error) {
            this.handleError({ output: error.message });
        }
    }

    async viewProjectLogs(projectName, scriptId) {
        this.setState('progress');
        this.clearLogs();
        this.addLog(`📋 Fetching logs for "${projectName}"...`);

        try {
            const response = await fetch(`/api/platforms/appscript/scenarios/${scriptId}/logs`, {
                headers: this.withAuthHeaders()
            });
            const result = await response.json();

            if (result.success) {
                this.addLog('✅ Logs retrieved:');
                this.addLog('----------------------------------------');
                this.addLog(result.logs || '(No logs found)');
                this.addLog('----------------------------------------');
            } else {
                this.handleError({ output: result.error || 'Failed to fetch logs' });
            }
        } catch (error) {
            this.handleError({ output: error.message });
        }
    }

    async openProjectFolder(projectName) {
        const openBtn = event.target;
        const originalText = openBtn.innerHTML;
        openBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening...';
        openBtn.disabled = true;

        try {
            const response = await fetch('/api/open-folder', {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({ projectName })
            });

            const result = await response.json();

            console.log('Open folder response:', result);

            if (result.success) {
                if (result.method === 'manual' || result.method === 'clipboard') {
                    // Copy path to clipboard and show instructions for manual opening
                    if (result.path) {
                        // Copy the path to clipboard automatically
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(result.path).then(() => {
                                console.log('Path copied to clipboard');
                            }).catch(err => {
                                console.log('Failed to copy path to clipboard:', err);
                            });
                        }

                        this.showNotification(`📋 ${result.message}<br><small>Paste in Cursor to open</small>`, 'info');

                        // Show detailed instructions
                        setTimeout(() => {
                            const isFile = result.openedFile;
                            const instructions = `Path copied to clipboard!\n\n${result.path}\n\nTo open in Cursor:\n1. Press Cmd+Shift+P (Command Palette)\n2. Type "${isFile ? 'File: Open' : 'File: Open Folder'}"\n3. Press Cmd+V to paste the path\n4. Press Enter`;

                            alert(instructions);
                        }, 500);
                    }
                } else {
                    // Legacy automatic opening response
                    this.showNotification(`✅ ${result.message}!`, 'success');
                }
            } else {
                this.showNotification(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            alert(`❌ Error opening folder: ${error.message}`);
        } finally {
            openBtn.innerHTML = originalText;
            openBtn.disabled = false;
        }
    }

    async startDeployment() {
        const scriptUrl = this.scriptUrlInput.value.trim();
        const projectName = this.projectNameInput.value.trim();
        const sheetUrl = this.sheetUrlInput ? this.sheetUrlInput.value.trim() : '';

        if (!scriptUrl) {
            this.showError('Please enter a Google Apps Script URL or Script ID');
            return;
        }

        // Validate URL format
        if (!this.isValidScriptInput(scriptUrl)) {
            this.showError('Invalid script URL format. Please check your input.');
            return;
        }

        this.setState('progress');
        this.clearLogs();
        this.addLog('🚀 Starting CLASP deployment...');

        try {
            // Start deployment
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    scriptUrl,
                    projectName,
                    sheetUrl
                })
            });

            const result = await response.json();

            if (result.success !== undefined) {
                // Direct response (simplified mode)
                if (result.success) {
                    this.handleSuccess(result, scriptUrl, projectName);
                } else {
                    this.handleError(result);
                }
            } else if (result.deploymentId) {
                // SSE mode (future enhancement)
                this.connectToDeploymentStream(result.deploymentId, scriptUrl, projectName);
            } else {
                this.handleError({ output: 'Failed to start deployment' });
            }
        } catch (error) {
            this.handleError({ output: error.message });
        }
    }

    connectToDeploymentStream(deploymentId, scriptUrl, projectName) {
        const eventSource = new EventSource(`/api/deploy/stream?id=${deploymentId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'connected':
                        this.addLog('📡 Connected to deployment stream');
                        break;
                    case 'log':
                        this.addLog(data.message);
                        break;
                    case 'complete':
                        eventSource.close();
                        if (data.success) {
                            this.handleSuccess(data, scriptUrl, projectName);
                        } else {
                            this.handleError(data);
                        }
                        break;
                    case 'error':
                        eventSource.close();
                        this.handleError({ output: data.message, details: data.details });
                        break;
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            eventSource.close();
            this.handleError({ output: 'Lost connection to deployment server' });
        };

        // Store reference for cleanup
        this.currentEventSource = eventSource;
    }

    isValidScriptInput(input) {
        // Check for direct script ID (alphanumeric with dashes/underscores)
        if (/^[a-zA-Z0-9_-]+$/.test(input)) {
            return input.length > 10; // Basic length check
        }

        // Check for URL patterns
        const urlPatterns = [
            /https:\/\/script\.google\.com\/d\/[a-zA-Z0-9_-]+/,
            /https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+/
        ];

        return urlPatterns.some(pattern => pattern.test(input));
    }

    setState(state) {
        this.currentState = state;

        // Hide all sections
        this.progressSection.style.display = 'none';
        this.successSection.style.display = 'none';
        this.errorSection.style.display = 'none';

        // Show appropriate section
        switch (state) {
            case 'progress':
                this.progressSection.style.display = 'block';
                this.progressSection.classList.add('fade-in');
                break;
            case 'success':
                this.successSection.style.display = 'block';
                this.successSection.classList.add('fade-in');
                break;
            case 'error':
                this.errorSection.style.display = 'block';
                this.errorSection.classList.add('fade-in');
                break;
        }
    }

    clearLogs() {
        this.logOutput.innerHTML = '';
        this.progressFill.style.width = '0%';
    }

    addLog(message) {
        const logLine = document.createElement('div');
        logLine.className = 'log-line';
        logLine.textContent = this.stripAnsiCodes(message);
        this.logOutput.appendChild(logLine);
        this.logOutput.scrollTop = this.logOutput.scrollHeight;

        // Update progress based on log content
        this.updateProgress(message);
    }

    stripAnsiCodes(str) {
        // Remove ANSI escape codes for clean display
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    updateProgress(logMessage) {
        let progress = 0;

        if (logMessage.includes('CLASP Environment Deployer')) progress = 10;
        if (logMessage.includes('CLASP is installed')) progress = 20;
        if (logMessage.includes('CLASP is authenticated')) progress = 30;
        if (logMessage.includes('Extracted Script ID')) progress = 40;
        if (logMessage.includes('Created project directory')) progress = 50;
        if (logMessage.includes('Created .clasp.json')) progress = 60;
        if (logMessage.includes('Created appsscript.json')) progress = 70;
        if (logMessage.includes('pulling existing code')) progress = 80;
        if (logMessage.includes('Successfully pushed')) progress = 90;
        if (logMessage.includes('deployed successfully')) progress = 100;

        this.progressFill.style.width = `${progress}%`;
    }

    handleSuccess(result, scriptUrl, projectName) {
        this.setState('success');
        this.addLog('✅ Operation completed successfully!');

        // Prefer structured data from backend if available, otherwise extract from output string
        const projectPath = result.path || this.extractProjectPath(result.output);
        const scriptId = result.scriptId || this.extractScriptId(result.output);

        this.displayProjectInfo(scriptId, projectPath, projectName);
        this.currentProjectPath = projectPath;
        this.currentScriptId = scriptId;
    }

    handleError(result) {
        this.setState('error');
        this.errorMessage.textContent = 'Deployment failed. Please check the details below.';
        this.errorDetails.textContent = result.output || 'Unknown error occurred';
        this.addLog('❌ Deployment failed');
    }

    showError(message) {
        // Show error in input state
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: var(--error-color);
            font-size: 0.9rem;
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;

        this.scriptUrlInput.parentNode.appendChild(errorDiv);

        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    extractProjectPath(output) {
        if (!output || typeof output !== 'string') return null;
        const match = output.match(/scripts\/([a-z0-9-]+)/i);
        return match ? `scripts/${match[1]}` : null;
    }

    extractScriptId(output) {
        if (!output || typeof output !== 'string') return null;
        const match = output.match(/Script ID: ([a-zA-Z0-9_-]+)/i);
        return match ? match[1] : null;
    }

    displayProjectInfo(scriptId, projectPath, projectName) {
        this.projectInfo.innerHTML = `
            <div class="project-info-item">
                <span class="project-info-label">Project Name:</span>
                <span class="project-info-value">${projectName || 'Auto-generated'}</span>
            </div>
            <div class="project-info-item">
                <span class="project-info-label">Script ID:</span>
                <span class="project-info-value">${scriptId || 'Unknown'}</span>
            </div>
            <div class="project-info-item">
                <span class="project-info-label">Project Path:</span>
                <span class="project-info-value">${projectPath || 'Unknown'}</span>
            </div>
        `;
    }

    showFolderInstructions() {
        const workspaceDir = window.platformManager ? window.platformManager.getWorkspacePath() : '/Users/bricelengama/Documents/Marketing Opti/Cursor';
        const instructions = `
To open the project folder:
1. Open Terminal/Command Prompt
2. Navigate to your project directory:
   cd "${workspaceDir}/${this.currentProjectPath || 'scripts/your-project'}"
3. Open in Finder:
   open .
        `;
        alert(instructions);
    }

    showScriptInstructions() {
        if (this.currentScriptId) {
            const url = `https://script.google.com/d/${this.currentScriptId}/edit`;
            window.open(url, '_blank');
        } else {
            alert('Script ID not found. Please check the deployment logs.');
        }
    }

    resetToInput() {
        // Close any active EventSource connections
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }

        this.setState('input');
        this.scriptUrlInput.value = '';
        this.projectNameInput.value = '';
        this.scriptUrlInput.focus();
    }

    showHelp() {
        const help = `
🚀 CLASP Deployer - Dynamic Features:

📁 EXISTING PROJECTS:
• View all your deployed CLASP projects
• Refresh any project with latest Google Apps Script changes
• Open projects directly in Cursor IDE

🆕 CREATE NEW PROJECTS:
• Deploy from Google Apps Script URLs
• Automatic project structure setup
• TypeScript templates and configuration

✨ KEY FEATURES:
• Local CLASP installation (no global dependencies)
• Automatic Cursor IDE integration
• Real-time deployment progress
• Smart duplicate detection

🔗 SUPPORTED URL FORMATS:
• https://script.google.com/d/SCRIPT_ID/edit
• https://script.google.com/d/SCRIPT_ID
• Direct Script ID: SCRIPT_ID

🎯 WORKFLOW:
1. Double-click desktop shortcut
2. Choose existing project to refresh OR create new
3. Projects automatically open in Cursor
4. Start coding immediately!

For issues, check deployment logs or contact support.
        `;
        this.showNotification('Help information displayed in console', 'info');
        console.log(help);
    }

    async deployProject(projectName) {
        // Show deployment modal
        this.showDeploymentModal(projectName);
    }

    showDeploymentModal(projectName) {
        // Create modal HTML
        const modalHtml = `
            <div id="deployment-modal" class="modal-overlay">
                <div class="modal-content deployment-modal">
                    <div class="modal-header">
                        <h2>🚀 Deploy ${projectName}</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>

                    <div class="modal-body">
                        <div class="deployment-form">
                            <div class="form-group">
                                <label for="deploy-version">Version:</label>
                                <input type="text" id="deploy-version" placeholder="1.0.0 (auto-increment)" />
                                <small>Leave empty for auto-increment</small>
                            </div>

                            <div class="form-group">
                                <label for="deploy-message">Message:</label>
                                <textarea id="deploy-message" placeholder="Deployment notes..." rows="3"></textarea>
                            </div>

                            <div class="deployment-progress" id="deployment-progress" style="display: none;">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progress-fill"></div>
                                </div>
                                <div class="progress-text" id="progress-text">Preparing deployment...</div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn-primary" id="deploy-btn" onclick="window.claspDeployer.executeDeployment('${projectName}')">
                            <i class="fas fa-rocket"></i>
                            Deploy
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async executeDeployment(projectName) {
        const version = document.getElementById('deploy-version').value.trim();
        const message = document.getElementById('deploy-message').value.trim();
        const deployBtn = document.getElementById('deploy-btn');
        const progressDiv = document.getElementById('deployment-progress');

        // Update UI for deployment in progress
        deployBtn.disabled = true;
        deployBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deploying...';
        progressDiv.style.display = 'block';

        try {
            // Execute deployment
            const response = await fetch(`/api/deploy/${projectName}`, {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    version: version || undefined,
                    message: message || undefined,
                    autoIncrement: !version
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`✅ ${result.message}`, 'success');

                // Close modal and refresh projects
                document.getElementById('deployment-modal').remove();
                this.loadExistingProjects();
            } else {
                this.showNotification(`❌ ${result.message || result.error}`, 'error');
                deployBtn.disabled = false;
                deployBtn.innerHTML = '<i class="fas fa-rocket"></i> Deploy';
                progressDiv.style.display = 'none';
            }

        } catch (error) {
            this.showNotification(`❌ Deployment failed: ${error.message}`, 'error');
            deployBtn.disabled = false;
            deployBtn.innerHTML = '<i class="fas fa-rocket"></i> Deploy';
            progressDiv.style.display = 'none';
        }
    }

    switchTab(tab) {
        // Update active tab link
        if (this.claspTabLinks) {
            this.claspTabLinks.forEach(link => {
                if (link.getAttribute('data-tab') === tab) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }

        // Show/hide sections
        if (tab === 'local') {
            if (this.projectsSection) this.projectsSection.style.display = 'block';
            if (this.availableScriptsSection) this.availableScriptsSection.style.display = 'none';
            if (this.refreshProjectsBtn) this.refreshProjectsBtn.style.display = 'inline-flex';
            if (this.refreshAvailableBtn) this.refreshAvailableBtn.style.display = 'none';
        } else if (tab === 'available') {
            if (this.projectsSection) this.projectsSection.style.display = 'none';
            if (this.availableScriptsSection) this.availableScriptsSection.style.display = 'block';
            if (this.refreshProjectsBtn) this.refreshProjectsBtn.style.display = 'none';
            if (this.refreshAvailableBtn) this.refreshAvailableBtn.style.display = 'inline-flex';

            // Load available scripts when switching to this tab
            this.loadAvailableScripts();
        }
    }

    async loadAvailableScripts() {
        console.log('Loading available scripts from Google account...');

        if (!this.availableScriptsGrid) return;

        this.availableScriptsGrid.innerHTML = '<div class="loading">Loading scripts from Google account...<br><small>This may take a few seconds</small></div>';

        try {
            // Use unified Platform Manager
            const scripts = await window.platformManager.getScenarios('appscript');

            // Map standard 'id' to legacy 'scriptId' for compatibility with existing render methods
            const compatibleScripts = scripts.map(s => ({
                ...s,
                scriptId: s.id // Adapter returns 'id', frontend expects 'scriptId'
            }));

            this.renderAvailableScripts(compatibleScripts);

        } catch (error) {
            console.error('Failed to load available scripts:', error);
            this.availableScriptsGrid.innerHTML = `
                <div class="no-projects" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--status-warning); margin-bottom: 1rem;"></i>
                    <h3>Failed to load scripts</h3>
                    <p style="color: var(--text-secondary);">${error.message || 'Please check your connection.'}</p>
                    <button class="glass-btn primary" onclick="window.claspDeployer.loadAvailableScripts()" style="margin-top: 1rem;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }


    renderAvailableScripts(scripts) {
        if (!scripts || scripts.length === 0) {
            this.availableScriptsGrid.innerHTML = '<div class="no-projects">No scripts found in your Google account.</div>';
            return;
        }

        const scriptCards = scripts.map(script => this.createAvailableScriptCard(script)).join('');

        // Add a helper message at the bottom
        const helperMessage = `
            <div class="helper-message glass-panel" style="grid-column: 1 / -1; margin-top: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                <p><i class="fas fa-info-circle"></i> Don't see all your scripts?</p>
                <p><code>clasp list</code> only shows scripts you have permission to access via Drive API.</p>
                <!-- Permissions fix hidden for strict policy -->
                <!-- <p>
                    <button class="glass-btn small" onclick="window.claspDeployer.fixPermissions()">
                        <i class="fab fa-google"></i> Fix Permissions (Login)
                    </button>
                    <span style="margin: 0 10px;">or</span>
                    <a href="#" onclick="document.querySelector('[data-tab=local]').click(); document.getElementById('claspScriptUrl').focus(); return false;">Pull via URL</a>
                </p> -->
            </div>
        `;

        this.availableScriptsGrid.innerHTML = scriptCards + helperMessage;
    }

    async fixPermissions() {
        if (!confirm('This will open a browser window to authenticate with Google.\n\nIMPORTANT: This will use an Enhanced Access flow to see ALL your scripts.\n\nPlease accept the permissions requested in the popup.')) {
            return;
        }

        this.showNotification('🚀 Launching authentication...', 'info');

        try {
            // Get Auth URL from server
            const response = await fetch('/api/auth/url', {
                headers: this.withAuthHeaders()
            });
            const data = await response.json();

            if (data.url) {
                // Open popup
                const width = 600;
                const height = 700;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;

                window.open(data.url, 'GoogleAuth', `width=${width},height=${height},top=${top},left=${left}`);

                this.showNotification('✅ Authentication window opened. Please complete the login.', 'success');

                // Helper message
                const msg = document.createElement('div');
                msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a1a;padding:20px;border:1px solid #333;border-radius:8px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.5);text-align:center;';
                msg.innerHTML = `
                    <h3>🔐 Authenticating...</h3>
                    <p>Please complete the login in the popup window.</p>
                    <button onclick="this.parentElement.remove(); window.claspDeployer.loadAvailableScripts()" class="glass-btn primary" style="margin-top:15px">I'm Done - Refresh Scripts</button>
                    <button onclick="this.parentElement.remove()" class="glass-btn secondary" style="margin-top:10px">Cancel</button>
                `;
                document.body.appendChild(msg);

            } else {
                this.showNotification(`❌ Error: ${data.message || data.error}`, 'error');
            }
        } catch (e) {
            this.showNotification(`❌ Request failed: ${e.message}`, 'error');
        }
    }

    createAvailableScriptCard(script) {
        const isLocal = script.isLocal;

        return `
            <div class="project-card script-card ${isLocal ? 'local-script' : ''}" data-id="${script.scriptId}">
                <div class="project-header">
                    <div class="project-status">
                        <div class="status-dot status-active"></div>
                    </div>
                    <h3 class="project-name">${script.name || 'Untitled Project'}</h3>
                    <div class="project-controls">
                        ${isLocal ? '<span class="local-badge"><i class="fas fa-check-circle"></i> Local</span>' : ''}
                        <a href="${script.url}" target="_blank" class="glass-btn icon-only small" title="Open in Google Apps Script">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                </div>

                <div class="project-content">
                    <div class="project-script-id">
                        <code class="script-id">ID: ${script.scriptId}</code>
                    </div>

                    <div class="project-meta">
                        <div class="meta-item">
                            <i class="fab fa-google"></i>
                            <span>Apps Script</span>
                        </div>
                    </div>
                </div>

                <div class="project-footer">
                    ${isLocal ? `
                        <button class="glass-btn secondary small" disabled title="Already pulled locally">
                            <i class="fas fa-check"></i>
                            Pulled
                        </button>
                    ` : `
                        <button class="glass-btn primary small pull-to-cursor-btn" onclick="window.claspDeployer.pullScript(event, '${script.scriptId}', '${script.name.replace(/'/g, "\\\\'")}')" title="Pull script to Cursor">
                            <i class="fas fa-download"></i>
                            Pull to Cursor
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    async pullScript(event, scriptId, scriptName) {
        const pullBtn = event?.target?.closest('button') || document.querySelector(`.pull-to-cursor-btn[onclick*="${scriptId}"]`);
        if (!pullBtn) {
            console.error('Could not find pull button');
            return;
        }

        const originalText = pullBtn.innerHTML;
        pullBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pulling...';
        pullBtn.disabled = true;

        // Use a safe directory name (remove special chars)
        const safeName = scriptName.replace(/[^a-zA-Z0-9-_]/g, '_');

        this.showNotification(`🚀 Starting pull for "${scriptName}"...`, 'info');

        try {
            const response = await fetch('/api/clasp/clone', {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({
                    scriptId: scriptId,
                    name: safeName // Backend expects 'name', not 'projectName'
                })
            });
            const data = await response.json();

            if (data.success) {
                this.showNotification(`✅ Successfully pulled "${scriptName}"!`, 'success');
                this.handleSuccess(data, `https://script.google.com/d/${scriptId}`, safeName);
                this.loadAvailableScripts();
                this.loadExistingProjects();
            } else {
                const errorMessage = data.details ?
                    `❌ Failed: ${data.details.split('\n')[0]}` :
                    `❌ Failed to pull script: ${data.error || 'Unknown error'}`;

                this.showNotification(errorMessage, 'error');
                console.error('Clone failed:', data.details || data.error);

                // If we have details, show them in a more persistent way or via notification
                if (data.details) {
                    this.handleError({ output: data.details });
                }
            }
        } catch (error) {
            console.error('Failed to pull script:', error);
            this.showNotification(`❌ Error pulling script: ${error.message}`, 'error');
        } finally {
            pullBtn.innerHTML = originalText;
            pullBtn.disabled = false;
        }
    }

    async manualClone() {
        const idInput = document.getElementById('manualScriptId');
        const nameInput = document.getElementById('manualScriptName');
        const scriptId = idInput.value.trim();
        let scriptName = nameInput.value.trim();

        if (!scriptId) {
            this.showNotification('❌ Please enter a Script ID', 'error');
            return;
        }

        if (!scriptName) {
            scriptName = `Script_${scriptId.substring(0, 8)}`;
        }

        await this.pullScript(null, scriptId, scriptName);

        // Clear inputs on success (though page might reload/update)
        idInput.value = '';
        nameInput.value = '';
    }

    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `glass-panel notification ${type}`;
        notification.style.cssText = `
            padding: 1rem;
            border-radius: 8px;
            background: rgba(20, 20, 30, 0.9);
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text-primary);
        `;

        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';

        notification.innerHTML = `
            <i class="fas fa-${icon}" style="color: var(--${type === 'info' ? 'accent-color' : (type === 'success' ? 'status-success' : 'status-error')})"></i>
            <span>${message}</span>
        `;

        container.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    async showDeploymentHistory(projectName) {
        console.log(`📋 Loading history for ${projectName}...`);
        try {
            // Fetch deployment history
            const response = await fetch(`/api/deployments/${projectName}`, {
                headers: this.withAuthHeaders()
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const result = await response.json();
            console.log(`📦 Found ${result.deployments ? result.deployments.length : 0} deployments`);

            if (!result.deployments || result.deployments.length === 0) {
                this.showNotification('No deployment history found', 'info');
                return;
            }

            // Remove any existing history modal
            const existingModal = document.getElementById('history-modal');
            if (existingModal) existingModal.remove();

            // Create history modal
            const historyHtml = result.deployments.map(deployment => {
                const statusIcon = deployment.status === 'completed' ? '✅' :
                    deployment.status === 'failed' ? '❌' : '⏳';
                const statusClass = deployment.status === 'completed' ? 'status-success' :
                    deployment.status === 'failed' ? 'status-error' : 'status-pending';

                // Safely handle potentially missing data or special characters
                const safeMessage = (deployment.message || 'No description')
                    .replace(/`/g, '\\`').replace(/\$/g, '\\$');

                const timestamp = deployment.timestamp ?
                    new Date(deployment.timestamp).toLocaleString() : 'Unknown date';

                return `
                    <div class="history-item ${statusClass}">
                        <div class="history-header">
                            <div class="history-version">${deployment.version || 'v?'}</div>
                            <div class="history-status">${statusIcon} ${deployment.status}</div>
                            <div class="history-actions">
                                ${deployment.type !== 'rollback' && deployment.status === 'completed' ?
                        `<button class="btn-small" onclick="window.claspDeployer.rollbackToVersion('${projectName}', '${deployment.id}')">
                                        <i class="fas fa-undo"></i> Rollback
                                    </button>` : ''}
                            </div>
                        </div>
                        <div class="history-message">${safeMessage}</div>
                        <div class="history-meta">
                            <span>${timestamp}</span>
                            <span class="history-type">${deployment.type || 'deploy'}</span>
                        </div>
                    </div>
                `;
            }).join('');

            const modalHtml = `
                <div id="history-modal" class="modal-overlay" style="display: flex;">
                    <div class="modal-content history-modal">
                        <div class="modal-header">
                            <h2>📋 Deployment History - ${projectName}</h2>
                            <button class="modal-close" onclick="document.getElementById('history-modal').remove()">&times;</button>
                        </div>

                        <div class="modal-body">
                            <div class="history-list">
                                ${historyHtml}
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button class="glass-btn" onclick="document.getElementById('history-modal').remove()">Close</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            console.log('✅ History modal displayed');

        } catch (error) {
            console.error('❌ History error:', error);
            this.showNotification(`❌ Failed to load deployment history: ${error.message}`, 'error');
        }
    }

    async rollbackToVersion(projectName, versionId) {
        if (!confirm(`Are you sure you want to rollback to this version ? This will restore the project files to that state.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/rollback/${projectName}`, {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({ versionId })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`✅ ${result.message} `, 'success');
                document.getElementById('history-modal').remove();
                this.loadExistingProjects();
            } else {
                this.showNotification(`❌ ${result.error} `, 'error');
            }

        } catch (error) {
            this.showNotification(`❌ Rollback failed: ${error.message} `, 'error');
        }
    }

    async toggleAutoDeploy(projectName) {
        try {
            // Check current status
            const statusResponse = await fetch(`/api/watch/${projectName}`, {
                headers: this.withAuthHeaders()
            });
            const statusResult = await statusResponse.json();

            const newState = !statusResult.enabled;

            // Toggle auto-deployment
            const response = await fetch(`/api/watch/${projectName}`, {
                method: 'POST',
                headers: this.withAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify({ enabled: newState })
            });

            const result = await response.json();

            if (result.success) {
                this.updateAutoDeployButtonState(projectName);
                const statusMsg = newState ? 'enabled' : 'disabled';
                const statusType = newState ? 'success' : 'info';
                this.showNotification(`✅ Auto-deployment ${statusMsg} for ${projectName}`, statusType);
            } else {
                this.showNotification(`❌ Failed to toggle auto-deployment`, 'error');
            }

        } catch (error) {
            this.showNotification(`❌ Error toggling auto-deployment: ${error.message}`, 'error');
        }
    }

    async updateAutoDeployButtonState(projectName) {
        try {
            const response = await fetch(`/api/watch/${projectName}`, {
                headers: this.withAuthHeaders()
            });
            const result = await response.json();

            const watchBtn = document.getElementById(`watch-${projectName}`);
            if (watchBtn) {
                const icon = watchBtn.querySelector('i');
                if (result.enabled) {
                    icon.className = 'fas fa-eye active';
                    watchBtn.title = 'Auto-Deploy: ON - Click to disable';
                } else {
                    icon.className = 'fas fa-eye-slash';
                    watchBtn.title = 'Auto-Deploy: OFF - Click to enable';
                }
            }
        } catch (error) {
            console.error('Failed to update auto-deploy button state:', error);
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

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏗️ Creating CLASP Deployer instance...');
    window.claspDeployer = new ClaspDeployer();
    window.claspDeployer.initialize();

    // Fallback: if projects don't load within 8 seconds, show demo
    setTimeout(() => {
        const grid = document.getElementById('claspProjectsGrid');
        if (grid && grid.innerHTML.includes('Loading projects')) {
            console.log('Fallback triggered: showing demo projects after timeout');
            const demoProjects = [
                {
                    name: "Demo Project 1",
                    scriptId: "1ABC123DEF456789",
                    lastModifiedDisplay: "2h ago",
                    lastModifiedFile: "Code.ts"
                },
                {
                    name: "Demo Project 2",
                    scriptId: "2DEF456GHI789012",
                    lastModifiedDisplay: "1d ago",
                    lastModifiedFile: "Code.js"
                }
            ];
            if (window.claspDeployer) {
                window.claspDeployer.displayProjects(demoProjects);
            }
        }
    }, 8000);

    // Set up a simple polling mechanism to receive deployment logs
    // This is a workaround since we can't use WebSockets easily
    let lastLogLength = 0;

    function checkForLogs() {
        // In a real implementation, you'd poll the server for new logs
        // For now, we'll just show that the app is ready
        if (window.claspDeployer && window.claspDeployer.currentState === 'progress') {
            // Add a heartbeat indicator
            const heartbeat = document.querySelector('.fa-spin');
            if (heartbeat) {
                heartbeat.style.opacity = Math.random() > 0.5 ? '1' : '0.7';
            }
        }
    }

    // Check for logs every second
    setInterval(checkForLogs, 1000);
});
