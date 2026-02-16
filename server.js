#!/usr/bin/env node

/**
 * CLASP Deployer Web Server
 * Simple web server to serve the deployment interface
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const axios = require('axios');

const {
    initDatabase,
    findUserByUsername,
    findUserById,
    getUserProjects,
    saveUserCredential,
    getUserCredentials,
    getUserCredential
} = require('./database');
const authRoutes = require('./auth-routes');
const { authenticateToken } = require('./auth-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Database on Startup
initDatabase();

// Store active deployment processes
const activeDeployments = new Map();

// Global Workspace Path (can be updated via API)
let GLOBAL_WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/Users/bricelengama/Documents/Marketing Opti/Cursor';

// Middleware
app.use(express.json());

// Security Headers (careful: no strict CSP to avoid breaking inline scripts)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // HSTS only in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Auth Routes (Public)
app.use('/api/auth', authRoutes);

// Make.com API helper function (needed before routes)
const GEMINI_API_KEY = "AIzaSyDiXu20Ve5mlfqwJwYkXJFNa4VVieyi9S4";

function getMakeApiToken(req) {
    // Check request headers first (priority 1)
    if (req && req.headers) {
        // Support custom header
        if (req.headers['x-make-token']) {
            console.log('📋 Using API token from X-Make-Token header');
            return req.headers['x-make-token'];
        }
    }

    // Check database for authenticated user (priority 2)
    if (req && req.user && req.user.id) {
        const dbToken = getUserCredential(req.user.id, 'make', 'apiToken');
        if (dbToken) {
            console.log(`📋 Using API token from database for user ${req.user.username}`);
            return dbToken;
        }
    }

    // Check environment variable (priority 3)
    if (process.env.MAKE_API_TOKEN) {
        console.log('📋 Using API token from environment variable');
        return process.env.MAKE_API_TOKEN;
    }

    // Check for config file in clasp-deployer-web (priority 4)
    const configPath = path.join(__dirname, '.make-config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.apiToken) {
                console.log('📋 Using API token from .make-config.json');
                return config.apiToken;
            }
        } catch (error) {
            console.log('Error reading Make.com config:', error.message);
        }
    }

    // Try make-scenarios/.makeconfig.json as fallback (priority 5)
    const altConfigPath = path.join(GLOBAL_WORKSPACE_PATH, 'make-scenarios', '.makeconfig.json');
    if (fs.existsSync(altConfigPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(altConfigPath, 'utf8'));
            if (config.apiKey) {
                console.log('📋 Using API key from make-scenarios/.makeconfig.json');
                return config.apiKey;
            }
            if (config.apiToken) {
                console.log('📋 Using API token from make-scenarios/.makeconfig.json');
                return config.apiToken;
            }
        } catch (error) {
            console.log('Error reading make-scenarios config:', error.message);
        }
    }

    return null;
}
// Make.com API routes - defined BEFORE static middleware to ensure they're registered
app.get('/api/make/scenarios/available', authenticateToken, async (req, res) => {
    try {
        console.log('📡 [MAKE API] Fetching available scenarios from Make.com API...');

        const apiToken = getMakeApiToken(req);
        if (!apiToken) {
            return res.status(401).json({
                success: false,
                error: 'Make.com API token not configured. Please set MAKE_API_TOKEN environment variable or create .make-config.json file with your API token.',
                requiresAuth: true
            });
        }

        // Try to get organizationId/teamId from API first, then fallback to local/default
        let defaultOrganizationId = null; // Don't use hardcoded value, get from API
        let defaultTeamId = null;
        let detectedRegion = 'eu1'; // Default region

        // First, try to get user's teams and organizations from API
        console.log('🔍 [MAKE API] Discovering accessible teams and organizations...');
        try {
            for (const region of ['eu1', 'us1', 'ap1', 'www']) {
                try {
                    const userResponse = await axios.get(`https://${region}.make.com/api/v2/users/me`, {
                        headers: {
                            'Authorization': `Token ${apiToken}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000,
                        validateStatus: () => true
                    });

                    if (userResponse.status === 200 && userResponse.data && userResponse.data.authUser) {
                        console.log(`✅ [MAKE API] Got user info from ${region}`);
                        console.log(`   User: ${userResponse.data.authUser.email}`);
                        detectedRegion = region;

                        // Try to get teams first (more reliable than organizations for scenarios API)
                        try {
                            const teamsResponse = await axios.get(`https://${region}.make.com/api/v2/teams`, {
                                headers: {
                                    'Authorization': `Token ${apiToken}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000,
                                validateStatus: () => true
                            });

                            console.log(`   Teams API response: ${teamsResponse.status}`);
                            if (teamsResponse.status === 200 && teamsResponse.data) {
                                console.log(`   Teams data:`, JSON.stringify(teamsResponse.data).substring(0, 500));

                                if (teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
                                    const teams = teamsResponse.data.teams;
                                    defaultTeamId = teams[0].id;
                                    console.log(`📋 [MAKE API] Found ${teams.length} team(s), using first: ${defaultTeamId}`);
                                    teams.forEach((team, idx) => {
                                        console.log(`   Team ${idx + 1}: ID=${team.id}, Name=${team.name || 'N/A'}`);
                                    });
                                }
                            }
                        } catch (teamError) {
                            console.log(`   ⚠️ Could not get teams: ${teamError.message}`);
                        }

                        // Try organizations
                        try {
                            const orgsResponse = await axios.get(`https://${region}.make.com/api/v2/organizations`, {
                                headers: {
                                    'Authorization': `Token ${apiToken}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000,
                                validateStatus: () => true
                            });

                            console.log(`   Organizations API response: ${orgsResponse.status}`);
                            if (orgsResponse.status === 200 && orgsResponse.data) {
                                console.log(`   Organizations data:`, JSON.stringify(orgsResponse.data).substring(0, 500));

                                if (orgsResponse.data.organizations && orgsResponse.data.organizations.length > 0) {
                                    const orgs = orgsResponse.data.organizations;
                                    defaultOrganizationId = orgs[0].id;

                                    // CRITICAL: Get the correct zone/domain for the organization
                                    if (orgs[0].zone) {
                                        detectedRegion = orgs[0].zone;
                                        console.log(`📋 [MAKE API] Found ${orgs.length} organization(s), using first: ${defaultOrganizationId}`);
                                        console.log(`🌍 [MAKE API] Organization zone: ${detectedRegion}`);
                                    } else {
                                        console.log(`📋 [MAKE API] Found ${orgs.length} organization(s), using first: ${defaultOrganizationId}`);
                                    }

                                    orgs.forEach((org, idx) => {
                                        console.log(`   Org ${idx + 1}: ID=${org.id}, Name=${org.name || 'N/A'}, Zone=${org.zone || 'N/A'}`);
                                    });
                                }
                            }
                        } catch (orgError) {
                            console.log(`   ⚠️ Could not get organizations: ${orgError.message}`);
                        }

                        break; // Got user info, exit region loop
                    }
                } catch (e) {
                    continue; // Try next region
                }
            }
        } catch (e) {
            console.log(`⚠️ [MAKE API] Could not get teams/organizations from API: ${e.message}`);
        }

        // Fallback: try to get from local scenario metadata
        const makeScenariosDir = path.join(GLOBAL_WORKSPACE_PATH, 'make-scenarios', 'scenarios');
        if (fs.existsSync(makeScenariosDir) && !defaultTeamId) {
            try {
                const scenarioDirs = fs.readdirSync(makeScenariosDir);
                for (const dir of scenarioDirs) {
                    const metadataPath = path.join(makeScenariosDir, dir, 'metadata.json');
                    if (fs.existsSync(metadataPath)) {
                        try {
                            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                            if (metadata.teamId) {
                                defaultTeamId = metadata.teamId;
                                console.log(`📋 [MAKE API] Found teamId from local scenario: ${defaultTeamId}`);
                                break;
                            }
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        console.log(`📋 [MAKE API] Discovery complete:`);
        console.log(`   - Region: ${detectedRegion}`);
        console.log(`   - OrganizationId: ${defaultOrganizationId || 'None found'}`);
        console.log(`   - TeamId: ${defaultTeamId || 'None found'}`);

        // Get list of locally pulled scenarios
        const localScenarioIds = new Set();
        if (fs.existsSync(makeScenariosDir)) {
            try {
                const localDirs = fs.readdirSync(makeScenariosDir);
                localDirs.forEach(dir => {
                    const dirPath = path.join(makeScenariosDir, dir);
                    if (fs.statSync(dirPath).isDirectory()) {
                        localScenarioIds.add(dir);
                    }
                });
            } catch (error) {
                console.log('Error reading local scenarios:', error);
            }
        }

        // Fetch scenarios from Make.com API
        // Use the detected zone/region from the organization
        let allAvailableScenarios = [];
        const baseUrl = detectedRegion.includes('.') ? `https://${detectedRegion}` : `https://${detectedRegion}.make.com`;
        console.log(`🌍 [MAKE API] Using base URL: ${baseUrl}`);

        let apiResponse = null;
        let lastError = null;

        // Try the detected region first, then fallback to alternatives
        const regionsToTry = [detectedRegion];
        if (!regionsToTry.includes('eu1')) regionsToTry.push('eu1');
        if (!regionsToTry.includes('us1')) regionsToTry.push('us1');

        for (const region of regionsToTry) {
            try {
                // Construct base URL based on whether region is a full zone or just a region code
                const regionBase = region.includes('.') ? `https://${region}` : `https://${region}.make.com`;

                // Make.com API uses different base URLs - try both formats
                const apiUrls = [
                    `${regionBase}/api/v2/scenarios`,
                    `${regionBase}/api/scenarios`
                ];

                let regionSuccess = false;
                for (const apiUrl of apiUrls) {
                    try {
                        console.log(`🌐 [MAKE API] Trying endpoint: ${apiUrl}`);

                        // Try multiple parameter combinations
                        const paramCombinations = [];

                        // If we have teamId from API, try it first
                        if (defaultTeamId) {
                            paramCombinations.push({ teamId: defaultTeamId, label: `teamId: ${defaultTeamId}` });
                        }

                        // If we have organizationId from API, try it
                        if (defaultOrganizationId) {
                            paramCombinations.push({ organizationId: defaultOrganizationId, label: `organizationId: ${defaultOrganizationId}` });
                        }

                        // Try without any parameter (some tokens work this way)
                        paramCombinations.push({ limit: 100, label: 'no teamId/organizationId' });

                        let successfulResponse = null;

                        for (const params of paramCombinations) {
                            const requestParams = { limit: 100, ...params };
                            delete requestParams.label; // Remove label from actual request

                            console.log(`   🔑 Trying with: ${params.label}`);

                            try {

                                const response = await axios.get(apiUrl, {
                                    headers: {
                                        'Authorization': `Token ${apiToken}`,
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    },
                                    params: requestParams,
                                    timeout: 15000,
                                    validateStatus: function (status) {
                                        return status < 500;
                                    }
                                });

                                // Check if we got a successful response
                                if (response.status === 200 && response.data) {
                                    // Check if response has scenarios
                                    if (response.data.scenarios || (Array.isArray(response.data) && response.data.length >= 0)) {
                                        console.log(`   ✅ SUCCESS with ${params.label}!`);
                                        successfulResponse = response;
                                        break; // Success, exit param combinations loop
                                    } else {
                                        console.log(`   ⚠️ 200 OK but unexpected format:`, Object.keys(response.data || {}));
                                    }
                                } else if (response.status === 403 || response.status === 401) {
                                    console.log(`   ❌ ${response.status}: ${JSON.stringify(response.data).substring(0, 100)}`);
                                } else if (response.status === 400) {
                                    console.log(`   ❌ 400 Bad Request: ${JSON.stringify(response.data).substring(0, 100)}`);
                                } else {
                                    console.log(`   ❌ ${response.status}: ${JSON.stringify(response.data).substring(0, 100)}`);
                                }
                            } catch (paramError) {
                                console.log(`   ❌ Error: ${paramError.message}`);
                            }
                        }

                        if (successfulResponse) {
                            apiResponse = successfulResponse;
                            console.log(`✅ [MAKE API] Successfully connected to ${apiUrl}`);
                            regionSuccess = true;
                            break; // Success, exit URL formats loop
                        }
                    } catch (urlError) {
                        console.log(`   ⚠️ Error with ${apiUrl}: ${urlError.message}`);
                        continue; // Try next URL format
                    }
                }

                if (regionSuccess) {
                    break; // Success, exit outer loop
                }
            } catch (error) {
                lastError = error;
                const status = error.response?.status;
                const statusText = error.response?.statusText;
                const errorData = error.response?.data;
                console.log(`❌ [MAKE API] Failed to connect to ${region}.make.com:`);
                console.log(`   Status: ${status} ${statusText}`);
                console.log(`   Error: ${errorData ? JSON.stringify(errorData).substring(0, 200) : error.message}`);
                // Continue to next region
            }
        }

        if (!apiResponse) {
            // If all regions failed, try the generic www.make.com endpoint
            try {
                console.log('🌐 [MAKE API] Trying generic www.make.com endpoint...');
                apiResponse = await axios.get('https://www.make.com/api/v2/scenarios', {
                    headers: {
                        'Authorization': `Token ${apiToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    params: {
                        limit: 100
                    },
                    timeout: 15000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });

                if (apiResponse.status === 404) {
                    throw new Error('Endpoint not found: www.make.com/api/v2/scenarios (404)');
                }
                if (apiResponse.status !== 200) {
                    throw new Error(`API returned status ${apiResponse.status}: ${JSON.stringify(apiResponse.data)}`);
                }
                console.log('✅ [MAKE API] Successfully connected to www.make.com');
            } catch (error) {
                lastError = error;
                console.error('❌ [MAKE API] All Make.com API endpoints failed');
            }
        }

        if (apiResponse) {
            try {
                // Handle different response formats
                let scenariosArray = null;

                if (apiResponse.data && apiResponse.data.scenarios) {
                    scenariosArray = apiResponse.data.scenarios;
                } else if (Array.isArray(apiResponse.data)) {
                    scenariosArray = apiResponse.data;
                } else if (apiResponse.data && apiResponse.data.data && Array.isArray(apiResponse.data.data)) {
                    scenariosArray = apiResponse.data.data;
                }

                if (scenariosArray && scenariosArray.length > 0) {
                    allAvailableScenarios = scenariosArray.map(scenario => {
                        // Count operations from flow if available
                        let operations = 0;
                        let connections = new Set();

                        if (scenario.flow && Array.isArray(scenario.flow)) {
                            operations = scenario.flow.length;
                            scenario.flow.forEach(module => {
                                if (module.module) {
                                    const moduleType = module.module.split(':')[0];
                                    if (moduleType) connections.add(moduleType);
                                }
                            });
                        }

                        return {
                            id: scenario.id,
                            name: scenario.name || `Scenario ${scenario.id}`,
                            description: scenario.description || null,
                            scheduling: scenario.scheduling || { active: false },
                            lastRun: scenario.lastRun || null,
                            folderId: scenario.folderId || null,
                            folderName: scenario.folderName || 'Root',
                            operations: operations,
                            connections: connections.size
                        };
                    });

                    console.log(`✅ [MAKE API] Successfully fetched ${allAvailableScenarios.length} scenarios from Make.com API`);
                } else if (scenariosArray && scenariosArray.length === 0) {
                    console.log('⚠️ [MAKE API] API returned empty scenarios array - you may not have any scenarios or the token lacks permissions');
                } else {
                    console.log('⚠️ [MAKE API] Unexpected response format. Response keys:', Object.keys(apiResponse.data || {}));
                    console.log('⚠️ [MAKE API] Response sample:', JSON.stringify(apiResponse.data).substring(0, 500));
                }
            } catch (parseError) {
                console.error('❌ [MAKE API] Error parsing response:', parseError.message);
                lastError = parseError;
            }
        } else {
            // All API attempts failed
            console.error('❌ [MAKE API] Error:', lastError?.response?.status, lastError?.response?.statusText);
            console.error('Error details:', lastError?.response?.data || lastError?.message);

            return res.status(lastError?.response?.status || 500).json({
                success: false,
                error: lastError?.response?.data?.message || lastError?.message || 'Failed to fetch scenarios from Make.com API. Please check your API token and region.',
                apiError: lastError?.response?.data || { message: lastError?.message },
                hint: 'Make.com uses region-specific endpoints (eu1, us1, ap1). Please verify your account region.'
            });
        }

        // Mark which scenarios are already pulled locally
        const scenariosWithStatus = allAvailableScenarios.map(scenario => {
            const isLocal = localScenarioIds.has(scenario.id.toString());
            return {
                ...scenario,
                isLocal,
                localPath: isLocal ? path.join(makeScenariosDir, scenario.id.toString()) : null
            };
        });

        res.json({
            success: true,
            scenarios: scenariosWithStatus
        });
    } catch (error) {
        console.error('❌ [MAKE API] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch available scenarios from Make.com',
            details: error.message
        });
    }
});

// ============================================================
// AI CONVERTER API
// ============================================================

app.post('/api/ai/convert', authenticateToken, async (req, res) => {
    try {
        const { blueprint, platform } = req.body;

        if (!blueprint) {
            return res.status(400).json({ success: false, error: 'Blueprint data is required' });
        }

        console.log(`🧠 [AI] Converting ${platform} blueprint to AppScript...`);

        // Construct Expert Prompt - Focused on Practical Implementation
        const prompt = `
You are an Expert Google Apps Script Developer. Convert the following ${platform} blueprint into a working Google Apps Script.

**YOUR TASK:**
1. Analyze the blueprint and produce a complete, deployable Google Apps Script.
2. Provide a SHORT setup guide (max 200 words) with only the essential steps.
3. Estimate monthly savings vs ${platform} pricing.

**INSTRUCTIONS GUIDELINES (Keep it SHORT and ACTIONABLE):**
- Start with "## Setup Guide" header
- List only the essential steps to deploy (e.g., "1. Create a new Apps Script project", "2. Paste the code", etc.)
- If external libraries are needed (e.g., jsPDF), provide the exact Script ID to add
- If API access is needed (BigQuery, Gmail, etc.), mention which APIs to enable in ONE bullet point
- Only mention limitations/workarounds if they are CRITICAL blockers
- Do NOT include module-by-module breakdowns or verbose explanations
- Do NOT include financial calculation details - just the final savings estimate
- Maximum 5-8 bullet points total

**SCRIPT CODE GUIDELINES:**
- Provide complete, ready-to-run code
- Include clear comments for configuration sections
- If the blueprint has large data (20+ items), use a CONFIG object at the top instead of inline data
- Add a main() function as the entry point

**SAVINGS CALCULATION:**
- Count total operations in the blueprint (modules + iterations)
- Use ${platform === 'make' ? 'Make.com Core Plan ($10.59/10,000 ops)' : 'n8n pricing'} as baseline
- Include estimated runs/month in the calculation
- Format: "$XX/month" (simple, no breakdown needed)

**RESPONSE FORMAT (STRICT JSON):**
{
    "estimatedSavings": "$XX/month",
    "instructions": "## Setup Guide\\n\\n1. Step one\\n2. Step two...",
    "scriptCode": "// Complete Apps Script code here"
}

**BLUEPRINT:**
${typeof blueprint === 'object' ? JSON.stringify(blueprint) : blueprint}
`;

        // Call Gemini API with higher token limit for large conversions
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0, // Absolute precision
                    maxOutputTokens: 8192 // Ensure complex scripts aren't truncated
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            }
        );

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            let contentText = response.data.candidates[0].content.parts[0].text;

            // ROBUST PARSING with direct-first approach
            const robustJsonParse = (text) => {
                let cleaned = text.trim();

                // 0. TRY DIRECT PARSE FIRST (Gemini returns valid JSON most of the time)
                try {
                    const directResult = JSON.parse(cleaned);
                    console.log("✅ [AI] Direct JSON parse succeeded");
                    return directResult;
                } catch (directError) {
                    console.log("⚠️ [AI] Direct parse failed, trying repair...", directError.message);
                }

                // 1. Remove Markdown code blocks
                if (cleaned.includes('```')) {
                    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (match) {
                        cleaned = match[1].trim();
                        // Try parsing after removing code blocks
                        try {
                            return JSON.parse(cleaned);
                        } catch (e) {
                            console.log("⚠️ [AI] Parse after code block removal failed");
                        }
                    }
                }

                // 2. Greedy extraction - find the JSON object
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
                    // Try parsing after extraction
                    try {
                        return JSON.parse(cleaned);
                    } catch (e) {
                        console.log("⚠️ [AI] Parse after extraction failed");
                    }
                }

                // 3. String Repair (Handle unescaped control characters + backslashes)
                let repaired = "";
                let inString = false;
                let escapeNext = false;
                for (let i = 0; i < cleaned.length; i++) {
                    const char = cleaned[i];
                    if (char === '"' && !escapeNext) {
                        inString = !inString;
                        repaired += char;
                        escapeNext = false;
                    } else if (inString) {
                        if (char === '\n') {
                            repaired += "\\n";
                        } else if (char === '\r') {
                            repaired += "\\r";
                        } else if (char === '\t') {
                            repaired += "\\t";
                        } else if (char === '\\') {
                            const nextChar = cleaned[i + 1];
                            const isValidEscape = nextChar && '"\\/bfnrtu'.includes(nextChar);
                            if (isValidEscape) {
                                repaired += char;
                                escapeNext = true;
                            } else {
                                // Escape lone backslashes
                                repaired += "\\\\";
                                escapeNext = false;
                            }
                        } else {
                            repaired += char;
                            escapeNext = false;
                        }
                    } else {
                        repaired += char;
                        escapeNext = false;
                    }
                }

                // 4. TRUNCATION REPAIR (State-aware structural closure)
                if (inString) repaired += '..."';

                let braces = [];
                let repairInString = false;
                let repairEscape = false;

                // Track actual structure outside of strings
                for (let i = 0; i < repaired.length; i++) {
                    const char = repaired[i];
                    if (char === '"' && !repairEscape) repairInString = !repairInString;
                    else if (!repairInString) {
                        if (char === '{') braces.push('}');
                        else if (char === '[') braces.push(']');
                        else if (char === '}' || char === ']') {
                            if (braces.length > 0 && braces[braces.length - 1] === char) braces.pop();
                        }
                    }
                    repairEscape = (char === '\\' && !repairEscape);
                }

                // Close everything in reverse order
                while (braces.length > 0) {
                    repaired += braces.pop();
                }

                // 5. Try parse the repaired version
                try {
                    return JSON.parse(repaired);
                } catch (e) {
                    console.error("❌ [AI] JSON Parse Fail after repair:", e.message);
                    // Last ditch attempt: Strip all actual newlines globally
                    try {
                        const superCleaned = repaired.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
                        return JSON.parse(superCleaned);
                    } catch (e2) {
                        console.error("❌ [AI] Final parse attempt failed:", e2.message);
                        throw new Error("Could not parse AI response even after full repair.");
                    }
                }
            };

            let aiResult;
            try {
                aiResult = robustJsonParse(contentText);
                
                // Log what we got
                console.log("✅ [AI] Parsed result keys:", Object.keys(aiResult));
                console.log("✅ [AI] scriptCode length:", aiResult.scriptCode ? aiResult.scriptCode.length : 'undefined');
                console.log("✅ [AI] scriptCode preview:", aiResult.scriptCode ? aiResult.scriptCode.substring(0, 100) : 'undefined');
                
                // Validate that we have the expected fields
                if (!aiResult.scriptCode && !aiResult.code && !aiResult.script) {
                    console.warn("⚠️ [AI] Response missing scriptCode field");
                    console.warn("⚠️ [AI] Available fields:", Object.keys(aiResult));
                } else {
                    // Normalize field name to scriptCode
                    if (aiResult.code && !aiResult.scriptCode) {
                        aiResult.scriptCode = aiResult.code;
                    } else if (aiResult.script && !aiResult.scriptCode) {
                        aiResult.scriptCode = aiResult.script;
                    }
                }
            } catch (error) {
                console.error("❌ AI Parsing Failed:", error.message);
                console.error("❌ Content length:", contentText.length, "chars");
                console.error("❌ First 500 chars:", contentText.substring(0, 500));
                
                // Try one more time - maybe it's double-encoded JSON
                try {
                    // Sometimes the API returns JSON as a string
                    if (contentText.startsWith('"') && contentText.endsWith('"')) {
                        const unescaped = JSON.parse(contentText);
                        if (typeof unescaped === 'string') {
                            aiResult = JSON.parse(unescaped);
                            console.log("✅ [AI] Recovered via double-decode");
                        }
                    }
                } catch (e) {
                    // Fall through to error handling
                }
                
                if (!aiResult) {
                    aiResult = {
                        scriptCode: "// FATAL: Could not parse AI response.\n// Error: " + error.message + "\n// Raw Response follows:\n\n" + contentText,
                        estimatedSavings: "Parsing Error",
                        instructions: "## Parsing Error\n\nThe AI returned a response that couldn't be automatically parsed into JSON.\n\n**Error:** " + error.message + "\n\nThe raw response is displayed in the Generated Script tab. You may be able to manually extract the code from it."
                    };
                }
            }

            // Ensure scriptCode is present (normalize field names)
            const jsonResponse = {
                success: true,
                scriptCode: aiResult.scriptCode || aiResult.code || aiResult.script || '',
                estimatedSavings: aiResult.estimatedSavings || aiResult.savings || '$0/month',
                instructions: aiResult.instructions || aiResult.guide || ''
            };
            
            console.log("📤 [AI] Sending response - scriptCode length:", jsonResponse.scriptCode.length);
            console.log("📤 [AI] Sending response - scriptCode preview:", jsonResponse.scriptCode.substring(0, 100));
            
            res.json(jsonResponse);
        } else {
            throw new Error('No candidates returned from Gemini API');
        }

    } catch (error) {
        console.error('❌ [AI API] Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to convert blueprint. ' + (error.response?.data?.error?.message || error.message)
        });
    }
});


// ============================================================
// SETTINGS API
// ============================================================

app.post('/api/settings/workspace', authenticateToken, (req, res) => {
    const { workspacePath } = req.body;
    if (!workspacePath) {
        return res.status(400).json({ success: false, error: 'workspacePath is required' });
    }

    console.log(`📂 [Settings] Updating global workspace path to: ${workspacePath}`);
    GLOBAL_WORKSPACE_PATH = workspacePath;

    res.json({ success: true, workspacePath: GLOBAL_WORKSPACE_PATH });
});

/**
 * Open native folder picker (macOS only)
 */
