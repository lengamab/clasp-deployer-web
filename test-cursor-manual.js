#!/usr/bin/env node

/**
 * Manual test: Open Code.js file in Cursor
 * Run this to verify the file opening works correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function manualTest() {
    const filePath = '/Users/bricelengama/Documents/Marketing Opti/Cursor/scripts/BPO_Weekly_Offenders/Code.js';

    console.log('🧪 MANUAL TEST: Opening Code.js in Cursor\n');

    console.log('File to open:', filePath);
    console.log('Command: open -a "Cursor" "' + filePath + '"\n');

    try {
        execSync('open -a "Cursor" "' + filePath + '"', { stdio: 'inherit' });
        console.log('✅ Command executed successfully!');
        console.log('📝 Check if Cursor opened the file with actual content (not empty)');

    } catch (error) {
        console.log('❌ Command failed:', error.message);
        console.log('🔄 Trying direct cursor command...');

        try {
            execSync('cursor "' + filePath + '"', { stdio: 'inherit' });
            console.log('✅ Direct cursor command succeeded!');
        } catch (directError) {
            console.log('❌ Direct cursor command also failed:', directError.message);
        }
    }
}

manualTest();




