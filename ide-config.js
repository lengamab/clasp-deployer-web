#!/usr/bin/env node

/**
 * IDE Configuration Module
 * Manages IDE detection, configuration, and command generation for opening files/folders
 * Supports: VS Code, Cursor, Antigravity, JetBrains, Sublime, Vim, Visual Studio, Zed
 */

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Supported IDE configurations
 * Each IDE has:
 * - name: Display name
 * - id: Unique identifier
 * - executable: Command/app name to check for installation
 * - openFolder: Function to generate command for opening a folder
 * - openFile: Function to generate command for opening a file
 * - platforms: Array of supported platforms (darwin, linux, win32)
 * - detectCommand: Optional custom command to detect if IDE is installed
 */
const IDE_CONFIGS = {
    'vscode': {
        name: 'Visual Studio Code',
        id: 'vscode',
        executable: 'code',
        openFolder: (folderPath) => `code "${folderPath}"`,
        openFile: (filePath) => `code "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which code';
            if (platform === 'linux') return 'which code';
            if (platform === 'win32') return 'where code';
            return null;
        }
    },
    'cursor': {
        name: 'Cursor',
        id: 'cursor',
        executable: 'Cursor',
        openFolder: (folderPath) => {
            const platform = os.platform();
            if (platform === 'darwin') return `open -a "Cursor" "${folderPath}"`;
            if (platform === 'win32') return `start "" "Cursor" "${folderPath}"`;
            return `cursor "${folderPath}"`; // Linux fallback
        },
        openFile: (filePath) => {
            const platform = os.platform();
            if (platform === 'darwin') return `open -a "Cursor" "${filePath}"`;
            if (platform === 'win32') return `start "" "Cursor" "${filePath}"`;
            return `cursor "${filePath}"`; // Linux fallback
        },
        platforms: ['darwin', 'win32', 'linux'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'mdfind "kMDItemKind == Application && kMDItemFSName == Cursor.app"';
            if (platform === 'win32') return 'where cursor';
            return 'which cursor';
        }
    },
    'antigravity': {
        name: 'Antigravity',
        id: 'antigravity',
        executable: 'Antigravity',
        openFolder: (folderPath) => {
            const platform = os.platform();
            if (platform === 'darwin') return `open -a "Antigravity" "${folderPath}"`;
            if (platform === 'win32') return `start "" "Antigravity" "${folderPath}"`;
            return `antigravity "${folderPath}"`;
        },
        openFile: (filePath) => {
            const platform = os.platform();
            if (platform === 'darwin') return `open -a "Antigravity" "${filePath}"`;
            if (platform === 'win32') return `start "" "Antigravity" "${filePath}"`;
            return `antigravity "${filePath}"`;
        },
        platforms: ['darwin', 'win32', 'linux'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'mdfind "kMDItemKind == Application && kMDItemFSName == Antigravity.app"';
            if (platform === 'win32') return 'where antigravity';
            return 'which antigravity';
        }
    },
    'webstorm': {
        name: 'WebStorm',
        id: 'webstorm',
        executable: 'webstorm',
        openFolder: (folderPath) => `webstorm "${folderPath}"`,
        openFile: (filePath) => `webstorm "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which webstorm';
            if (platform === 'linux') return 'which webstorm';
            if (platform === 'win32') return 'where webstorm';
            return null;
        }
    },
    'intellij': {
        name: 'IntelliJ IDEA',
        id: 'intellij',
        executable: 'idea',
        openFolder: (folderPath) => `idea "${folderPath}"`,
        openFile: (filePath) => `idea "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which idea';
            if (platform === 'linux') return 'which idea';
            if (platform === 'win32') return 'where idea';
            return null;
        }
    },
    'pycharm': {
        name: 'PyCharm',
        id: 'pycharm',
        executable: 'pycharm',
        openFolder: (folderPath) => `pycharm "${folderPath}"`,
        openFile: (filePath) => `pycharm "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which pycharm';
            if (platform === 'linux') return 'which pycharm';
            if (platform === 'win32') return 'where pycharm';
            return null;
        }
    },
    'sublime': {
        name: 'Sublime Text',
        id: 'sublime',
        executable: 'subl',
        openFolder: (folderPath) => `subl "${folderPath}"`,
        openFile: (filePath) => `subl "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which subl';
            if (platform === 'linux') return 'which subl';
            if (platform === 'win32') return 'where subl';
            return null;
        }
    },
    'vim': {
        name: 'Vim',
        id: 'vim',
        executable: 'vim',
        openFolder: (folderPath) => `vim "${folderPath}"`,
        openFile: (filePath) => `vim "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: () => 'which vim'
    },
    'neovim': {
        name: 'Neovim',
        id: 'neovim',
        executable: 'nvim',
        openFolder: (folderPath) => `nvim "${folderPath}"`,
        openFile: (filePath) => `nvim "${filePath}"`,
        platforms: ['darwin', 'linux', 'win32'],
        detectCommand: () => 'which nvim'
    },
    'zed': {
        name: 'Zed',
        id: 'zed',
        executable: 'zed',
        openFolder: (folderPath) => `zed "${folderPath}"`,
        openFile: (filePath) => `zed "${filePath}"`,
        platforms: ['darwin', 'linux'],
        detectCommand: (platform) => {
            if (platform === 'darwin') return 'which zed';
            if (platform === 'linux') return 'which zed';
            return null;
        }
    }
};