app.post('/api/utils/browse-folder', authenticateToken, (req, res) => {
    const { exec } = require('child_process');

    // AppleScript command to Choose Folder
    const prompt = req.body.prompt || 'Select Workspace Directory';
    const script = `osascript -e 'POSIX path of (choose folder with prompt "${prompt}")'`;

    console.log('🖥️ [Utils] Opening native folder picker...');

    exec(script, (error, stdout, stderr) => {
        if (error) {
            // User likely cancelled
            console.log('📂 [Utils] Folder picker cancelled or failed');
            return res.json({ success: false, error: 'User cancelled or operation failed' });
        }

        const selectedPath = stdout.trim();
        console.log(`📂 [Utils] Folder selected: ${selectedPath}`);
        res.json({ success: true, path: selectedPath });
    });
});


// Load platform adapters for server-side use
const AutomationPlatform = require('./automation-platform.js');
const MakeAdapter = require('./adapters/make-adapter.js');
const ZapierAdapter = require('./adapters/zapier-adapter.js');
const N8nAdapter = require('./adapters/n8n-adapter.js');
const AppScriptAdapter = require('./adapters/appscript-adapter.js');
const { PLATFORMS, getPlatformConfig } = require('./platform-config.js');

/**
 * Helper function to create platform adapter instance
 */
function createPlatformAdapter(platformId, credentials) {
    const config = getPlatformConfig(platformId);
    if (!config) {
        throw new Error(`Unknown platform: ${platformId}`);
    }

    switch (platformId) {
        case 'appscript':
            return new AppScriptAdapter(config, credentials);
        case 'make':
            return new MakeAdapter(config, credentials);
        case 'zapier':
            return new ZapierAdapter(config, credentials);
        case 'n8n':
            return new N8nAdapter(config, credentials);
        default:
            throw new Error(`No adapter for platform: ${platformId}`);
    }
}

/**
 * Get all available platforms
 */
