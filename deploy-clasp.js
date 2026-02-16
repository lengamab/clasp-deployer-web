#!/usr/bin/env node

/**
 * CLASP Environment Deployer
 * Efficiently deploys Google Apps Script projects in Cursor
 * Prompts for script URL and handles all setup automatically
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function parseScriptUrl(url) {
  // Handle various Google Apps Script URL formats
  const patterns = [
    // Standard editor URL: https://script.google.com/d/SCRIPT_ID/edit
    /https:\/\/script\.google\.com\/d\/([a-zA-Z0-9_-]+)\/edit/,
    // Project URL without /edit: https://script.google.com/d/SCRIPT_ID
    /https:\/\/script\.google\.com\/d\/([a-zA-Z0-9_-]+)/,
    // Exec URL: https://script.google.com/macros/s/SCRIPT_ID/exec
    /https:\/\/script\.google\.com\/macros\/s\/([a-zA-Z0-9_-]+)\/exec/,
    // Dev URL: https://script.google.com/macros/s/SCRIPT_ID/dev
    /https:\/\/script\.google\.com\/macros\/s\/([a-zA-Z0-9_-]+)\/dev/,
    // Direct script ID (alphanumeric with dashes/underscores)
    /^([a-zA-Z0-9_-]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function listExistingProjects() {
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const projects = [];

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
            projects.push({
              name: item,
              path: itemPath,
              scriptId: claspConfig.scriptId,
              projectId: claspConfig.projectId
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

  return projects;
}

function findExistingProject(scriptId) {
  const projects = listExistingProjects();
  return projects.find(project => project.scriptId === scriptId);
}

async function refreshExistingProject(projectPath, projectName) {
  info(`Refreshing existing project: ${projectName}`);

  try {
    // Change to project directory and pull latest changes
    execSync(`cd "${projectPath}" && npx clasp pull`, { stdio: 'inherit' });
    success(`Successfully refreshed ${projectName}`);

    // Open in Cursor
    await openInCursor(projectPath);

    return true;
  } catch (pullErr) {
    warning(`Could not refresh ${projectName}: ${pullErr.message}`);
    return false;
  }
}

async function openInCursor(projectPath) {
  try {
    // Try to open in Cursor using the 'cursor' command
    execSync(`cursor "${projectPath}"`, { stdio: 'pipe' });
    info(`Opened ${path.basename(projectPath)} in Cursor`);
  } catch (cursorErr) {
    // Fallback: try opening with default editor
    try {
      execSync(`open "${projectPath}"`, { stdio: 'pipe' });
      info(`Opened ${path.basename(projectPath)} in default editor`);
    } catch (openErr) {
      warning(`Could not open ${path.basename(projectPath)} in editor`);
    }
  }
}

async function showProjectMenu() {
  const projects = listExistingProjects();

  if (projects.length === 0) {
    info('No existing projects found.');
    return null;
  }

  log('', 'reset');
  info('Existing Projects:');
  projects.forEach((project, index) => {
    log(`  ${index + 1}. ${project.name} (${project.scriptId})`, 'cyan');
  });
  log(`  ${projects.length + 1}. Create new project`, 'green');
  log('', 'reset');

  const choice = await ask('Select a project to refresh (number) or create new: ');

  if (!choice || choice === (projects.length + 1).toString()) {
    return null; // Create new project
  }

  const projectIndex = parseInt(choice) - 1;
  if (projectIndex >= 0 && projectIndex < projects.length) {
    return projects[projectIndex];
  }

  return null;
}

async function checkClaspInstallation() {
  // First check if CLASP binary exists in node_modules
  const claspPath = path.join(__dirname, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
  if (fs.existsSync(claspPath)) {
    success('CLASP is available locally');
    return true;
  }

  // Try npx clasp command
  try {
    execSync('npx clasp --version', { stdio: 'pipe' });
    success('CLASP is available');
    return true;
  } catch (err) {
    warning('CLASP not found locally. Installing...');
    try {
      execSync('npm install @google/clasp --no-fund --no-audit', { stdio: 'pipe' });
      success('CLASP installed successfully');
      return true;
    } catch (installErr) {
      // Check again if it was installed despite the error
      if (fs.existsSync(claspPath)) {
        success('CLASP is available (was already installed)');
        return true;
      }
      error('Failed to install CLASP. It may already be installed globally.');
      info('Try: npm install @google/clasp');
      info('Or check if CLASP is available globally: clasp --version');
      return false;
    }
  }
}

async function checkClaspAuth() {
  try {
    execSync('npx clasp status', { stdio: 'pipe' });
    success('CLASP is authenticated');
    return true;
  } catch (err) {
    warning('CLASP not authenticated');
    info('Please complete authentication in your browser...');

    try {
      // Run clasp login in a way that allows user interaction
      const loginProcess = spawn('npx', ['clasp', 'login'], {
        stdio: 'inherit',
        shell: true
      });

      return new Promise((resolve) => {
        loginProcess.on('close', (code) => {
          if (code === 0) {
            success('Authentication successful');
            resolve(true);
          } else {
            error('Authentication failed');
            resolve(false);
          }
        });
      });
    } catch (loginErr) {
      error('Authentication failed. Please run: npx clasp login');
      return false;
    }
  }
}

function createClaspConfig(scriptId, projectName = null) {
  const claspConfig = {
    scriptId: scriptId,
    rootDir: ".",
    projectId: projectName ? projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') : undefined
  };

  // Remove undefined values
  Object.keys(claspConfig).forEach(key => {
    if (claspConfig[key] === undefined) {
      delete claspConfig[key];
    }
  });

  return claspConfig;
}

async function setupProject(scriptId, projectName) {
  const projectDir = path.join(__dirname, '..', 'scripts', projectName);

  // Create project directory if it doesn't exist
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
    success(`Created project directory: scripts/${projectName}`);
  }

  // Create .clasp.json
  const claspConfig = createClaspConfig(scriptId, projectName);
  const claspPath = path.join(projectDir, '.clasp.json');
  fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2));
  success('Created .clasp.json configuration');

  // Create basic appsscript.json if it doesn't exist
  const appsscriptPath = path.join(projectDir, 'appsscript.json');
  if (!fs.existsSync(appsscriptPath)) {
    const appsscriptConfig = {
      timeZone: "Europe/Madrid",
      dependencies: {},
      exceptionLogging: "STACKDRIVER",
      runtimeVersion: "V8"
    };
    fs.writeFileSync(appsscriptPath, JSON.stringify(appsscriptConfig, null, 2));
    success('Created appsscript.json configuration');
  }

  // Try to pull existing code
  try {
    info('Attempting to pull existing code from Apps Script...');
    execSync(`cd "${projectDir}" && npx clasp pull`, { stdio: 'inherit' });
    success('Successfully pulled existing code');
  } catch (pullErr) {
    warning('Could not pull existing code (this is normal for new projects)');
    info('Creating basic TypeScript setup...');

    // Create basic TypeScript files if pull failed
    const codePath = path.join(projectDir, 'Code.ts');
    if (!fs.existsSync(codePath)) {
      const basicCode = `/**
 * ${projectName} - Google Apps Script
 * Script ID: ${scriptId}
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('${projectName}')
    .addItem('Run Main Function', 'main')
    .addToUi();
}

function main() {
  Logger.log('Hello from ${projectName}!');
  // Add your main logic here
}

function testProject() {
  Logger.log('Testing ${projectName}...');
  main();
  Logger.log('Test completed successfully!');
}
`;
      fs.writeFileSync(codePath, basicCode);
      success('Created basic Code.ts file');
    }

    // Create basic config file
    const configPath = path.join(projectDir, 'config.ts');
    if (!fs.existsSync(configPath)) {
      const basicConfig = `/**
 * Configuration for ${projectName}
 */