/**
 * Check if an IDE is installed on the current system
 * @param {string} ideId - The IDE identifier (e.g., 'vscode', 'cursor')
 * @returns {boolean} - True if IDE is installed
 */
function isIDEInstalled(ideId) {
    const ide = IDE_CONFIGS[ideId];
    if (!ide) return false;

    const platform = os.platform();
    if (!ide.platforms.includes(platform)) return false;

    try {
        const detectCmd = ide.detectCommand ? ide.detectCommand(platform) : `which ${ide.executable}`;
        if (!detectCmd) return false;

        const result = execSync(detectCmd, { stdio: 'pipe', encoding: 'utf-8' });
        return result && result.trim().length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Get all installed IDEs on the current system
 * @returns {Array} - Array of installed IDE configurations
 */
function getInstalledIDEs() {
    const platform = os.platform();
    const installed = [];

    for (const [ideId, config] of Object.entries(IDE_CONFIGS)) {
        if (config.platforms.includes(platform) && isIDEInstalled(ideId)) {
            installed.push({
                id: config.id,
                name: config.name,
                installed: true
            });
        }
    }

    return installed;
}

/**
 * Get all available IDEs (installed + not installed)
 * @returns {Array} - Array of all IDE configurations with installation status
 */
function getAllIDEs() {
    const platform = os.platform();
    const all = [];

    for (const [ideId, config] of Object.entries(IDE_CONFIGS)) {
        if (config.platforms.includes(platform)) {
            all.push({
                id: config.id,
                name: config.name,
                installed: isIDEInstalled(ideId)
            });
        }
    }

    // Sort: installed first, then by name
    all.sort((a, b) => {
        if (a.installed && !b.installed) return -1;
        if (!a.installed && b.installed) return 1;
        return a.name.localeCompare(b.name);
    });

    return all;
}

/**
 * Get the command to open a folder in the specified IDE
 * @param {string} ideId - The IDE identifier
 * @param {string} folderPath - Path to folder to open
 * @returns {string|null} - Command to execute, or null if IDE not found
 */
function getOpenFolderCommand(ideId, folderPath) {
    const ide = IDE_CONFIGS[ideId];
    if (!ide) return null;
    return ide.openFolder(folderPath);
}

/**
 * Get the command to open a file in the specified IDE
 * @param {string} ideId - The IDE identifier
 * @param {string} filePath - Path to file to open
 * @returns {string|null} - Command to execute, or null if IDE not found
 */
function getOpenFileCommand(ideId, filePath) {
    const ide = IDE_CONFIGS[ideId];
    if (!ide) return null;
    return ide.openFile(filePath);
}

/**
 * Auto-detect the best IDE to use (prioritizes: VSCode > Cursor > Antigravity > others)
 * @returns {string|null} - IDE id of the best available IDE, or null if none found
 */
function autoDetectIDE() {
    // Priority order for auto-detection
    const priority = ['vscode', 'cursor', 'antigravity', 'webstorm', 'sublime', 'intellij', 'zed'];

    for (const ideId of priority) {
        if (isIDEInstalled(ideId)) {
            return ideId;
        }
    }

    // Fallback: return first installed IDE
    const installed = getInstalledIDEs();
    return installed.length > 0 ? installed[0].id : null;
}

/**
 * Get IDE configuration by ID
 * @param {string} ideId - The IDE identifier
 * @returns {object|null} - IDE configuration object, or null if not found
 */
function getIDEConfig(ideId) {
    return IDE_CONFIGS[ideId] || null;
}

module.exports = {
    IDE_CONFIGS,
    isIDEInstalled,
    getInstalledIDEs,
    getAllIDEs,
    getOpenFolderCommand,
    getOpenFileCommand,
    autoDetectIDE,
    getIDEConfig
};
