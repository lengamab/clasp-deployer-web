#!/usr/bin/env node

/**
 * Create Desktop Shortcut for CLASP Deployer Web
 * Creates a desktop shortcut that opens the web app
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function createDesktopShortcut() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const appName = 'CLASP Deployer Web';
    const platform = os.platform();

    console.log(`Creating desktop shortcut for ${appName}...`);
    console.log(`Platform: ${platform}`);
    console.log(`Desktop path: ${desktopPath}`);

    try {
        if (platform === 'darwin') {
            // macOS - create shell script launcher
            createMacOSShortcut(desktopPath, appName);
        } else if (platform === 'win32') {
            // Windows - create batch file
            createWindowsShortcut(desktopPath, appName);
        } else {
            // Linux - create .desktop file
            createLinuxShortcut(desktopPath, appName);
        }

        console.log('✅ Desktop shortcut created successfully!');
        console.log(`🚀 Double-click "${appName}" on your desktop to launch the app`);
    } catch (error) {
        console.error('❌ Failed to create desktop shortcut:', error.message);
        console.log('You can still run the app with: npm run web:start');
    }
}

function createMacOSShortcut(desktopPath, appName) {
    // For macOS, create a shell script that starts the web server and opens browser
    const scriptPath = path.join(desktopPath, `${appName}.command`);
    const appDir = __dirname;

    const scriptContent = `#!/bin/bash
echo "🚀 Starting CLASP Deployer Web..."
cd "${appDir}"
npm start &
sleep 3
open http://localhost:3000
echo "✅ CLASP Deployer Web is running at http://localhost:8080"
echo "❌ Close this terminal to stop the server"
read -p "Press Enter to stop the server..."
kill %1
`;

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    console.log(`Created: ${scriptPath}`);
}

function createWindowsShortcut(desktopPath, appName) {
    // For Windows, create a batch file
    const scriptPath = path.join(desktopPath, `${appName}.bat`);
    const appDir = __dirname;

    const scriptContent = `@echo off
echo 🚀 Starting CLASP Deployer Web...
cd /d "${appDir}"
start npm start
timeout /t 3 /nobreak > nul
start http://localhost:8080
echo ✅ CLASP Deployer Web is running at http://localhost:8080
echo ❌ Close this window to stop the server
pause
`;

    fs.writeFileSync(scriptPath, scriptContent);
    console.log(`Created: ${scriptPath}`);
}

function createLinuxShortcut(desktopPath, appName) {
    // For Linux, create a .desktop file
    const desktopFile = path.join(desktopPath, `${appName}.desktop`);
    const appDir = __dirname;

    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${appName}
Comment=Efficient CLASP environment deployment - Web version
Exec=bash -c "cd '${appDir}' && npm start & sleep 3 && xdg-open http://localhost:3000"
Icon=web-browser
Terminal=false
StartupNotify=true
Categories=Development;Utility;
`;

    fs.writeFileSync(desktopFile, desktopContent);
    // Make executable
    fs.chmodSync(desktopFile, 0o755);
    console.log(`Created: ${desktopFile}`);
}

// Run if called directly
if (require.main === module) {
    createDesktopShortcut();
}

module.exports = { createDesktopShortcut };
