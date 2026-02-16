/**
 * Onboarding Manager
 * Handles the new user tour and initial setup flow
 */
class OnboardingManager {
    constructor() {
        this.currentStep = 0;
        this.steps = this.getSteps();

        // Initialize if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
        // Expose to window for direct access (e.g., from HTML onclick)
        window.onboardingManager = this;
    }

    init() {
        console.log('✨ OnboardingManager initialized');

        // Check if we should show onboarding
        if (this.shouldShowOnboarding()) {
            // Small delay to let the app load first
            setTimeout(() => this.startOnboarding(), 1000);
        }

        // Add event listeners for modal controls
        this.bindEvents();
    }

    shouldShowOnboarding() {
        // Check localStorage
        const hasCompleted = localStorage.getItem('onboarding_completed');
        return !hasCompleted;
    }

    getSteps() {
        return [
            {
                id: 'welcome',
                title: 'Welcome to ScriptFlow',
                content: `
                    <div class="onboarding-hero">
                        <div class="hero-icon animated"><i class="fas fa-rocket"></i></div>
                        <h3>Supercharge your Automation</h3>
                        <p>You've just installed the most powerful local development environment for Google Apps Script and Make.com.</p>
                        <p>Let's get you set up in less than 2 minutes.</p>
                    </div>
                `,
                actionLabel: 'Let\'s Go!',
                showSkip: true
            },
            {
                id: 'workspace-setup',
                title: 'Define your Workspace',
                content: `
                    <div class="onboarding-split">
                        <div class="step-icon"><i class="fas fa-folder-open"></i></div>
                        <div class="step-text">
                            <h4>Where are your scripts?</h4>
                            <p>Define the root folder where your projects are or will be hosted.</p>
                            <p>This allows ScriptFlow to list your local scripts and manage them.</p>
                            
                            <div class="input-group">
                                <label for="workspacePathInput">Full Path to Workspace</label>
                                <div class="input-with-action">
                                    <input type="text" id="workspacePathInput" class="glass-input" 
                                        placeholder="/Users/name/Documents/Projects" 
                                        value="${window.platformManager ? window.platformManager.getWorkspacePath() : ''}">
                                    <button class="glass-btn" onclick="window.onboardingManager.browseWorkspace()" title="Browse Folder">
                                        <i class="fas fa-folder-open"></i>
                                        <span>Browse</span>
                                    </button>
                                </div>
                            </div>
                            <div class="tip-box">
                                <i class="fas fa-info-circle"></i>
                                <span>You can change this later in Settings.</span>
                            </div>
                        </div>
                    </div>
                `,
                actionLabel: 'Next',
                showBack: true,
                onNext: () => {
                    const pathInput = document.getElementById('workspacePathInput');
                    if (pathInput && pathInput.value) {
                        window.platformManager.setWorkspacePath(pathInput.value);
                    }
                }
            },
            {
                id: 'clasp-setup',
                title: 'Google Apps Script',
                content: `
                    <div class="onboarding-split">
                        <div class="step-icon"><i class="fab fa-google"></i></div>
                        <div class="step-text">
                            <h4>Connect your Account</h4>
                            <p>ScriptFlow uses Google's official CLASP tool to deploy scripts.</p>
                            <p>If you haven't logged in yet, run <code>clasp login</code> in your terminal.</p>
                            <div class="tip-box">
                                <i class="fas fa-lightbulb"></i>
                                <span>Tip: Ensure the Google Apps Script API is enabled in your Google Cloud settings.</span>
                            </div>
                        </div>
                    </div>
                `,
                actionLabel: 'Next',
                showBack: true
            },
            {
                id: 'platform-setup',
                title: 'Connect Platforms',
                content: `
                    <div class="onboarding-split">
                        <div class="step-icon"><i class="fas fa-network-wired"></i></div>
                        <div class="step-text">
                            <h4>Automation Integrations</h4>
                            <p>Do you use Make.com, Zapier, or n8n?</p>
                            <p>You can add your API keys in <strong>Settings</strong> later to manage scenarios directly from this dashboard.</p>
                            <div class="platform-logos">
                                <span class="p-logo make"><i class="fas fa-robot"></i> Make</span>
                                <span class="p-logo zapier"><i class="fas fa-bolt"></i> Zapier</span>
                                <span class="p-logo n8n"><i class="fas fa-project-diagram"></i> n8n</span>
                            </div>
                        </div>
                    </div>
                `,
                actionLabel: 'Next',
                showBack: true
            },
            {
                id: 'first-project',
                title: 'Your First Project',
                content: `
                    <div class="onboarding-split">
                        <div class="step-text">
                            <h4>Ready to Deploy?</h4>
                            <p>To start your first project:</p>
                            <ol class="onboarding-list">
                                <li>Click <strong>Apps Script</strong> in the sidebar</li>
                                <li>Enter a Script ID or URL</li>
                                <li>Click <strong>Create</strong></li>
                            </ol>
                            <p>ScriptFlow will pull the code locally so you can edit it right here in Cursor!</p>
                        </div>
                        <div class="step-image">
                            <!-- CSS illustration of a project card -->
                            <div class="mini-card">
                                <span class="line"></span>
                                <span class="line short"></span>
                                <div class="mini-btn"></div>
                            </div>
                        </div>
                    </div>
                `,
                actionLabel: 'Finish Setup',
                showBack: true
            }
        ];
    }