app.get('/api/platforms', (req, res) => {
    res.json({
        success: true,
        platforms: Object.values(PLATFORMS).map(p => ({
            id: p.id,
            name: p.name,
            displayName: p.displayName,
            icon: p.icon,
            color: p.color,
            description: p.description,
            features: p.features,
            ui: p.ui
        }))
    });
});

/**
 * Test platform connection
 */
app.post('/api/platforms/:platform/test', async (req, res) => {
    try {
        const { platform } = req.params;
        const { credentials } = req.body;

        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials required'
            });
        }

        const adapter = createPlatformAdapter(platform, credentials);
        const result = await adapter.testConnection();

        res.json({
            success: result.success,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Test connection error:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get scenarios from a specific platform
 */
app.post('/api/platforms/:platform/scenarios', async (req, res) => {
    try {
        const { platform } = req.params;
        const { credentials } = req.body;

        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials required'
            });
        }

        console.log(`📡 [Platform API] Fetching scenarios from ${platform}...`);

        const adapter = createPlatformAdapter(platform, credentials);
        const scenarios = await adapter.getScenarios();

        res.json({
            success: true,
            platform,
            scenarios
        });
    } catch (error) {
        console.error(`[Platform API] Error fetching scenarios:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get specific scenario details
 */
app.post('/api/platforms/:platform/scenarios/:id', async (req, res) => {
    try {
        const { platform, id } = req.params;
        const { credentials } = req.body;

        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials required'
            });
        }

        const adapter = createPlatformAdapter(platform, credentials);
        const scenario = await adapter.getScenarioDetails(id);

        res.json({
            success: true,
            scenario
        });
    } catch (error) {
        console.error(`[Platform API] Error fetching scenario:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Pull scenario from platform to local
 */
app.post('/api/platforms/:platform/scenarios/:id/pull', async (req, res) => {
    try {
        const { platform, id } = req.params;
        const { credentials } = req.body;

        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials required'
            });
        }

        console.log(`⬇️ [Platform API] Pulling scenario ${id} from ${platform}...`);

        const adapter = createPlatformAdapter(platform, credentials);
        const localPath = path.join(GLOBAL_WORKSPACE_PATH, adapter.config.storage.directory);

        const result = await adapter.pullScenario(id, localPath);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Error pulling scenario:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Push scenario from local to platform
 */
app.post('/api/platforms/:platform/scenarios/:id/push', authenticateToken, async (req, res) => {
    try {
        const { platform, id } = req.params;
        const { credentials } = req.body;

        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials required'
            });
        }

        console.log(`⬆️ [Platform API] Pushing scenario ${id} to ${platform}...`);

        const adapter = createPlatformAdapter(platform, credentials);
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const localPath = path.join(workspacePath, adapter.config.storage.directory);

        const result = await adapter.pushScenario(id, localPath);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Error pushing scenario:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create new scenario on platform
 */
app.post('/api/platforms/:platform/scenarios/create', authenticateToken, async (req, res) => {
    try {
        const { platform } = req.params;
        const { credentials, name, options } = req.body;

        if (!credentials || !name) {
            return res.status(400).json({
                success: false,
                error: 'Credentials and name required'
            });
        }

        console.log(`➕ [Platform API] Creating scenario on ${platform}: ${name}`);

        const adapter = createPlatformAdapter(platform, credentials);
        const scenario = await adapter.createScenario(name, options || {});

        res.json({
            success: true,
            scenario
        });
    } catch (error) {
        console.error(`[Platform API] Error creating scenario:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Run scenario/function on platform
 */
app.post('/api/platforms/:platform/scenarios/:id/run', authenticateToken, async (req, res) => {
    try {
        const { platform, id } = req.params;
        const { credentials, functionName, options } = req.body;

        console.log(`🏃 [Platform API] Running scenario ${id} on ${platform}...`);

        const adapter = createPlatformAdapter(platform, credentials || {});

        // This is generic, but currently only AppScriptAdapter has runFunction
        if (typeof adapter.runFunction !== 'function') {
            return res.status(400).json({
                success: false,
                error: `Platform ${platform} does not support direct execution via this API`
            });
        }

        const result = await adapter.runFunction(id, functionName || 'main', options || {});

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Error running scenario:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get scenario logs from platform
 */
app.get('/api/platforms/:platform/scenarios/:id/logs', authenticateToken, async (req, res) => {
    try {
        const { platform, id } = req.params;
        // Credentials might be passed as query param or we assume they are in .clasprc.json for AppScript
        // For simplicity and to match other GETs, let's try to get credentials if available

        console.log(`📋 [Platform API] Fetching logs for scenario ${id} on ${platform}...`);

        const adapter = createPlatformAdapter(platform, {}); // Pass empty creds, adapter will find local ones

        if (typeof adapter.getLogs !== 'function') {
            return res.status(400).json({
                success: false,
                error: `Platform ${platform} does not support fetching logs via this API`
            });
        }

        const result = await adapter.getLogs(id);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Error fetching logs:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get available functions from platform scenario
 */
app.get('/api/platforms/:platform/scenarios/:id/functions', authenticateToken, async (req, res) => {
    try {
        const { platform, id } = req.params;

        console.log(`🔍 [Platform API] Fetching functions for scenario ${id} on ${platform}...`);

        const adapter = createPlatformAdapter(platform, {});

        if (typeof adapter.getFunctions !== 'function') {
            return res.status(400).json({
                success: false,
                error: `Platform ${platform} does not support listing functions`
            });
        }

        const result = await adapter.getFunctions(id);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`[Platform API] Error fetching functions:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Routes - Must be BEFORE static middleware to take precedence
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});

app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/ai-converter', (req, res) => {
    res.redirect('/app#ai-converter');
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs.html'));
});

app.get('/help-center', (req, res) => {
    res.sendFile(path.join(__dirname, 'help-center.html'));
});

app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'faq.html'));
});

app.get('/coming-soon', (req, res) => {
    res.sendFile(path.join(__dirname, 'coming-soon.html'));
});

app.get('/blog-launch', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog-launch.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/cookies', (req, res) => {
    res.sendFile(path.join(__dirname, 'cookies.html'));
});

app.get('/test-buttons', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-buttons.html'));
});

app.get('/*.html', (req, res) => {
    const basePath = req.path.replace(/\.html$/, '');

    if (basePath === '/index') {
        return res.redirect(301, '/app');
    }

    if (basePath === '/landing') {
        return res.redirect(301, '/');
    }

    return res.redirect(301, basePath);
});

