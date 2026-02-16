/**
 * Platform Configuration
 * Central registry for all supported automation platforms
 */

const PLATFORMS = {
    appscript: {
        id: 'appscript',
        name: 'Google Apps Script',
        displayName: 'Apps Script',
        icon: 'fab fa-google',
        color: '#4285f4', // Google Blue
        colorClass: 'neon-blue',
        description: 'Serverless scripting platform for Google Workspace',
        api: {
            // Apps Script authentication is handled via .clasprc.json or custom token
            authType: 'oauth2',
            docsUrl: 'https://developers.google.com/apps-script/api/reference/rest'
        },
        features: {
            create: true,  // Can create new projects
            pull: true,    // Can pull/clone projects
            push: true,    // Can push projects
            delete: false, // Cannot delete remote projects via this tool (yet)
            deploy: true   // Has deployment capabilities
        },
        ui: {
            // Mapping for UI components
            listComponent: 'clasp-projects-list',
            detailComponent: 'clasp-project-detail'
        },
        storage: {
            root: 'scripts', // Local directory for scripts
            configFile: '.clasp.json'
        }
    },
    make: {
        id: 'make',
        name: 'Make.com',
        displayName: 'Make',
        icon: 'fas fa-robot',
        color: '#6366f1', // indigo/blue
        colorClass: 'neon-blue',
        description: 'Visual workflow builder with 2,900+ app integrations',

        // API Configuration
        api: {
            baseUrls: {
                eu1: 'https://eu1.make.com/api/v2',
                us1: 'https://us1.make.com/api/v2',
                ap1: 'https://ap1.make.com/api/v2',
                www: 'https://www.make.com/api/v2'
            },
            defaultRegion: 'eu1',
            authType: 'token', // 'token' | 'oauth' | 'apikey'
            endpoints: {
                scenarios: '/scenarios',
                scenario: '/scenarios/:id',
                users: '/users/me',
                teams: '/teams',
                organizations: '/organizations'
            }
        },

        // Feature Support
        features: {
            supportsRead: true,
            supportsPull: true,
            supportsPush: true,
            supportsCreate: true,
            supportsDelete: true,
            supportsWebhooks: true,
            supportsScheduling: true,
            requiresRegion: true
        },

        // UI Settings
        ui: {
            webUrl: 'https://www.make.com/en/scenarios/:id',
            settingsUrl: 'https://www.make.com/en/settings/api',
            docsUrl: 'https://www.make.com/en/api-documentation'
        },

        // Local Storage
        storage: {
            directory: 'make-scenarios',
            metadataFile: 'metadata.json',
            scenarioFile: 'blueprint.json'
        }
    },

    zapier: {
        id: 'zapier',
        name: 'Zapier',
        displayName: 'Zapier',
        icon: 'fas fa-bolt',
        color: '#ff4a00', // orange
        colorClass: 'neon-orange',
        description: 'Market leader with 8,000+ app integrations',

        // API Configuration
        api: {
            baseUrls: {
                v1: 'https://api.zapier.com/v1'
            },
            defaultRegion: 'v1',
            authType: 'apikey',
            endpoints: {
                scenarios: '/zaps', // Zapier calls them "Zaps"
                scenario: '/zaps/:id',
                user: '/profile'
            }
        },

        // Feature Support
        features: {
            supportsRead: true,
            supportsPull: true,
            supportsPush: false, // Zapier API is read-only for most operations
            supportsCreate: false, // Requires OAuth and is complex
            supportsDelete: false,
            supportsWebhooks: true,
            supportsScheduling: true,
            requiresRegion: false
        },

        // UI Settings
        ui: {
            webUrl: 'https://zapier.com/app/editor/:id',
            settingsUrl: 'https://zapier.com/app/settings/api',
            docsUrl: 'https://platform.zapier.com/reference/cli-docs'
        },

        // Local Storage
        storage: {
            directory: 'zapier-zaps',
            metadataFile: 'metadata.json',
            scenarioFile: 'zap.json'
        }
    },

    n8n: {
        id: 'n8n',
        name: 'n8n',
        displayName: 'n8n',
        icon: 'fas fa-network-wired',
        color: '#ea4b71', // pink/red
        colorClass: 'neon-pink',
        description: 'Open-source automation with self-hosting and AI support',

        // API Configuration
        api: {
            baseUrls: {
                custom: null // User-provided instance URL
            },
            defaultRegion: 'custom',
            authType: 'apikey',
            endpoints: {
                scenarios: '/workflows', // n8n calls them "workflows"
                scenario: '/workflows/:id',
                executions: '/executions',
                credentials: '/credentials'
            }
        },

        // Feature Support
        features: {
            supportsRead: true,
            supportsPull: true,
            supportsPush: true,
            supportsCreate: true,
            supportsDelete: true,
            supportsWebhooks: true,
            supportsScheduling: true,
            requiresRegion: false,
            requiresInstanceUrl: true // Unique to n8n
        },

        // UI Settings
        ui: {
            webUrl: null, // Dynamic based on instance URL
            settingsUrl: null, // Dynamic: {instanceUrl}/settings/api
            docsUrl: 'https://docs.n8n.io/api/'
        },

        // Local Storage
        storage: {
            directory: 'n8n-workflows',
            metadataFile: 'metadata.json',
            scenarioFile: 'workflow.json'
        }
    }
};

/**
 * Get platform configuration by ID
 * @param {string} platformId - Platform identifier (make, zapier, n8n)
 * @returns {object|null} Platform configuration or null if not found
 */
function getPlatformConfig(platformId) {
    return PLATFORMS[platformId] || null;
}

/**
 * Get all available platforms
 * @returns {array} Array of platform configurations
 */
function getAllPlatforms() {
    return Object.values(PLATFORMS);
}

/**
 * Get enabled platforms from user settings
 * @returns {array} Array of enabled platform IDs
 */
function getEnabledPlatforms() {
    const settings = JSON.parse(localStorage.getItem('platformSettings') || '{}');
    return Object.keys(settings.platforms || {}).filter(id => settings.platforms[id]?.enabled);
}

/**
 * Check if a platform is enabled
 * @param {string} platformId - Platform identifier
 * @returns {boolean} True if platform is enabled
 */
function isPlatformEnabled(platformId) {
    const settings = JSON.parse(localStorage.getItem('platformSettings') || '{}');
    return settings.platforms?.[platformId]?.enabled || false;
}

/**
 * Get platform API credentials
 * @param {string} platformId - Platform identifier
 * @returns {object|null} API credentials or null
 */
function getPlatformCredentials(platformId) {
    const settings = JSON.parse(localStorage.getItem('platformSettings') || '{}');
    return settings.platforms?.[platformId]?.credentials || null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PLATFORMS,
        getPlatformConfig,
        getAllPlatforms,
        getEnabledPlatforms,
        isPlatformEnabled,
        getPlatformCredentials
    };
}
