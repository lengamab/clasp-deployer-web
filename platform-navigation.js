/**
 * Platform Navigation Enhancement
 * Dynamically populate sidebar with enabled automation platforms
 */

(function () {
    'use strict';

    /**
     * Initialize platform navigation
     */
    function initPlatformNavigation() {
        console.log('🎨 Initializing platform navigation...');

        // Wait for platform manager to be ready
        const checkPlatformManager = setInterval(() => {
            if (window.platformManager && window.platformManager.initialized) {
                clearInterval(checkPlatformManager);
                updatePlatformNavigation();
            }
        }, 100);

        // Listen for platform changes
        window.addEventListener('platformsUpdated', updatePlatformNavigation);
    }

    /**
     * Update sidebar navigation with enabled platforms
     */
    function updatePlatformNavigation() {
        const platformNavItems = document.getElementById('platformNavItems');
        if (!platformNavItems) {
            console.warn('Platform nav items container not found');
            return;
        }

        const settings = window.platformManager.getSettings();
        const enabledPlatforms = Object.entries(settings.platforms || {})
            .filter(([id, config]) => config.enabled)
            .map(([id]) => window.platformManager.getPlatformConfig(id));

        if (enabledPlatforms.length === 0) {
            // Show placeholder if no platforms enabled
            platformNavItems.innerHTML = `
                <div class="nav-placeholder" style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                    <i class="fas fa-plug" style="opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>
                    No platforms enabled
                </div>
            `;
            return;
        }

        // Create navigation items for each enabled platform
        platformNavItems.innerHTML = enabledPlatforms.map(platform => `
            <button class="nav-item" 
                    data-page="${platform.id}" 
                    onclick="window.navigationManager?.switchToPlatform('${platform.id}')">
                <i class="${platform.icon}"></i>
                <span>${platform.displayName}</span>
            </button>
        `).join('');

        console.log(`✅ Added ${enabledPlatforms.length} platform(s) to navigation`);
    }

    /**
     * Enhance navigation manager to support platform switching
     */
    function enhanceNavigationManager() {
        // Wait for navigation manager to exist
        const checkNavManager = setInterval(() => {
            if (window.navigationManager) {
                clearInterval(checkNavManager);

                // Map platform IDs to their actual page IDs
                const platformPageMap = {
                    'make': 'make',
                    'zapier': 'zapier',
                    'n8n': 'n8n',
                    'appscript': 'clasp'
                };

                // Add switchToPlatform method
                window.navigationManager.switchToPlatform = function (platformId) {
                    const config = window.platformManager.getPlatformConfig(platformId);
                    if (!config) return;

                    // Get the actual page ID for this platform
                    const pageId = platformPageMap[platformId] || platformId;

                    // Switch to platform view
                    this.switchToPage(pageId);

                    // Update page title
                    const pageTitle = document.getElementById('pageTitle');
                    if (pageTitle) {
                        pageTitle.textContent = config.name;
                    }

                    // Refresh platform data if manager exists
                    if (platformId === 'make' && window.makeManager) {
                        // Only refresh local scenarios when switching to Make platform
                        // The tab system will handle loading available scenarios when that tab is clicked
                        window.makeManager.loadScenarios();
                        // Ensure the local tab is active
                        window.makeManager.switchTab('local');
                    }
                };

                console.log('✅ Navigation manager enhanced with platform support');
            }
        }, 100);
    }

    // Initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initPlatformNavigation();
            enhanceNavigationManager();
        });
    } else {
        initPlatformNavigation();
        enhanceNavigationManager();
    }
})();
