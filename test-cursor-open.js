#!/usr/bin/env node

/**
 * Test script to verify Cursor file opening functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function testCursorOpen() {
    const projectName = 'BPO_Weekly_Offenders';
    const workspacePath = '/Users/bricelengama/Documents/Marketing Opti/Cursor';
    const projectPath = path.join(workspacePath, 'scripts', projectName);
    const codeJsPath = path.join(projectPath, 'Code.js');

    console.log('🚀 Testing Cursor file opening functionality...\n');

    // Check if file exists and has content
    console.log('1. Checking file existence and content:');
    console.log(`   File: ${codeJsPath}`);

    if (!fs.existsSync(codeJsPath)) {
        console.log('   ❌ File does not exist!');
        return;
    }

    const stats = fs.statSync(codeJsPath);
    const lines = fs.readFileSync(codeJsPath, 'utf8').split('\n').length;

    console.log(`   ✅ File exists: ${stats.size} bytes, ${lines} lines`);
    console.log(`   📅 Last modified: ${stats.mtime.toLocaleString()}\n`);

    // Test the open command
    console.log('2. Testing open command:');
    const openPath = codeJsPath;
    console.log(`   Command: open -a "Cursor" "${openPath}"`);

    try {
        execSync(`open -a "Cursor" "${openPath}"`, { stdio: 'pipe' });
        console.log('   ✅ Command executed successfully\n');

        console.log('3. Expected behavior:');
        console.log('   - Cursor should open (or focus existing window)');
        console.log('   - File should open with actual content (not empty)');
        console.log('   - You should see the JavaScript code in the editor\n');

        console.log('4. If it still opens empty files:');
        console.log('   - Close all Cursor windows completely');
        console.log('   - Run this test again');
        console.log('   - Or manually open the file in Cursor first, then run this test\n');

    } catch (error) {
        console.log(`   ❌ Command failed: ${error.message}\n`);
        console.log('   Trying fallback with system open...');

        try {
            execSync(`open "${openPath}"`, { stdio: 'pipe' });
            console.log('   ✅ Fallback system open succeeded');
        } catch (fallbackError) {
            console.log(`   ❌ Fallback also failed: ${fallbackError.message}`);
        }
    }
}

// Run the test
testCursorOpen();