// Static middleware - serve other static files (css, js, assets)
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.html')) {
            // HTML files: no-cache to ensure fresh content
            res.set('Cache-Control', 'no-cache');
        } else {
            // Static assets: cache for 1 year (use versioning for updates)
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Test endpoint
app.get('/api/test', (req, res) => {
    const workspacePathTest = path.dirname(__dirname);
    const scriptPathTest = path.join(workspacePathTest, 'deploy-clasp.js');

    res.json({
        workspacePath: workspacePathTest,
        scriptPath: scriptPathTest,
        scriptExists: require('fs').existsSync(scriptPathTest),
        cwd: process.cwd(),
        __dirname
    });
});

// Test Make.com API endpoint
app.get('/api/make/test', async (req, res) => {
    const apiToken = getMakeApiToken(req);
    if (!apiToken) {
        return res.json({
            success: false,
            error: 'No API token configured',
            instructions: 'Please set up your Make.com API token in .make-config.json'
        });
    }

    // Test the token by calling /users/me
    try {
        const testResponse = await axios.get('https://eu1.make.com/api/v2/users/me', {
            headers: {
                'Authorization': `Token ${apiToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: () => true
        });

        if (testResponse.status === 200) {
            return res.json({
                success: true,
                message: 'API token is valid',
                tokenPreview: apiToken.substring(0, 8) + '...',
                user: testResponse.data.authUser?.email || 'Unknown',
                note: 'If scenarios still fail to load, your token may lack the "scenarios:read" scope. Generate a new token at https://www.make.com/en/settings/api with full permissions.'
            });
        } else {
            return res.json({
                success: false,
                error: `Token validation failed: ${testResponse.status}`,
                message: testResponse.data,
                instructions: 'Generate a new API token at https://www.make.com/en/settings/api with full permissions'
            });
        }
    } catch (error) {
        return res.json({
            success: false,
            error: 'Failed to test token',
            message: error.message,
            instructions: 'Check your internet connection or generate a new token at https://www.make.com/en/settings/api'
        });
    }
});

/**
 * Save user credentials for a platform
 */
app.post('/api/settings/credentials', authenticateToken, (req, res) => {
    const { platformId, key, value } = req.body;
    const userId = req.user.id;

    if (!platformId || !key || !value) {
        return res.status(400).json({ error: 'Missing platformId, key, or value' });
    }

    try {
        saveUserCredential(userId, platformId, key, value);
        res.json({ success: true, message: `Successfully updated ${platformId} credentials` });
    } catch (error) {
        console.error('Failed to save user credential:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

/**
 * Get user credentials for a platform
 */
app.get('/api/settings/credentials/:platformId', authenticateToken, (req, res) => {
    const { platformId } = req.params;
    const userId = req.user.id;

    try {
        const credentials = getUserCredentials(userId, platformId);
        res.json({ success: true, credentials });
    } catch (error) {
        console.error('Failed to get user credentials:', error);
        res.status(500).json({ error: 'Failed to fetch credentials' });
    }
});

// ============================================================
// USER ACCOUNT & SUBSCRIPTION ENDPOINTS
// ============================================================

/**
 * Get user subscription details
 */
app.get('/api/user/subscription', (req, res) => {
    // In a real app, this would fetch from a database or payment provider (Stripe, etc.)
    // For now, we return mock data based on a simulation

    // Simulate a random delay
    setTimeout(() => {
        res.json({
            tier: 'Pro',
            status: 'active',
            billingCycle: 'monthly',
            amount: 19,
            currency: 'USD',
            renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
            features: [
                'Unlimited Local Projects',
                'Unlimited Make.com Scenarios',
                'Advanced Analytics',
                'Priority Support',
                'Auto-deployment Mode'
            ]
        });
    }, 300);
});

/**
 * Get user usage statistics
 */
app.get('/api/user/usage', (req, res) => {
    // Count actual projects if possible
    let claspProjectCount = 0;
    try {
        const configPath = path.join(process.cwd(), '.clasp-deployer-projects.json');
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            claspProjectCount = data.projects ? data.projects.length : 0;
        }
    } catch (e) { console.error('Error counting projects:', e.message); }

    // Count scenarios (simulated or real if we track them)
    // For now returning mock/hybrid data

    res.json({
        appsScriptProjects: { current: claspProjectCount || 7, limit: null }, // null = unlimited
        makeScenarios: { current: 12, limit: null },
        dailyDeployments: { current: 8, limit: 100 }
    });
});

// ============================================================
// IDE SETTINGS ENDPOINTS
// ============================================================

const ideConfig = require('./ide-config');

// Path to store IDE preference
const IDE_SETTINGS_PATH = path.join(require('os').homedir(), '.scriptflow-ide-config.json');

/**
 * Get current IDE preference
 */
function getIDEPreference() {
    try {
        if (fs.existsSync(IDE_SETTINGS_PATH)) {
            const settings = JSON.parse(fs.readFileSync(IDE_SETTINGS_PATH, 'utf8'));
            return settings.preferredIDE || null;
        }
    } catch (error) {
        console.log('Error reading IDE preference:', error.message);
    }
    return null;
}

/**
 * Save IDE preference
 */
function saveIDEPreference(ideId) {
    try {
        const settings = { preferredIDE: ideId, updatedAt: new Date().toISOString() };
        fs.writeFileSync(IDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.log('Error saving IDE preference:', error.message);
        return false;
    }
}

/**
 * Get the IDE to use (preference or auto-detect)
 */
function getActiveIDE() {
    const pref = getIDEPreference();
    if (pref && ideConfig.isIDEInstalled(pref)) {
        return pref;
    }
    // Auto-detect if no preference or preference not installed
    return ideConfig.autoDetectIDE();
}

// GET current IDE setting
app.get('/api/settings/ide', (req, res) => {
    try {
        const preferredIDE = getIDEPreference();
        const activeIDE = getActiveIDE();

        res.json({
            success: true,
            preferredIDE: preferredIDE,
            activeIDE: activeIDE,
            activeIDEConfig: activeIDE ? ideConfig.getIDEConfig(activeIDE) : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST save IDE preference
app.post('/api/settings/ide', (req, res) => {
    try {
        const { ideId } = req.body;

        if (!ideId) {
            return res.status(400).json({
                success: false,
                error: 'IDE ID is required'
            });
        }

        const ideConfigObj = ideConfig.getIDEConfig(ideId);
        if (!ideConfigObj) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IDE ID'
            });
        }

        const saved = saveIDEPreference(ideId);
        if (saved) {
            res.json({
                success: true,
                message: `IDE preference saved: ${ideConfigObj.name}`,
                preferredIDE: ideId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save IDE preference'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET list of available IDEs
app.get('/api/settings/ide/available', (req, res) => {
    try {
        const allIDEs = ideConfig.getAllIDEs();
        const installedIDEs = ideConfig.getInstalledIDEs();

        res.json({
            success: true,
            all: allIDEs,
            installed: installedIDEs,
            recommended: getActiveIDE()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List existing projects
app.get('/api/projects', authenticateToken, (req, res) => {
    // Use absolute path to workspace
    const workspacePath = GLOBAL_WORKSPACE_PATH;
    const scriptsDir = path.join(workspacePath, 'scripts');
    const projects = [];
    const fs = require('fs');

    try {
        const items = fs.readdirSync(scriptsDir);

        for (const item of items) {
            const itemPath = path.join(scriptsDir, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                const claspConfigPath = path.join(itemPath, '.clasp.json');
                if (fs.existsSync(claspConfigPath)) {
                    try {
                        const claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));

                        // Get project description based on project name
                        const projectDescriptions = {
                            'BPO_Weekly_Offenders': {
                                title: 'Weekly KPI Reporting System',
                                description: 'Automated system for generating weekly KPI reports across multiple call center sites. Monitors coffee breaks, hold times, coaching sessions, and other performance metrics using BigQuery data. Features consolidated dashboards and historical trend analysis.',
                                features: ['BigQuery Integration', 'Multi-Site Processing', 'Automated Reports', 'Performance Monitoring'],
                                sheetUrl: 'https://docs.google.com/spreadsheets/d/1Bgo-UCY9ED8NhMUsROA9GbKLosARYa00bS3AbEsrX5w/edit'
                            },
                            'OPS_x_WFM_to_Make': {
                                title: 'Slack Ticket Management System',
                                description: 'Comprehensive ticket management system that integrates Slack interactions with Notion databases. Handles automated ticket creation, status updates, and team notifications for efficient workflow management.',
                                features: ['Slack Integration', 'Notion Sync', 'Automated Workflows', 'Team Notifications'],
                                sheetUrl: 'https://docs.google.com/spreadsheets/d/15ztdPlAYCN2ql2mVNd3Vo9hWvwt4ixJkP7J76bEwqqM/edit'
                            },
                            'test': {
                                title: 'Development Test Project',
                                description: 'Basic test project for development and experimentation. Contains simple functions for testing Google Apps Script deployments and functionality.',
                                features: ['Basic Testing', 'Development Sandbox', 'Simple Functions']
                                // sheetUrl: 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit' // Add when you know the actual sheet ID
                            }
                        };

                        const projectDesc = projectDescriptions[item] || {
                            title: item.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            description: 'Custom Google Apps Script project for specialized functionality.',
                            features: ['Custom Features']
                        };

                        // Get deployment tracking information
                        const trackingFile = path.join(itemPath, '.clasp-deployer.json');
                        let lastPush = null;
                        let lastPull = null;

                        if (fs.existsSync(trackingFile)) {
                            try {
                                const trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
                                lastPush = trackingData.lastPush;
                                lastPull = trackingData.lastPull;
                            } catch (error) {
                                // Ignore tracking file errors
                            }
                        }

                        // Get the most recently modified file in the project
                        let lastModified = stat.mtime;
                        let lastModifiedFile = null;

                        // Check key project files for modification times
                        const filesToCheck = ['Code.ts', 'Code.js', 'config.ts', 'appsscript.json'];
                        for (const file of filesToCheck) {
                            const filePath = path.join(itemPath, file);
                            if (fs.existsSync(filePath)) {
                                const fileStat = fs.statSync(filePath);
                                if (fileStat.mtime > lastModified) {
                                    lastModified = fileStat.mtime;
                                    lastModifiedFile = file;
                                }
                            }
                        }

                        // Use already parsed lastPush/lastPull logic or separate check
                        let sheetUrl = claspConfig.sheetUrl || projectDesc.sheetUrl;
                        if (!claspConfig.sheetUrl && fs.existsSync(trackingFile)) {
                            try {
                                const trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
                                if (trackingData.sheetUrl) sheetUrl = trackingData.sheetUrl;
                            } catch (e) { }
                        }

                        projects.push({
                            name: item,
                            path: itemPath,
                            scriptId: claspConfig.scriptId,
                            projectId: claspConfig.projectId,
                            relativePath: path.relative(workspacePath, itemPath),
                            lastModified: lastModified.toISOString(),
                            lastModifiedFile: lastModifiedFile,
                            lastPush: lastPush,
                            lastPull: lastPull,
                            lastModifiedDisplay: formatLastModified(lastModified),
                            description: {
                                ...projectDesc,
                                sheetUrl: sheetUrl
                            }
                        });
                    } catch (err) {
                        // Skip invalid .clasp.json files
                    }
                }
            }
        }
    } catch (err) {
        // Scripts directory doesn't exist or can't be read
    }

    // Sort projects by last modified date (most recent first)
    projects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.json({ projects });
});

// ---------------------------------------------------------
// AUTHENTICATION HELPER ENDPOINTS
// ---------------------------------------------------------

// Generate Auth URL for Enhanced Access (Drive Readonly)
app.get('/api/auth/url', (req, res) => {
    const os = require('os');
    const clasprcPath = path.join(os.homedir(), '.clasprc.json');

    if (!fs.existsSync(clasprcPath)) {
        return res.status(400).json({ error: 'No .clasprc.json found. Please run clasp login first.' });
    }

    try {
        const clasprc = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
        const clientId = clasprc.oauth2ClientSettings.clientId;
        const redirectUri = 'http://localhost:3000/auth/callback';

        // Scope: drive.readonly allows listing ALL files
        const scope = 'https://www.googleapis.com/auth/drive.readonly';

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

        res.json({ url: authUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Handle OAuth Callback
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if (error) {
        return res.send(`<h1>Authentication Failed</h1><p>${error}</p>`);
    }

    if (!code) {
        return res.send('<h1>No code provided</h1>');
    }

    const os = require('os');
    const clasprcPath = path.join(os.homedir(), '.clasprc.json');
    const customTokenPath = path.join(os.homedir(), '.clasp-deployer-token.json');

    try {
        const clasprc = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
        const clientId = clasprc.oauth2ClientSettings.clientId;
        const clientSecret = clasprc.oauth2ClientSettings.clientSecret;
        const redirectUri = 'http://localhost:3000/auth/callback';

        // Exchange code for token
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const tokens = response.data;
        if (tokens.expires_in) {
            tokens.expiry_date = new Date().getTime() + (tokens.expires_in * 1000);
        }

        fs.writeFileSync(customTokenPath, JSON.stringify(tokens, null, 2));

        res.send(`
            <h1>✅ Authentication Successful!</h1>
            <p>You have granted Enhanced Drive Access.</p>
            <p>You can close this tab and refresh the Deployer app.</p>
            <script>
                setTimeout(() => window.close(), 3000);
            </script>
        `);
    } catch (e) {
        console.error('Token exchange error:', e.response ? e.response.data : e.message);
        res.send(`<h1>Token Exchange Failed</h1><p>${e.message}</p>`);
    }
});

// List available scripts from Google Account (Direct API with Custom/Clasp token fallback)
app.get('/api/clasp/scripts/available', async (req, res) => {
    console.log('Fetching available scripts from Google...');

    const workspacePath = GLOBAL_WORKSPACE_PATH;
    const scriptsDir = path.join(workspacePath, 'scripts');
    const os = require('os');

    const clasprcPath = path.join(os.homedir(), '.clasprc.json');
    const customTokenPath = path.join(os.homedir(), '.clasp-deployer-token.json');

    let tokenSource = null;
    let clientId, clientSecret;

    // Use custom token first (better scopes)
    if (fs.existsSync(customTokenPath)) {
        try {
            console.log('🔑 Found .clasp-deployer-token.json, using Enhanced Access...');
            const tokens = JSON.parse(fs.readFileSync(customTokenPath, 'utf8'));
            tokenSource = { tokens, path: customTokenPath, type: 'custom' };
            if (fs.existsSync(clasprcPath)) {
                const clasprc = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
                clientId = clasprc.oauth2ClientSettings.clientId;
                clientSecret = clasprc.oauth2ClientSettings.clientSecret;
            }
        } catch (e) { console.warn('Failed to read custom token:', e.message); }
    }

    // Fallback to .clasprc
    if (!tokenSource && fs.existsSync(clasprcPath)) {
        try {
            console.log('🔑 Found .clasprc.json, attempting standard access...');
            const clasprc = JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
            tokenSource = { tokens: clasprc.token, path: clasprcPath, type: 'clasprc' };
            clientId = clasprc.oauth2ClientSettings.clientId;
            clientSecret = clasprc.oauth2ClientSettings.clientSecret;
        } catch (e) { console.warn('Failed to read .clasprc:', e.message); }
    }

    if (tokenSource) {
        try {
            let accessToken = tokenSource.tokens.access_token;
            const expiryDate = tokenSource.tokens.expiry_date;
            const isExpired = expiryDate && (new Date().getTime() > expiryDate - 300000);

            if (isExpired && tokenSource.tokens.refresh_token && clientId && clientSecret) {
                console.log(`🔄 Token (${tokenSource.type}) expired, refreshing...`);
                try {
                    const refreshResponse = await axios.post('https://oauth2.googleapis.com/token', {
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: tokenSource.tokens.refresh_token,
                        grant_type: 'refresh_token'
                    });

                    if (refreshResponse.data && refreshResponse.data.access_token) {
                        accessToken = refreshResponse.data.access_token;
                        console.log('✅ Token refreshed successfully');
                        if (tokenSource.type === 'custom') {
                            const newTokens = { ...tokenSource.tokens, ...refreshResponse.data };
                            if (newTokens.expires_in) {
                                newTokens.expiry_date = new Date().getTime() + (newTokens.expires_in * 1000);
                            }
                            fs.writeFileSync(customTokenPath, JSON.stringify(newTokens, null, 2));
                        }
                    }
                } catch (refreshError) {
                    console.error('❌ Token refresh failed:', refreshError.response ? refreshError.response.data : refreshError.message);
                }
            } else {
                console.log(`✅ Token (${tokenSource.type}) appears valid`);
            }

            if (accessToken) {
                const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
                    params: {
                        q: "mimeType='application/vnd.google-apps.script' and trashed=false",
                        fields: "nextPageToken, files(id, name, webViewLink)",
                        pageSize: 100
                    },
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (driveResponse.status === 200 && driveResponse.data.files) {
                    console.log(`✅ Direct API success! Found ${driveResponse.data.files.length} scripts.`);
                    const files = driveResponse.data.files;
                    const availableScripts = files.map(f => ({
                        name: f.name,
                        scriptId: f.id,
                        url: f.webViewLink || `https://script.google.com/d/${f.id}/edit`
                    }));
                    return sendScriptsResponse(res, availableScripts, scriptsDir);
                }
            }
        } catch (apiError) {
            console.warn('⚠️ Direct API failed, falling back to CLI:', apiError.message);
            if (apiError.response) {
                console.warn('   API Error Details:', JSON.stringify(apiError.response.data, null, 2));
            }
            // Fallback to Method 2 below
        }
    } else {
        console.log('ℹ️ No tokens found for Direct API.');
    }

    // ---------------------------------------------------------
    // METHOD 2: Fallback to clasp list CLI
    // ---------------------------------------------------------
    try {
        const { spawn } = require('child_process');

        // Run clasp list command
        const listProcess = spawn('npx', ['clasp', 'list'], {
            cwd: workspacePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false
        });

        let output = '';
        let errorOutput = '';

        listProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        listProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        listProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('clasp list failed:', errorOutput);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to list scripts. Please ensure you are logged in via clasp login.',
                    details: errorOutput
                });
            }

            // DEBUG LOGGING
            console.log('--- RAW CLASP LIST OUTPUT ---');
            console.log(output);
            console.log('-----------------------------');

            // Strip ANSI codes (colors)
            const cleanOutput = output.replace(/\x1B\[\d+m/g, '');

            // Parse output to extract scripts
            const availableScripts = [];
            const lines = cleanOutput.split('\n');

            // Regex for different formats
            // Format 1: Name (https://script.google.com/d/ID/edit) or Name (id:ID)
            const regexParen = /(.+)\s+\((?:https:\/\/script\.google\.com\/d\/|id:)([\w\-_]+)(?:\/edit)?\)/;
            // Format 2: Name - https://script.google.com/d/ID/edit  (Observed in user logs)
            const regexDash = /(.+?)\s+-\s+https:\/\/script\.google\.com\/d\/([\w\-_]+)(?:\/edit)?/;

            for (const line of lines) {
                if (!line.trim()) continue;

                let name = null;
                let id = null;

                // Try Dash format first (as per logs)
                let match = line.match(regexDash);
                if (match) {
                    name = match[1].trim();
                    id = match[2];
                } else {
                    // Try Parentheses format
                    match = line.match(regexParen);
                    if (match) {
                        name = match[1].trim();
                        id = match[2];
                    }
                }

                if (name && id) {
                    availableScripts.push({
                        name: name,
                        scriptId: id,
                        url: `https://script.google.com/d/${id}/edit`
                    });
                }
            }

            // Mark validation status
            sendScriptsResponse(res, availableScripts, scriptsDir);
        });

    } catch (err) {
        console.error('Error in /api/clasp/scripts/available:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Helper to format and send scripts response (used by both Direct API and CLI methods)
function sendScriptsResponse(res, availableScripts, scriptsDir) {
    // Get local project IDs to check status
    const localScriptIds = new Set();
    if (fs.existsSync(scriptsDir)) {
        try {
            const items = fs.readdirSync(scriptsDir);
            for (const item of items) {
                const itemPath = path.join(scriptsDir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const claspConfigPath = path.join(itemPath, '.clasp.json');
                    if (fs.existsSync(claspConfigPath)) {
                        try {
                            const claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
                            if (claspConfig.scriptId) {
                                localScriptIds.add(claspConfig.scriptId);
                            }
                        } catch (e) {
                            // Ignore invalid config
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore errors reading local scripts
        }
    }

    // Mark validation status
    const scriptsWithStatus = availableScripts.map(script => ({
        ...script,
        isLocal: localScriptIds.has(script.scriptId)
    }));

    console.log(`Found ${scriptsWithStatus.length} available scripts`);
    res.json({
        success: true,
        scripts: scriptsWithStatus
    });
}
// End of helper function

// Clone a remote script
app.post('/api/clasp/clone', async (req, res) => {
    const { scriptId, name, sheetUrl } = req.body; // Added sheetUrl to req.body

    if (!scriptId || !name) {
        return res.status(400).json({ error: 'Script ID and name are required' });
    }

    console.log(`Cloning script ${name} (${scriptId})...`);

    const workspacePath = GLOBAL_WORKSPACE_PATH;
    const scriptsDir = path.join(workspacePath, 'scripts');

    // Create safe directory name
    const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const projectPath = path.join(scriptsDir, safeName);

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
        return res.status(400).json({
            success: false,
            error: `Directory '${safeName}' already exists. Please delete it or rename the project.`
        });
    }

    // Create directory
    try {
        if (!fs.existsSync(scriptsDir)) {
            fs.mkdirSync(scriptsDir, { recursive: true });
        }
        fs.mkdirSync(projectPath, { recursive: true });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: `Failed to create project directory: ${err.message}`
        });
    }

    const { spawn } = require('child_process');

    // Run clasp clone
    console.log(`Executing: clasp clone ${scriptId} in ${projectPath}`);

    const cloneProcess = spawn('npx', ['-y', '@google/clasp', 'clone', scriptId], {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    cloneProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(`[CLONE] ${data.toString().trim()}`);
    });

    cloneProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log(`[CLONE ERR] ${data.toString().trim()}`);
    });

    cloneProcess.on('close', (code) => {
        if (code !== 0) {
            console.error('clasp clone failed:', errorOutput);

            // Clean up empty directory
            try {
                fs.rmdirSync(projectPath, { recursive: true });
            } catch (e) {
                // Ignore cleanup error
            }

            return res.status(500).json({
                success: false,
                error: 'Failed to clone script',
                details: errorOutput || output
            });
        }

        console.log(`Successfully cloned ${name}`);

        // Also create .clasp-deployer.json to track this project
        const trackingFile = path.join(projectPath, '.clasp-deployer.json');
        const trackingData = {
            created: new Date().toISOString(),
            lastPull: new Date().toISOString(),
            scriptId: scriptId,
            sheetUrl: sheetUrl || null // Save sheetUrl here
        };

        try {
            fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));
        } catch (e) {
            console.error('Failed to create tracking file:', e);
        }

        // Attempt to open in Cursor
        try {
            // Check for Code.js or Code.ts
            let openFile = null;
            if (fs.existsSync(path.join(projectPath, 'Code.js'))) {
                openFile = path.join(projectPath, 'Code.js');
            } else if (fs.existsSync(path.join(projectPath, 'Code.ts'))) {
                openFile = path.join(projectPath, 'Code.ts');
            } else {
                openFile = projectPath;
            }
            const activeIDE = getActiveIDE();
            if (activeIDE) {
                const command = ideConfig.getOpenFileCommand(activeIDE, openFile);
                console.log(`Opening file in ${ideConfig.getIDEConfig(activeIDE).name}: ${openFile}`);
                require('child_process').execSync(command, { stdio: 'pipe' });
            } else {
                console.log('No IDE configured');
            }
        } catch (e) {
            console.log('Failed to open in IDE:', e.message);
        }

        res.json({
            success: true,
            message: `Successfully cloned ${name}`,
            path: projectPath,
            scriptId: scriptId
        });
    });
});