export const config = {
  name: '${projectName}',
  scriptId: '${scriptId}',
  version: '1.0.0',
  // Add your configuration here
};
`;
      fs.writeFileSync(configPath, basicConfig);
      success('Created basic config.ts file');
    }
  }

  return projectDir;
}

async function main() {
  log('🚀 CLASP Environment Deployer', 'bright');
  log('================================', 'cyan');

  try {
    // Step 1: Check CLASP installation
    const claspInstalled = await checkClaspInstallation();
    if (!claspInstalled) {
      process.exit(1);
    }

    // Step 2: Check CLASP authentication
    const isAuthenticated = await checkClaspAuth();
    if (!isAuthenticated) {
      const continueAnyway = await ask('Continue without authentication? (y/N): ');
      if (continueAnyway.toLowerCase() !== 'y') {
        info('Please authenticate and try again.');
        rl.close();
        return;
      }
    }

    // Step 2.5: Show existing projects menu
    const existingProject = await showProjectMenu();

    if (existingProject) {
      // Refresh existing project
      log('', 'reset');
      log(`🔄 Refreshing existing project: ${existingProject.name}`, 'yellow');

      const refreshed = await refreshExistingProject(existingProject.path, existingProject.name);

      if (refreshed) {
        log('', 'reset');
        success(`✅ Project "${existingProject.name}" refreshed and opened in Cursor!`);
        log('', 'reset');
        info('Project location: scripts/' + existingProject.name);
        info('Script ID: ' + existingProject.scriptId);
      }

      rl.close();
      return;
    }

    // Step 3: Get script URL from user
    let scriptUrl = process.argv[2];
    if (!scriptUrl) {
      scriptUrl = await ask('Enter Google Apps Script URL or Script ID: ');
    }

    if (!scriptUrl) {
      error('No script URL provided');
      rl.close();
      return;
    }

    // Step 4: Parse script URL
    const scriptId = parseScriptUrl(scriptUrl);
    if (!scriptId) {
      error('Invalid script URL format. Please provide a valid Google Apps Script URL or Script ID.');
      info('Valid formats:');
      info('  - https://script.google.com/.../d/SCRIPT_ID/edit');
      info('  - https://script.google.com/.../d/SCRIPT_ID');
      info('  - SCRIPT_ID (direct ID)');
      rl.close();
      return;
    }

    success(`Extracted Script ID: ${scriptId}`);

    // Check if this script ID already exists
    const existingByScriptId = findExistingProject(scriptId);
    if (existingByScriptId) {
      warning(`Project "${existingByScriptId.name}" already exists for this Script ID.`);
      const refreshChoice = await ask('Would you like to refresh it instead? (y/N): ');
      if (refreshChoice.toLowerCase() === 'y') {
        await refreshExistingProject(existingByScriptId.path, existingByScriptId.name);
        success(`✅ Project "${existingByScriptId.name}" refreshed and opened in Cursor!`);
        rl.close();
        return;
      }
      info('Continuing with new project creation...');
    }

    // Step 5: Get project name
    let projectName = process.argv[3];
    if (!projectName) {
      projectName = await ask('Enter project name (leave empty for auto-generated): ');
    }

    if (!projectName) {
      // Generate project name from current date/time
      const now = new Date();
      projectName = `script-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
      info(`Auto-generated project name: ${projectName}`);
    }

    // Sanitize project name for folder
    const sanitizedName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (sanitizedName !== projectName) {
      info(`Sanitized project name to: ${sanitizedName}`);
    }

    // Step 6: Setup project
    const projectDir = await setupProject(scriptId, sanitizedName);

    // Step 7: Try to push initial setup (if authenticated)
    if (isAuthenticated) {
      try {
        info('Pushing initial setup to Apps Script...');
        execSync(`cd "${projectDir}" && npx clasp push`, { stdio: 'inherit' });
        success('Successfully pushed to Apps Script');
      } catch (pushErr) {
        warning('Could not push to Apps Script (might be a permission issue)');
      }
    }

    // Step 7.5: Open in Cursor
    await openInCursor(projectDir);

    // Step 8: Display success message and next steps
    log('', 'reset');
    success(`🎉 Project "${sanitizedName}" deployed successfully!`);
    log('', 'reset');
    info('Project location: scripts/' + sanitizedName);
    info('Script ID: ' + scriptId);
    log('', 'reset');
    info('Next steps:');
    info(`1. cd scripts/${sanitizedName}`);
    info('2. Customize Code.ts and config.ts');
    info('3. Run: npm run build && npx clasp push');
    info('4. Run: npx clasp open (to open in Apps Script editor)');
    log('', 'reset');
    info('Available commands for this project:');
    info(`  npm run ${sanitizedName.replace(/-/g, '')}:push    - Push changes`);
    info(`  npm run ${sanitizedName.replace(/-/g, '')}:pull    - Pull changes`);
    info(`  npm run ${sanitizedName.replace(/-/g, '')}:open    - Open in editor`);
    info(`  npm run ${sanitizedName.replace(/-/g, '')}:status  - Check status`);

  } catch (err) {
    error(`Deployment failed: ${err.message}`);
    console.error(err);
  } finally {
    rl.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Goodbye!', 'yellow');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { parseScriptUrl, createClaspConfig };