    bindEvents() {
        // Event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('#onboardingNextBtn')) this.nextStep();
            if (e.target.matches('#onboardingBackBtn')) this.prevStep();
            if (e.target.matches('#onboardingSkipBtn')) this.skipOnboarding();

            // Add restart listener if needed (e.g. from settings)
            if (e.target.matches('[data-action="restart-onboarding"]')) {
                this.startOnboarding();
            }
        });
    }

    startOnboarding() {
        console.log('🚀 Starting onboarding tour...');
        this.currentStep = 0;
        this.renderModal();
        this.renderStep(0);
    }

    renderModal() {
        // Check if modal container exists
        let modal = document.getElementById('onboardingModal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'onboardingModal';
            modal.className = 'modal-overlay onboarding-modal';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        // Force reflow for animation
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    renderStep(index) {
        const step = this.steps[index];
        const modal = document.getElementById('onboardingModal');
        if (!modal) return;

        const totalSteps = this.steps.length;
        const progress = ((index + 1) / totalSteps) * 100;

        const content = `
            <div class="onboarding-content glass-panel" data-step="${index}">
                <div class="onboarding-header">
                    <div class="step-indicator">Step ${index + 1} of ${totalSteps}</div>
                    <button class="modal-close" id="onboardingSkipBtn">&times;</button>
                </div>
                
                <div class="onboarding-body">
                    <h2>${step.title}</h2>
                    ${step.content}
                </div>

                <div class="onboarding-footer">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="onboarding-actions">
                        ${step.showBack ? '<button class="glass-btn" id="onboardingBackBtn">Back</button>' : '<div></div>'}
                        <button class="glass-btn primary large" id="onboardingNextBtn">
                            ${step.actionLabel} ${index < totalSteps - 1 ? '<i class="fas fa-arrow-right"></i>' : '<i class="fas fa-check"></i>'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.innerHTML = content;
    }

    async browseWorkspace() {
        try {
            const response = await fetch('/api/utils/browse-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();

            if (data.success && data.path) {
                const pathInput = document.getElementById('workspacePathInput');
                if (pathInput) {
                    pathInput.value = data.path;
                }
            }
        } catch (e) {
            console.error('Failed to browse folder:', e);
        }
    }

    nextStep() {
        const currentStepData = this.steps[this.currentStep];
        if (currentStepData.onNext) {
            try {
                currentStepData.onNext();
            } catch (e) {
                console.error('Error in onboarding onNext:', e);
            }
        }

        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.renderStep(this.currentStep);
        } else {
            this.completeOnboarding();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep(this.currentStep);
        }
    }

    skipOnboarding() {
        if (confirm('Are you sure you want to skip the setup tour?')) {
            this.completeOnboarding();
        }
    }

    completeOnboarding() {
        console.log('✅ Onboarding completed');
        localStorage.setItem('onboarding_completed', 'true');

        const modal = document.getElementById('onboardingModal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.style.display = 'none';

                // Show a small success notification toast
                if (window.showNotification) { // Assuming global helper exists or created
                    // window.showNotification('Setup complete! Welcome aboard.', 'success');
                }
            }, 300);
        }
    }
}

// Global accessor
window.onboardingManager = new OnboardingManager();