// Helper function to format last modified time
function formatLastModified(date) {
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

// Helper function to update deployment tracking
function updateDeploymentTracking(projectPath, operation) {
    console.log(`🔧 updateDeploymentTracking called: ${projectPath}, operation: ${operation}`);

    const trackingFile = path.join(projectPath, '.clasp-deployer.json');
    console.log(`📁 Tracking file: ${trackingFile}`);

    let trackingData = {};
    if (fs.existsSync(trackingFile)) {
        try {
            trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
            console.log(`📖 Read existing data:`, trackingData);
        } catch (error) {
            // Reset tracking data if corrupted
            console.log(`❌ Error reading tracking file:`, error);
            trackingData = {};
        }
    } else {
        console.log(`📝 Tracking file does not exist, creating new one`);
    }

    const now = new Date().toISOString();
    console.log(`🕒 Current timestamp: ${now}`);

    if (operation === 'push') {
        trackingData.lastPush = now;
        console.log(`📤 Setting lastPush: ${now}`);
    } else if (operation === 'pull') {
        trackingData.lastPull = now;
        console.log(`📥 Setting lastPull: ${now}`);
    }

    try {
        fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));
        console.log(`✅ Successfully wrote tracking data:`, trackingData);
    } catch (error) {
        console.error('❌ Failed to update deployment tracking:', error);
    }
}

// Refresh existing project
app.post('/api/refresh', async (req, res) => {
    const { projectName } = req.body;

    if (!projectName) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);

        // Check if project exists
        if (!require('fs').existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const claspConfigPath = path.join(projectPath, '.clasp.json');
        if (!require('fs').existsSync(claspConfigPath)) {
            return res.status(400).json({ error: 'Not a valid CLASP project' });
        }

        // Run clasp pull
        const { spawn } = require('child_process');
        const pullProcess = spawn('npx', ['clasp', 'pull'], {
            cwd: projectPath,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });

        let output = '';
        let errorOutput = '';

        pullProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pullProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pullProcess.on('close', (code) => {
            if (code === 0) {
                // Track the pull operation
                updateDeploymentTracking(projectPath, 'pull');

                // Attempt to find Code.ts or Code.js
                const codeTsPath = path.join(projectPath, 'Code.ts');
                const codeJsPath = path.join(projectPath, 'Code.js');

                let codeFile = null;
                if (fs.existsSync(codeTsPath)) {
                    codeFile = codeTsPath;
                } else if (fs.existsSync(codeJsPath)) {
                    codeFile = codeJsPath;
                }

                const openPath = codeFile || projectPath;
                const isFile = codeFile !== null;

                // Try to open in IDE
                try {
                    console.log(`Attempting to open: ${openPath} (isFile: ${isFile})`);
                    const activeIDE = getActiveIDE();
                    if (activeIDE) {
                        const command = isFile
                            ? ideConfig.getOpenFileCommand(activeIDE, openPath)
                            : ideConfig.getOpenFolderCommand(activeIDE, openPath);
                        console.log(`Opening in ${ideConfig.getIDEConfig(activeIDE).name}: ${command}`);
                        require('child_process').execSync(command, { stdio: 'pipe' });
                        console.log('Successfully opened in IDE');
                    } else {
                        console.log('No IDE configured, skipping auto-open');
                    }
                } catch (ideErr) {
                    console.log(`IDE open failed: ${ideErr.message}`);
                    // Try fallback to system default
                    try {
                        require('child_process').execSync(`open "${openPath}"`, { stdio: 'pipe' });
                        console.log('Fallback system open command executed');
                    } catch (openErr) {
                        console.log(`Fallback open failed: ${openErr.message}`);
                    }
                }

                res.json({
                    success: true,
                    message: `Successfully refreshed ${projectName}`,
                    output: output + errorOutput,
                    openedFile: isFile
                });
            } else {
                res.json({
                    success: false,
                    message: `Failed to refresh ${projectName}`,
                    output: output + errorOutput,
                    code
                });
            }
        });

        pullProcess.on('error', (error) => {
            res.status(500).json({
                success: false,
                error: error.message
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Open project folder or file
app.post('/api/open-folder', async (req, res) => {
    const { projectName, filePath } = req.body;

    // Support both projectName (for Apps Script) and filePath (for Make scenarios)
    if (!projectName && !filePath) {
        return res.status(400).json({ error: 'Project name or file path is required' });
    }

    // If filePath is provided, use it directly (for Make scenarios)
    if (filePath) {
        const { execSync } = require('child_process');
        const fs = require('fs');

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found', path: filePath });
        }

        try {
            const activeIDE = getActiveIDE();
            if (!activeIDE) {
                return res.status(400).json({
                    success: false,
                    error: 'No IDE configured or detected',
                    message: 'Please select an IDE in Settings'
                });
            }

            console.log(`📂 Opening file in ${ideConfig.getIDEConfig(activeIDE).name}: ${filePath}`);
            const command = ideConfig.getOpenFileCommand(activeIDE, filePath);
            execSync(command, { stdio: 'pipe' });
            console.log('✅ Successfully opened file in IDE');

            res.json({
                success: true,
                message: `Opened file in ${ideConfig.getIDEConfig(activeIDE).name}`,
                path: filePath
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to open file in IDE',
                details: error.message
            });
        }
    }

    // Original Apps Script logic
    const workspacePath = GLOBAL_WORKSPACE_PATH;
    const projectPath = path.join(workspacePath, 'scripts', projectName);
    const fs = require('fs');

    // Check if project exists
    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Determine which code file to open (prioritize Code.js for GAS workflow)
    // Use the EXACT same logic as the pull operation
    let codeFile = null;
    const codeJsPath = path.join(projectPath, 'Code.js');
    const codeTsPath = path.join(projectPath, 'Code.ts');

    // Check Code.js first (same as pull - just check if exists, don't check content)
    if (fs.existsSync(codeJsPath)) {
        codeFile = codeJsPath;
    } else if (fs.existsSync(codeTsPath)) {
        codeFile = codeTsPath;
    }

    // Open the code file if it exists, otherwise open the project folder
    const openPath = codeFile || projectPath;
    const isFile = codeFile !== null;

    console.log(`Opening: ${openPath} (isFile: ${isFile})`);
    console.log(`Project name: ${projectName}`);
    if (codeFile) {
        console.log(`Code file found: ${codeFile}`);
    } else {
        console.log(`No code file found, opening project folder: ${projectPath}`);
    }

    // Use the EXACT same method as pull operation - execSync with open command
    const { execSync } = require('child_process');

    try {
        console.log(`Using open: open -a "Cursor" "${openPath}"`);
        // This is the exact same command that works in pull
        execSync(`open -a "Cursor" "${openPath}"`, { stdio: 'pipe' });
        console.log('Cursor open command executed successfully');

        res.json({
            success: true,
            message: isFile ? `Opened Code.${codeFile.endsWith('.ts') ? 'ts' : 'js'} file in Cursor` : `Opened ${projectName} project in Cursor`,
            method: 'open',
            openedFile: isFile,
            path: openPath
        });
    } catch (cursorErr) {
        console.log(`Cursor open command failed: ${cursorErr.message}`);
        // Fallback to system default open command
        try {
            // Use selected IDE
            const activeIDE = getActiveIDE();
            if (activeIDE) {
                const command = ideConfig.getOpenFolderCommand(activeIDE, openPath);
                console.log(`Opening in ${ideConfig.getIDEConfig(activeIDE).name}: ${command}`);
                execSync(command, { stdio: 'pipe' });

                res.json({
                    success: true,
                    method: 'automatic',
                    message: `Opened in ${ideConfig.getIDEConfig(activeIDE).name}`,
                    path: openPath
                });
            } else {
                console.log(`Trying fallback: open "${openPath}"`);
                execSync(`open "${openPath}"`, { stdio: 'pipe' });
                console.log('Fallback system open command executed');

                res.json({
                    success: true,
                    message: isFile ? `Opened Code.${codeFile.endsWith('.ts') ? 'ts' : 'js'} file` : `Opened ${projectName} project`,
                    method: 'open-fallback',
                    openedFile: isFile,
                    path: openPath
                });
            }
        } catch (openErr) {
            console.log(`Fallback open failed: ${openErr.message}`);
            res.json({
                success: false,
                error: `Could not open project: ${openErr.message}`,
                path: openPath,
                instructions: `Manually open this path in Cursor: ${openPath}`
            });
        }
    }
});

// Server-Sent Events for real-time deployment updates
app.get('/api/deploy/stream', (req, res) => {
    const deploymentId = req.query.id;
    if (!deploymentId || !activeDeployments.has(deploymentId)) {
        return res.status(404).json({ error: 'Deployment not found' });
    }

    const deployment = activeDeployments.get(deploymentId);

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Connected to deployment stream"}\n\n');

    // Add this response to the deployment's listeners
    deployment.listeners.push(res);

    // Handle client disconnect
    req.on('close', () => {
        const index = deployment.listeners.indexOf(res);
        if (index > -1) {
            deployment.listeners.splice(index, 1);
        }
    });
});

// Get deployment history
app.get('/api/deployments/:projectName', async (req, res) => {
    const { projectName } = req.params;

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);
        const historyFile = path.join(projectPath, '.deployment-history.json');

        // Check if project exists
        if (!require('fs').existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Read deployment history
        let history = [];
        if (require('fs').existsSync(historyFile)) {
            history = JSON.parse(require('fs').readFileSync(historyFile, 'utf8'));
        }

        res.json({ deployments: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rollback to specific version
app.post('/api/rollback/:projectName', async (req, res) => {
    const { projectName } = req.params;
    const { versionId } = req.body;

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);
        const historyFile = path.join(projectPath, '.deployment-history.json');

        if (!require('fs').existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!require('fs').existsSync(historyFile)) {
            return res.status(404).json({ error: 'No deployment history found' });
        }

        const history = JSON.parse(require('fs').readFileSync(historyFile, 'utf8'));
        const targetDeployment = history.find(d => d.id === versionId);

        if (!targetDeployment) {
            return res.status(404).json({ error: 'Version not found' });
        }

        // Restore files from backup
        const backupDir = path.join(projectPath, '.backups', versionId);
        if (!require('fs').existsSync(backupDir)) {
            return res.status(404).json({ error: 'Backup not found for this version' });
        }

        // Copy backup files back to project
        const fs = require('fs');
        const copyRecursive = (src, dest) => {
            if (fs.statSync(src).isDirectory()) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                fs.readdirSync(src).forEach(child => {
                    copyRecursive(path.join(src, child), path.join(dest, child));
                });
            } else {
                fs.copyFileSync(src, dest);
            }
        };

        copyRecursive(backupDir, projectPath);

        // Record rollback in history
        const rollbackEntry = {
            id: Date.now().toString(),
            version: targetDeployment.version,
            timestamp: new Date().toISOString(),
            type: 'rollback',
            message: `Rolled back to version ${targetDeployment.version}`,
            status: 'completed',
            rolledBackFrom: history[0]?.version || 'unknown'
        };

        history.unshift(rollbackEntry);
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

        res.json({
            success: true,
            message: `Successfully rolled back to version ${targetDeployment.version}`,
            deployment: rollbackEntry
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deployment endpoint
app.post('/api/deploy', authenticateToken, async (req, res) => {
    const { scriptUrl, projectName, sheetUrl } = req.body;

    if (!scriptUrl) {
        return res.status(400).json({ error: 'Script URL is required' });
    }

    // Generate unique deployment ID
    const deploymentId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    try {
        // Get the workspace path
        const workspacePath = GLOBAL_WORKSPACE_PATH;

        // deploy-clasp.js is in the same directory as server.js
        const scriptPath = path.join(__dirname, 'deploy-clasp.js');

        console.log('Workspace path:', workspacePath);
        console.log('Script path:', scriptPath);
        console.log('Script exists:', require('fs').existsSync(scriptPath));

        if (!require('fs').existsSync(scriptPath)) {
            throw new Error(`deploy-clasp.js not found at: ${scriptPath}`);
        }

        // Create deployment session
        const deployment = {
            id: deploymentId,
            process: null,
            listeners: [],
            output: '',
            errorOutput: '',
            startTime: Date.now()
        };

        activeDeployments.set(deploymentId, deployment);

        // Function to send updates to all listeners
        const sendUpdate = (type, data) => {
            const message = JSON.stringify({ type, ...data, timestamp: Date.now() });
            deployment.listeners.forEach(listener => {
                try {
                    listener.write(`data: ${message}\n\n`);
                } catch (e) {
                    // Remove broken listeners
                    const index = deployment.listeners.indexOf(listener);
                    if (index > -1) {
                        deployment.listeners.splice(index, 1);
                    }
                }
            });
        };

        console.log('Starting deployment with args:', [scriptPath, scriptUrl, projectName || '']);

        // Run the deploy-clasp.js script
        const deployProcess = spawn('node', [
            scriptPath,
            scriptUrl,
            projectName || ''
        ], {
            cwd: workspacePath,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false  // Don't use shell to avoid path issues
        });

        deployment.process = deployProcess;

        // Handle stdout
        deployProcess.stdout.on('data', (data) => {
            const text = data.toString();
            deployment.output += text;
            sendUpdate('log', { message: text, level: 'info' });
        });

        // Handle stderr
        deployProcess.stderr.on('data', (data) => {
            const text = data.toString();
            deployment.errorOutput += text;
            sendUpdate('log', { message: text, level: 'error' });
        });

        // Handle process completion
        deployProcess.on('close', (code) => {
            const fullOutput = deployment.output + deployment.errorOutput;
            const success = code === 0;

            if (success) {
                // Determine the project name actually used (it might have been sanitized or generated)
                // If projectName was provided, it should be used.
                // deploy-clasp.js logic sanitizes names.
                // Assuming the user provided name is respected or we can extract it from the output if needed.
                // For simplicity, we use the provided projectName if available, otherwise we might fail to associate.
                // But deploy-clasp.js outputs "Project directory created: ..." which we could parse.

                // Let's try to extract project name from output if possible, or fallback to request param.
                let finalProjectName = projectName;
                const match = fullOutput.match(/Project directory created: .*\/scripts\/([^\/\n]+)/);
                if (match && match[1]) {
                    finalProjectName = match[1];
                }

                if (finalProjectName) {
                    // Create/Update .clasp-deployer.json with sheetUrl
                    const projectDir = path.join(workspacePath, 'scripts', finalProjectName);
                    const trackingFile = path.join(projectDir, '.clasp-deployer.json');

                    // Read existing or create new
                    let trackingData = {};
                    if (fs.existsSync(trackingFile)) {
                        try {
                            trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
                        } catch (e) { }
                    } else {
                        trackingData = {
                            created: new Date().toISOString(),
                            lastPull: new Date().toISOString()
                        };
                        // Try to find scriptId from .clasp.json
                        const claspFile = path.join(projectDir, '.clasp.json');
                        if (fs.existsSync(claspFile)) {
                            try {
                                const claspData = JSON.parse(fs.readFileSync(claspFile, 'utf8'));
                                trackingData.scriptId = claspData.scriptId;
                            } catch (e) { }
                        }
                    }

                    if (sheetUrl) {
                        trackingData.sheetUrl = sheetUrl;
                        console.log(`Associating sheet ${sheetUrl} with project ${finalProjectName}`);
                    }

                    try {
                        fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));
                    } catch (e) {
                        console.error('Failed to write tracking file:', e);
                    }
                }
            }

            sendUpdate('complete', {
                success,
                code,
                output: fullOutput,
                duration: Date.now() - deployment.startTime
            });

            // Clean up
            setTimeout(() => {
                activeDeployments.delete(deploymentId);
            }, 5000); // Keep for 5 seconds after completion

            // Don't send response here - client will get updates via SSE
        });

        deployProcess.on('error', (error) => {
            console.error('Spawn error:', error);
            sendUpdate('error', { message: `Failed to start deployment process: ${error.message}` });

            // Clean up
            setTimeout(() => {
                activeDeployments.delete(deploymentId);
            }, 5000);
        });

        // For now, let's wait for completion and return result directly
        // This simplifies debugging - we'll add SSE later
        return new Promise((resolve) => {
            deployProcess.on('close', (code) => {
                const fullOutput = deployment.output + deployment.errorOutput;
                const success = code === 0;

                // Clean up
                activeDeployments.delete(deploymentId);

                resolve(res.json({
                    success,
                    output: fullOutput,
                    code
                }));
            });

            deployProcess.on('error', (error) => {
                // Clean up
                activeDeployments.delete(deploymentId);

                resolve(res.status(500).json({
                    success: false,
                    error: error.message
                }));
            });
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Enhanced deployment endpoint for existing projects
app.post('/api/deploy-project/:projectName', async (req, res) => {
    const { projectName } = req.params;
    const { version, message = '', autoIncrement = true } = req.body;

    console.log(`🚀 Starting deployment for ${projectName}`);

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);
        const historyFile = path.join(projectPath, '.deployment-history.json');
        const backupDir = path.join(workspacePath, '.clasp-deployer-backups', projectName);

        console.log(`📁 Project path: ${projectPath}`);

        // Check if project exists
        if (!require('fs').existsSync(projectPath)) {
            console.log(`❌ Project not found: ${projectPath}`);
            return res.status(404).json({ error: 'Project not found' });
        }

        const claspConfigPath = path.join(projectPath, '.clasp.json');
        if (!require('fs').existsSync(claspConfigPath)) {
            console.log(`❌ Not a valid CLASP project: ${claspConfigPath}`);
            return res.status(400).json({ error: 'Not a valid CLASP project' });
        }

        console.log(`✅ Project validation passed`);

        // Read existing history to determine next version
        let history = [];
        let nextVersion = version;

        if (require('fs').existsSync(historyFile)) {
            history = JSON.parse(require('fs').readFileSync(historyFile, 'utf8'));
            console.log(`📋 Loaded existing history: ${history.length} deployments`);
        }

        // Auto-increment version if requested and not specified
        if (autoIncrement && !version) {
            const lastVersion = history.length > 0 ? history[0].version : '0.0.0';
            const versionParts = lastVersion.split('.').map(Number);
            versionParts[2] = (versionParts[2] || 0) + 1; // Increment patch version
            nextVersion = versionParts.join('.');
            console.log(`🔢 Auto-incremented version: ${lastVersion} → ${nextVersion}`);
        }

        console.log(`🏷️ Deployment version: ${nextVersion}`);

        // Skip backup creation for now to get deployment working
        const deploymentId = Date.now().toString();

        console.log(`⏭️ Skipping backup creation for now`);

        // Record deployment start
        const deploymentEntry = {
            id: deploymentId,
            version: nextVersion || '1.0.0',
            timestamp: new Date().toISOString(),
            type: 'deployment',
            message: message || `Deployed version ${nextVersion || '1.0.0'}`,
            status: 'in-progress',
            backupId: deploymentId
        };

        console.log(`📝 Recording deployment start: ${deploymentEntry.version}`);

        try {
            history.unshift(deploymentEntry);
            require('fs').writeFileSync(historyFile, JSON.stringify(history, null, 2));
            console.log(`✅ Deployment record created`);
        } catch (historyError) {
            console.error(`❌ Failed to write deployment history:`, historyError);
            return res.status(500).json({ error: `Failed to write deployment history: ${historyError.message}` });
        }

        // Run clasp push with selective files
        console.log(`🔨 Executing selective clasp push in: ${projectPath}`);
        const { spawn } = require('child_process');

        try {
            const deployProcess = spawn('npx', ['clasp', 'push', 'Code.js', 'appsscript.json'], {
                cwd: projectPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false
            });

            let output = '';
            let errorOutput = '';

            deployProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`[${projectName}] ${data.toString().trim()}`);
            });

            deployProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.log(`[${projectName}] ERROR: ${data.toString().trim()}`);
            });

            deployProcess.on('close', (code) => {
                console.log(`[${projectName}] clasp push exited with code: ${code}`);

                try {
                    // Update deployment status
                    const updatedHistory = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                    const entryIndex = updatedHistory.findIndex(d => d.id === deploymentId);

                    if (entryIndex !== -1) {
                        if (code === 0) {
                            updatedHistory[entryIndex].status = 'completed';
                            updatedHistory[entryIndex].completedAt = new Date().toISOString();
                            fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2));

                            // Update deployment tracking for last push
                            console.log(`📝 Updating deployment tracking for ${projectName}...`);
                            updateDeploymentTracking(projectPath, 'push');
                            console.log(`✅ Deployment tracking updated`);

                            console.log(`✅ Deployment completed successfully: ${projectName} v${nextVersion}`);

                            // Verify tracking was updated
                            const trackingFile = path.join(projectPath, '.clasp-deployer.json');
                            let trackingUpdated = false;
                            if (fs.existsSync(trackingFile)) {
                                try {
                                    const trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
                                    trackingUpdated = !!trackingData.lastPush;
                                    console.log(`📊 Tracking file updated: ${trackingUpdated}, lastPush: ${trackingData.lastPush}`);
                                } catch (e) {
                                    console.log(`❌ Error reading tracking file: ${e.message}`);
                                }
                            }

                            res.json({
                                success: true,
                                message: `Successfully deployed ${projectName} v${nextVersion || '1.0.0'}`,
                                deployment: updatedHistory[entryIndex],
                                output: output + errorOutput,
                                trackingUpdated: trackingUpdated
                            });
                        } else {
                            updatedHistory[entryIndex].status = 'failed';
                            updatedHistory[entryIndex].error = errorOutput;
                            updatedHistory[entryIndex].completedAt = new Date().toISOString();
                            fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2));

                            console.log(`❌ Deployment failed: ${projectName}`);
                            res.status(500).json({
                                success: false,
                                message: `Deployment failed for ${projectName}`,
                                deployment: updatedHistory[entryIndex],
                                output: output + errorOutput
                            });
                        }
                    } else {
                        console.error(`❌ Could not find deployment entry in history`);
                        res.status(500).json({ error: 'Could not find deployment entry in history' });
                    }
                } catch (updateError) {
                    console.error(`❌ Failed to update deployment status:`, updateError);
                    res.status(500).json({ error: `Failed to update deployment status: ${updateError.message}` });
                }
            });

            deployProcess.on('error', (spawnError) => {
                console.error(`❌ Failed to start clasp process:`, spawnError);
                res.status(500).json({ error: `Failed to start clasp process: ${spawnError.message}` });
            });

        } catch (spawnSetupError) {
            console.error(`❌ Failed to setup clasp spawn:`, spawnSetupError);
            res.status(500).json({ error: `Failed to setup clasp spawn: ${spawnSetupError.message}` });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// File watchers for auto-deployment
const fileWatchers = new Map();

// Enable/disable auto-deployment for a project
app.post('/api/watch/:projectName', async (req, res) => {
    const { projectName } = req.params;
    const { enabled } = req.body;

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);
        const watchConfigFile = path.join(projectPath, '.watch-config.json');

        if (!fs.existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Stop existing watcher if it exists
        if (fileWatchers.has(projectName)) {
            fileWatchers.get(projectName).close();
            fileWatchers.delete(projectName);
        }

        if (enabled) {
            // Start watching files
            const watcher = chokidar.watch([
                path.join(projectPath, 'Code.js'),
                path.join(projectPath, 'Code.ts'),
                path.join(projectPath, '*.js'),
                path.join(projectPath, '*.ts')
            ], {
                ignored: /(^|[\/\\])\../, // ignore dot files
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 1000,
                    pollInterval: 100
                }
            });

            let pendingDeployment = false;

            watcher.on('change', (filePath) => {
                if (pendingDeployment) return; // Avoid multiple deployments
                pendingDeployment = true;

                console.log(`📝 File changed: ${path.basename(filePath)} in ${projectName}`);

                // Wait a bit for multiple changes, then deploy
                setTimeout(async () => {
                    try {
                        console.log(`🚀 Auto-deploying ${projectName}...`);

                        // Read current version for auto-increment
                        const historyFile = path.join(projectPath, '.deployment-history.json');
                        let history = [];
                        if (fs.existsSync(historyFile)) {
                            history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                        }

                        const lastVersion = history.length > 0 ? history[0].version : '0.0.0';
                        const versionParts = lastVersion.split('.').map(Number);
                        versionParts[2] = (versionParts[2] || 0) + 1;
                        const nextVersion = versionParts.join('.');

                        // Run deployment
                        const { spawn } = require('child_process');
                        const deployProcess = spawn('npx', ['clasp', 'push'], {
                            cwd: projectPath,
                            stdio: ['pipe', 'pipe', 'pipe'],
                            shell: false
                        });

                        deployProcess.on('close', (code) => {
                            if (code === 0) {
                                console.log(`✅ Auto-deployed ${projectName} v${nextVersion}`);

                                // Record deployment
                                const deploymentEntry = {
                                    id: Date.now().toString(),
                                    version: nextVersion,
                                    timestamp: new Date().toISOString(),
                                    type: 'auto-deployment',
                                    message: `Auto-deployed on file change`,
                                    status: 'completed',
                                    completedAt: new Date().toISOString()
                                };

                                history.unshift(deploymentEntry);
                                fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
                            } else {
                                console.log(`❌ Auto-deployment failed for ${projectName}`);
                            }
                            pendingDeployment = false;
                        });

                    } catch (error) {
                        console.error(`Auto-deployment error for ${projectName}:`, error);
                        pendingDeployment = false;
                    }
                }, 2000); // Wait 2 seconds for file changes to settle
            });

            fileWatchers.set(projectName, watcher);

            // Save watch config
            const config = { enabled: true, startedAt: new Date().toISOString() };
            fs.writeFileSync(watchConfigFile, JSON.stringify(config, null, 2));

            res.json({
                success: true,
                message: `Auto-deployment enabled for ${projectName}`,
                config
            });
        } else {
            // Disable watching
            if (fs.existsSync(watchConfigFile)) {
                fs.unlinkSync(watchConfigFile);
            }

            res.json({
                success: true,
                message: `Auto-deployment disabled for ${projectName}`
            });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get watch status for a project
app.get('/api/watch/:projectName', async (req, res) => {
    const { projectName } = req.params;

    try {
        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const projectPath = path.join(workspacePath, 'scripts', projectName);
        const watchConfigFile = path.join(projectPath, '.watch-config.json');

        const isWatching = fileWatchers.has(projectName);
        let config = null;

        if (fs.existsSync(watchConfigFile)) {
            config = JSON.parse(fs.readFileSync(watchConfigFile, 'utf8'));
        }

        res.json({
            enabled: isWatching,
            config
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make.com API endpoints (duplicate removed - defined earlier in file)

app.get('/api/make/scenarios', authenticateToken, async (req, res) => {
    try {
        console.log('Fetching Make.com scenarios...');

        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const makeScenariosDir = path.join(workspacePath, 'make-scenarios', 'scenarios');
        const scenarios = [];

        // Read actual scenarios from local filesystem
        if (fs.existsSync(makeScenariosDir)) {
            try {
                const scenarioDirs = fs.readdirSync(makeScenariosDir);

                for (const dir of scenarioDirs) {
                    const scenarioPath = path.join(makeScenariosDir, dir);
                    if (!fs.statSync(scenarioPath).isDirectory()) continue;

                    const scenarioId = parseInt(dir);
                    if (isNaN(scenarioId)) continue;

                    // Read metadata.json for scenario info
                    const metadataPath = path.join(scenarioPath, 'metadata.json');

                    let scenarioData = {
                        id: scenarioId,
                        name: `Scenario ${scenarioId}`,
                        scheduling: { active: false },
                        lastRun: null
                    };

                    if (fs.existsSync(metadataPath)) {
                        try {
                            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                            if (metadata.name) scenarioData.name = metadata.name;
                            if (metadata.scheduling) scenarioData.scheduling = metadata.scheduling;
                            if (metadata.lastRun) scenarioData.lastRun = metadata.lastRun;
                        } catch (error) {
                            console.log(`Error reading metadata for ${scenarioId}:`, error.message);
                        }
                    }

                    scenarios.push(scenarioData);
                }
            } catch (error) {
                console.log('Error reading local scenarios:', error);
            }
        }

        // Add tracking information for each scenario (similar to Apps Script projects)
        const scenariosWithTracking = scenarios.map(scenario => {
            const scenarioPath = path.join(makeScenariosDir, scenario.id.toString());
            const trackingFile = path.join(scenarioPath, '.make-deployer.json');

            let lastPush = null;
            let lastPull = null;

            if (fs.existsSync(trackingFile)) {
                try {
                    const trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
                    lastPush = trackingData.lastPush;
                    lastPull = trackingData.lastPull;
                } catch (error) {
                    // Ignore tracking file errors
                }
            }

            // Get last modified time if scenario folder exists
            let lastModified = null;
            let lastModifiedFile = null;
            if (fs.existsSync(scenarioPath)) {
                try {
                    const stat = fs.statSync(scenarioPath);
                    lastModified = stat.mtime;

                    // Check for blueprint.json modification
                    const blueprintPath = path.join(scenarioPath, 'blueprint.json');
                    if (fs.existsSync(blueprintPath)) {
                        const blueprintStat = fs.statSync(blueprintPath);
                        if (blueprintStat.mtime > lastModified) {
                            lastModified = blueprintStat.mtime;
                            lastModifiedFile = 'blueprint.json';
                        }
                    }
                } catch (error) {
                    // Ignore stat errors
                }
            }

            return {
                ...scenario,
                lastPush,
                lastPull,
                lastModified: lastModified ? lastModified.toISOString() : null,
                lastModifiedFile,
                lastModifiedDisplay: lastModified ? formatLastModified(lastModified) : null
            };
        });

        res.json({
            success: true,
            scenarios: scenariosWithTracking
        });
    } catch (error) {
        console.error('Make scenarios error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Make scenarios'
        });
    }
});

app.post('/api/make/scenarios/:id/pull', authenticateToken, async (req, res) => {
    const scenarioId = req.params.id;

    console.log(`[MAKE PULL] Route hit for scenario ID: ${scenarioId}`);
    console.log(`[MAKE PULL] Request params:`, req.params);
    console.log(`[MAKE PULL] Request body:`, req.body);

    try {
        console.log(`Pulling Make scenario ${scenarioId}...`);

        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const makeScenariosDir = path.join(workspacePath, 'make-scenarios', 'scenarios');
        const scenarioPath = path.join(makeScenariosDir, scenarioId);

        // Ensure scenario directory exists
        if (!fs.existsSync(scenarioPath)) {
            fs.mkdirSync(scenarioPath, { recursive: true });
            console.log(`Created scenario directory: ${scenarioPath}`);
        }

        // Fetch scenario from Make.com API
        const apiToken = getMakeApiToken(req);
        if (!apiToken) {
            return res.status(401).json({
                success: false,
                error: 'Make.com API token not configured'
            });
        }

        console.log(`📡 Fetching scenario ${scenarioId} from Make.com API...`);

        // Try to get organization info to determine the correct zone
        let apiBase = 'https://eu1.make.celonis.com'; // Default to user's known zone
        try {
            const orgsResponse = await axios.get('https://eu1.make.com/api/v2/organizations', {
                headers: { 'Authorization': `Token ${apiToken}` },
                timeout: 5000,
                validateStatus: () => true
            });

            if (orgsResponse.status === 200 && orgsResponse.data?.organizations?.[0]?.zone) {
                const zone = orgsResponse.data.organizations[0].zone;
                apiBase = zone.includes('.') ? `https://${zone}` : `https://${zone}.make.com`;
                console.log(`   Using API base from org zone: ${apiBase}`);
            }
        } catch (e) {
            console.log(`   Using default API base: ${apiBase}`);
        }

        // Fetch the scenario metadata first
        const scenarioResponse = await axios.get(`${apiBase}/api/v2/scenarios/${scenarioId}`, {
            headers: {
                'Authorization': `Token ${apiToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: () => true
        });

        if (scenarioResponse.status !== 200) {
            throw new Error(`Failed to fetch scenario metadata: ${scenarioResponse.status} ${JSON.stringify(scenarioResponse.data)}`);
        }

        const scenarioMetadata = scenarioResponse.data.scenario || scenarioResponse.data;
        console.log(`✅ Fetched scenario metadata: ${scenarioMetadata.name || scenarioId}`);

        // Fetch the actual blueprint (flow data)
        console.log(`📡 Fetching blueprint (flow data) for scenario ${scenarioId}...`);
        const blueprintResponse = await axios.get(`${apiBase}/api/v2/scenarios/${scenarioId}/blueprint`, {
            headers: {
                'Authorization': `Token ${apiToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: () => true
        });

        if (blueprintResponse.status !== 200) {
            console.log(`⚠️ Blueprint endpoint returned ${blueprintResponse.status}, trying alternative...`);
            // Fallback: some APIs might return blueprint in the scenario response
            // or we might need to use a different endpoint
            throw new Error(`Failed to fetch blueprint: ${blueprintResponse.status} ${JSON.stringify(blueprintResponse.data).substring(0, 200)}`);
        }

        const blueprintData = blueprintResponse.data.response?.blueprint || blueprintResponse.data.blueprint || blueprintResponse.data;
        console.log(`✅ Fetched blueprint with ${blueprintData.flow ? blueprintData.flow.length : 0} modules`);

        // Save blueprint.json (the actual flow data)
        const blueprintPath = path.join(scenarioPath, 'blueprint.json');
        fs.writeFileSync(blueprintPath, JSON.stringify(blueprintData, null, 2), 'utf8');
        console.log(`💾 Saved blueprint to: ${blueprintPath}`);

        // Save metadata.json (scenario info)
        const metadataPath = path.join(scenarioPath, 'metadata.json');
        const metadata = {
            id: scenarioMetadata.id || scenarioId,
            name: scenarioMetadata.name,
            teamId: scenarioMetadata.teamId,
            folderId: scenarioMetadata.folderId,
            scheduling: scenarioMetadata.scheduling,
            created: scenarioMetadata.created || new Date().toISOString()
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        console.log(`💾 Saved metadata to: ${metadataPath}`);

        // Update deployment tracking
        updateMakeDeploymentTracking(scenarioPath, 'pull');

        // Open blueprint.json in Cursor
        const openPath = blueprintPath;

        // Use selected IDE instead of hardcoded Cursor
        const activeIDE = getActiveIDE();
        if (activeIDE) {
            const command = ideConfig.getOpenFileCommand(activeIDE, openPath);
            console.log(`Opening in ${ideConfig.getIDEConfig(activeIDE).name}: ${command}`);
            require('child_process').execSync(command, { stdio: 'pipe' });
            console.log(`✅ Opened ${path.basename(openPath)} in ${ideConfig.getIDEConfig(activeIDE).name}`);
        } else {
            console.log(`⚠️ No active IDE configured. Falling back to system default for ${openPath}`);
            try {
                require('child_process').execSync(`open "${openPath}"`, { stdio: 'pipe' });
                console.log('✅ Opened with system default');
            } catch (openErr) {
                console.log(`❌ Fallback open failed: ${openErr.message}`);
            }
        }

        res.json({
            success: true,
            message: `Scenario ${scenarioId} pulled successfully`,
            scenarioName: scenarioMetadata.name,
            localPath: scenarioPath,
            filesCreated: ['blueprint.json', 'metadata.json'],
            openedFile: blueprintPath,
            moduleCount: blueprintData.flow ? blueprintData.flow.length : 0
        });
    } catch (error) {
        console.error(`❌ Make pull error:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to pull scenario: ${error.message}`
        });
    }
});

// Trigger clasp login to fix permissions
app.post('/api/clasp/login', async (req, res) => {
    console.log('Initiating clasp login...');
    console.log('Please check your browser for the authentication window.');

    const workspacePath = GLOBAL_WORKSPACE_PATH;

    try {
        const { spawn } = require('child_process');

        // Run clasp login
        // We use --no-localhost to copy-paste code if needed, but standard login is better for UX if it opens browser
        // Let's try standard login first.
        const loginProcess = spawn('npx', ['clasp', 'login', '--status'], { // Check status first? No, force login.
            cwd: workspacePath,
            stdio: 'inherit', // Inherit stdio so it can interact if running in terminal, but here we are in background...
            // Wait, if we use 'inherit', it goes to the server's terminal (which the user sees).
            // If we want to capture output, we use pipe.
        });

        // Actually, we want to run 'clasp login' which is interactive. 
        // Since we can't easily proxy stdin/stdout to the web UI for an interactive CLI,
        // and 'clasp login' usually just opens a browser, let's hope it just opens the browser.
        // However, if it prompts "authorize? y/n", we are stuck.
        // Using 'yes | npx clasp login' might work for the prompt.

        // Better approach: User is on Mac. 
        // 'npx clasp login' opens browser.

        // We will execute it and immediately return success, telling the user to check their terminal/browser.
        // We won't wait for it to finish because it blocks.

        const login = spawn('npx', ['clasp', 'login'], {
            cwd: workspacePath,
            stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent waiting for input
            detached: true // Let it run independently
        });

        login.unref();

        res.json({
            success: true,
            message: 'Authentication flow started. Please check your browser and terminal. ensure you GRANT ALL PERMISSIONS (especially Drive).'
        });

    } catch (err) {
        console.error('Error starting clasp login:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post('/api/make/scenarios/:id/push', authenticateToken, async (req, res) => {
    const scenarioId = req.params.id;

    console.log(`📤 [MAKE PUSH] Route hit for scenario ID: ${scenarioId}`);
    console.log(`📤 [MAKE PUSH] Request params:`, req.params);
    console.log(`📤 [MAKE PUSH] Request body:`, req.body);

    try {
        console.log(`📤 [MAKE PUSH] Pushing Make scenario ${scenarioId}...`);

        const workspacePath = GLOBAL_WORKSPACE_PATH;
        const makeScenariosDir = path.join(workspacePath, 'make-scenarios', 'scenarios');
        const scenarioPath = path.join(makeScenariosDir, scenarioId);

        // Check if scenario exists locally
        if (!fs.existsSync(scenarioPath)) {
            return res.status(404).json({
                success: false,
                error: `Scenario ${scenarioId} not found locally. Please pull it first.`
            });
        }

        // Check if blueprint.json exists
        const blueprintPath = path.join(scenarioPath, 'blueprint.json');
        if (!fs.existsSync(blueprintPath)) {
            return res.status(404).json({
                success: false,
                error: `blueprint.json not found for scenario ${scenarioId}. Please pull it first.`
            });
        }

        // Read the local blueprint
        const blueprintData = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
        console.log(`📖 Read local blueprint with ${blueprintData.flow ? blueprintData.flow.length : 0} modules`);

        // Validate modules before pushing
        const moduleValidation = {
            modules: [],
            issues: []
        };

        if (blueprintData.flow && Array.isArray(blueprintData.flow)) {
            console.log(`🔍 Validating modules in blueprint...`);

            // Extract all modules with their details
            blueprintData.flow.forEach((module, index) => {
                if (module.module && module.version) {
                    moduleValidation.modules.push({
                        position: index + 1,
                        id: module.id,
                        module: module.module,
                        version: module.version,
                        name: module.metadata?.designer?.name || `Module ${index + 1}`
                    });
                }
            });

            // Group by module name to find version inconsistencies
            const moduleGroups = {};
            moduleValidation.modules.forEach(mod => {
                if (!moduleGroups[mod.module]) {
                    moduleGroups[mod.module] = [];
                }
                moduleGroups[mod.module].push(mod);
            });

            // Check for version inconsistencies
            Object.keys(moduleGroups).forEach(moduleName => {
                const versions = [...new Set(moduleGroups[moduleName].map(m => m.version))];
                if (versions.length > 1) {
                    moduleValidation.issues.push({
                        type: 'version_inconsistency',
                        module: moduleName,
                        message: `Module '${moduleName}' has multiple versions: ${versions.join(', ')}`,
                        occurrences: moduleGroups[moduleName].length
                    });
                }
            });

            // Log summary
            const uniqueModules = Object.keys(moduleGroups);
            console.log(`📋 Found ${moduleValidation.modules.length} modules using ${uniqueModules.length} unique module types:`);
            uniqueModules.forEach(moduleName => {
                const versions = [...new Set(moduleGroups[moduleName].map(m => m.version))];
                const count = moduleGroups[moduleName].length;
                console.log(`   - ${moduleName}: ${count} occurrence(s), version(s): ${versions.join(', ')}`);
            });

            if (moduleValidation.issues.length > 0) {
                console.log(`⚠️ Found ${moduleValidation.issues.length} potential issues:`);
                moduleValidation.issues.forEach(issue => {
                    console.log(`   - ${issue.message}`);
                });
            }
        }

        // Get API token and determine API base URL (same logic as pull)
        const apiToken = getMakeApiToken(req);
        if (!apiToken) {
            return res.status(401).json({
                success: false,
                error: 'Make.com API token not configured. Please set MAKE_API_TOKEN environment variable or create .make-config.json'
            });
        }

        // Try to get organization info to determine the correct zone (same as pull endpoint)
        let apiBase = 'https://eu1.make.celonis.com'; // Default to user's known zone
        let organizationId = null;
        try {
            const orgsResponse = await axios.get('https://eu1.make.com/api/v2/organizations', {
                headers: { 'Authorization': `Token ${apiToken}` },
                timeout: 5000,
                validateStatus: () => true
            });

            if (orgsResponse.status === 200 && orgsResponse.data?.organizations?.[0]) {
                const org = orgsResponse.data.organizations[0];
                if (org.zone) {
                    const zone = org.zone;
                    apiBase = zone.includes('.') ? `https://${zone}` : `https://${zone}.make.com`;
                    console.log(`   Using API base from org zone: ${apiBase}`);
                }
                if (org.id) {
                    organizationId = org.id;
                    console.log(`📋 Found organizationId from API: ${organizationId}`);
                }
            }
        } catch (e) {
            console.log(`   Using default API base: ${apiBase}`);
        }

        // Read metadata to get teamId if available
        let teamId = null;
        const metadataPath = path.join(scenarioPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                teamId = metadata.teamId;
                console.log(`📋 Found teamId from metadata: ${teamId}`);
            } catch (e) {
                console.log(`⚠️ Could not read metadata: ${e.message}`);
            }
        }

        // Push the blueprint to Make.com using PATCH
        console.log(`📡 Pushing blueprint to Make.com API...`);
        console.log(`   API Base: ${apiBase}`);
        console.log(`   Scenario ID: ${scenarioId}`);
        console.log(`   Team ID: ${teamId || 'none'}`);
        console.log(`   Organization ID: ${organizationId || 'none'}`);
        console.log(`   Blueprint keys: ${Object.keys(blueprintData).join(', ')}`);

        // Prepare payload - Make.com API might expect just the flow array, or wrapped in blueprint
        // First, try sending just the flow array (most common format)
        let payload = blueprintData.flow || blueprintData;

        // Build query parameters - try organizationId first, then teamId
        let queryParams = {};
        if (organizationId) {
            queryParams.organizationId = organizationId;
        } else if (teamId) {
            queryParams.teamId = teamId;
        }

        try {
            // Try multiple endpoint variations and payload formats
            console.log(`📡 Attempting to push blueprint...`);

            // Strategy 1: PATCH /api/v2/scenarios/{id}/blueprint with flow array
            let pushResponse = await axios.patch(`${apiBase}/api/v2/scenarios/${scenarioId}/blueprint`, payload, {
                headers: {
                    'Authorization': `Token ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                params: queryParams,
                timeout: 30000,
                validateStatus: () => true
            });

            console.log(`📡 Strategy 1 (PATCH /blueprint with flow): ${pushResponse.status}`);

            // If 404, try alternative endpoints
            if (pushResponse.status === 404) {
                console.log(`🔄 Trying alternative endpoint: PATCH /api/v2/scenarios/{id} with blueprint field...`);

                // Strategy 2: PATCH the scenario itself with blueprint field
                // CRITICAL: Make.com API requires blueprint to be a JSON STRING, not an object!
                // The error message was: "Invalid json string in parameter 'blueprint'. Value has to be string."

                // Prepare blueprint as JSON string - try with full blueprint object first
                const blueprintString = JSON.stringify(blueprintData);

                pushResponse = await axios.patch(`${apiBase}/api/v2/scenarios/${scenarioId}`, {
                    blueprint: blueprintString
                }, {
                    headers: {
                        'Authorization': `Token ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: queryParams,
                    timeout: 30000,
                    validateStatus: () => true
                });

                console.log(`📡 Strategy 2 (PATCH /scenarios/{id} with blueprint as JSON string): ${pushResponse.status}`);

                // Check if the error is about module not found (IM007) - provide detailed information
                if (pushResponse.status === 400 && pushResponse.data?.code === 'IM007') {
                    const errorDetail = pushResponse.data.detail || '';
                    console.log(`⚠️ Module validation error (IM007): ${errorDetail}`);

                    // Extract module name and version from error message
                    const moduleMatch = errorDetail.match(/Module not found '([^']+)' version '(\d+)'/);
                    let problematicModules = [];
                    let moduleName = null;
                    let version = null;

                    if (moduleMatch) {
                        [, moduleName, version] = moduleMatch;
                        console.log(`   ❌ Problematic module: ${moduleName} version ${version}`);

                        // Find all occurrences of this module in the blueprint
                        problematicModules = moduleValidation.modules.filter(m =>
                            m.module === moduleName && m.version.toString() === version
                        );

                        if (problematicModules.length > 0) {
                            console.log(`   📍 Found ${problematicModules.length} occurrence(s) of this module:`);
                            problematicModules.forEach(mod => {
                                console.log(`      - Position ${mod.position}: ${mod.name} (ID: ${mod.id})`);
                            });

                            // Suggest fixes
                            console.log(`   💡 Suggestions:`);
                            console.log(`      1. Check if the '${moduleName.split(':')[0]}' app is installed in your Make.com account`);
                            console.log(`      2. Verify the module name - it might be different (e.g., 'gmail:watchEmail' instead of 'gmail:watchEmails')`);
                            console.log(`      3. Create the scenario manually in Make.com first, then pull it to get the correct module structure`);
                            console.log(`      4. Ensure the app connection is set up (e.g., Gmail connection must be authorized)`);
                            console.log(`      5. Check if the module requires a subscription or special permissions`);
                        }
                    }

                    // Return a detailed error to the user
                    return res.status(400).json({
                        success: false,
                        error: `Module validation failed: ${errorDetail}`,
                        code: 'IM007',
                        moduleValidation: {
                            modules: moduleValidation.modules,
                            issues: moduleValidation.issues,
                            problematicModule: moduleMatch ? {
                                name: moduleName,
                                version: version,
                                occurrences: problematicModules.length
                            } : null
                        },
                        suggestions: [
                            `Check if the module '${moduleName || 'unknown'}' is available in your Make.com account`,
                            `Verify the module version - the API might not support version ${version || 'unknown'}`,
                            `Try re-pulling the scenario from Make.com to get the correct module versions`,
                            `Check if the module requires a subscription or special permissions`
                        ]
                    });
                }

                if (pushResponse.status !== 200 && pushResponse.status !== 204) {
                    console.log(`   Error details: ${JSON.stringify(pushResponse.data).substring(0, 300)}`);

                    // If that fails with metadata error, ensure we include metadata
                    if (pushResponse.status === 400 && pushResponse.data?.suberrors?.[0]?.message?.includes('metadata')) {
                        // Strategy 2b: Include metadata (required by API)
                        const blueprintWithMetadata = {
                            flow: blueprintData.flow || payload,
                            metadata: blueprintData.metadata || {}
                        };
                        const blueprintStringWithMetadata = JSON.stringify(blueprintWithMetadata);

                        pushResponse = await axios.patch(`${apiBase}/api/v2/scenarios/${scenarioId}`, {
                            blueprint: blueprintStringWithMetadata
                        }, {
                            headers: {
                                'Authorization': `Token ${apiToken}`,
                                'Content-Type': 'application/json'
                            },
                            params: queryParams,
                            timeout: 30000,
                            validateStatus: () => true
                        });

                        console.log(`📡 Strategy 2b (PATCH /scenarios/{id} with flow + metadata as JSON string): ${pushResponse.status}`);
                        if (pushResponse.status !== 200 && pushResponse.status !== 204) {
                            console.log(`   Error details: ${JSON.stringify(pushResponse.data).substring(0, 300)}`);
                        }
                    }
                }
            }

            // If still 404, try PUT instead of PATCH
            if (pushResponse.status === 404) {
                console.log(`🔄 Trying PUT method instead of PATCH...`);

                pushResponse = await axios.put(`${apiBase}/api/v2/scenarios/${scenarioId}/blueprint`, payload, {
                    headers: {
                        'Authorization': `Token ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: queryParams,
                    timeout: 30000,
                    validateStatus: () => true
                });

                console.log(`📡 Strategy 3 (PUT /blueprint): ${pushResponse.status}`);
            }

            // If still 404, try with full blueprint object wrapped
            if (pushResponse.status === 404) {
                console.log(`🔄 Trying with full blueprint object...`);

                pushResponse = await axios.patch(`${apiBase}/api/v2/scenarios/${scenarioId}/blueprint`, {
                    blueprint: blueprintData
                }, {
                    headers: {
                        'Authorization': `Token ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: queryParams,
                    timeout: 30000,
                    validateStatus: () => true
                });

                console.log(`📡 Strategy 4 (PATCH /blueprint with wrapped blueprint): ${pushResponse.status}`);
            }

            // If still failing, try with both organizationId and teamId
            if (pushResponse.status !== 200 && pushResponse.status !== 204 && organizationId && teamId) {
                console.log(`🔄 Trying with both organizationId and teamId...`);

                pushResponse = await axios.patch(`${apiBase}/api/v2/scenarios/${scenarioId}/blueprint`, payload, {
                    headers: {
                        'Authorization': `Token ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: { organizationId, teamId },
                    timeout: 30000,
                    validateStatus: () => true
                });

                console.log(`📡 Strategy 5 (with both params): ${pushResponse.status}`);
            }

            if (pushResponse.status !== 200 && pushResponse.status !== 204) {
                console.error(`❌ All strategies failed. Final status: ${pushResponse.status}`);
                console.error(`   Response data:`, JSON.stringify(pushResponse.data).substring(0, 500));
                throw new Error(`Failed to push blueprint: ${pushResponse.status} ${JSON.stringify(pushResponse.data).substring(0, 200)}`);
            }
        } catch (axiosError) {
            if (axiosError.response) {
                console.error(`❌ Axios error - Status: ${axiosError.response.status}`);
                console.error(`   Response data:`, JSON.stringify(axiosError.response.data).substring(0, 500));
                throw new Error(`Failed to push blueprint: ${axiosError.response.status} ${JSON.stringify(axiosError.response.data).substring(0, 200)}`);
            } else {
                console.error(`❌ Network/Request error:`, axiosError.message);
                throw axiosError;
            }
        }

        console.log(`✅ Successfully pushed blueprint to Make.com`);

        // Update deployment tracking
        updateMakeDeploymentTracking(scenarioPath, 'push');

        res.json({
            success: true,
            message: `Scenario ${scenarioId} pushed successfully`,
            scenarioId: scenarioId,
            moduleCount: blueprintData.flow ? blueprintData.flow.length : 0
        });
    } catch (error) {
        console.error(`❌ [MAKE PUSH] Error for scenario ${scenarioId}:`, error);
        console.error(`❌ [MAKE PUSH] Error stack:`, error.stack);
        console.error(`❌ [MAKE PUSH] Error message:`, error.message);
        res.status(500).json({
            success: false,
            error: `Failed to push scenario ${scenarioId}: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper function to update Make deployment tracking (similar to Apps Script)
function updateMakeDeploymentTracking(scenarioPath, operation) {
    console.log(`🔧 updateMakeDeploymentTracking called: ${scenarioPath}, operation: ${operation}`);

    // Ensure scenario directory exists
    if (!fs.existsSync(scenarioPath)) {
        fs.mkdirSync(scenarioPath, { recursive: true });
    }

    const trackingFile = path.join(scenarioPath, '.make-deployer.json');
    console.log(`📁 Tracking file: ${trackingFile}`);

    let trackingData = {};
    if (fs.existsSync(trackingFile)) {
        try {
            trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
            console.log(`📖 Read existing data:`, trackingData);
        } catch (error) {
            // Reset tracking data if corrupted
            console.log(`❌ Error reading tracking file:`, error);
            trackingData = {};
        }
    } else {
        console.log(`📝 Tracking file does not exist, creating new one`);
    }

    const now = new Date().toISOString();
    console.log(`🕒 Current timestamp: ${now}`);

    if (operation === 'push') {
        trackingData.lastPush = now;
        console.log(`📤 Setting lastPush: ${now}`);
    } else if (operation === 'pull') {
        trackingData.lastPull = now;
        console.log(`📥 Setting lastPull: ${now}`);
    }

    try {
        fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));
        console.log(`✅ Successfully wrote tracking data:`, trackingData);
    } catch (error) {
        console.error('❌ Failed to update deployment tracking:', error);
    }
}

// Update project metadata
app.post('/api/project/metadata', (req, res) => {
    const { projectName, sheetUrl } = req.body;
    const fs = require('fs'); // Ensure fs is imported here
    const path = require('path'); // Ensure path is imported here

    if (!projectName) {
        return res.status(400).json({ success: false, error: 'Project name is required' });
    }

    const workspacePath = GLOBAL_WORKSPACE_PATH;
    const projectDir = path.join(workspacePath, 'scripts', projectName);
    const trackingFile = path.join(projectDir, '.clasp-deployer.json');

    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }

    try {
        let trackingData = {};

        if (fs.existsSync(trackingFile)) {
            try {
                trackingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
            } catch (e) {
                // If file exists but is invalid, start with empty object
                console.warn('Invalid tracking file, creating new one');
            }
        } else {
            // Try to recover scriptId from .clasp.json if tracking file is missing
            const claspFile = path.join(projectDir, '.clasp.json');
            if (fs.existsSync(claspFile)) {
                try {
                    const claspData = JSON.parse(fs.readFileSync(claspFile, 'utf8'));
                    trackingData.scriptId = claspData.scriptId;
                } catch (e) { }
            }
        }

        // Update fields
        if (sheetUrl !== undefined) {
            trackingData.sheetUrl = sheetUrl;
        }

        // Ensure created timestamp exists if it's a new file
        if (!trackingData.created) {
            trackingData.created = new Date().toISOString();
        }

        fs.writeFileSync(trackingFile, JSON.stringify(trackingData, null, 2));

        res.json({
            success: true,
            message: 'Project metadata updated successfully',
            data: trackingData
        });
    } catch (error) {
        console.error('Error updating metadata:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
if (require.main === module) {
    const server = app.listen(port, () => {
        console.log(`🚀 ScriptFlow Server running at http://localhost:${port} (PID: ${process.pid})`);
        console.log(`📱 Open your browser and navigate to the URL above`);
        console.log(`❌ Close this terminal to stop the server`);
        console.log(`🔄 Server started at: ${new Date().toISOString()}`);
    });

    // Force close on exit
    process.on('SIGINT', () => {
        console.log('Shutting down server...');
        server.close(() => {
            process.exit(0);
        });
    });
}

module.exports = app;
