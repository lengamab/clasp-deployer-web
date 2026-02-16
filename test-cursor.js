// Test script to check if cursor command works
const { execSync } = require('child_process');
const path = require('path');

const testPath = '/Users/bricelengama/Documents/Marketing Opti/Cursor/scripts/BPO_Weekly_Offenders/Code.js';

console.log('Testing cursor command...');
console.log(`Test path: ${testPath}`);
console.log(`Path exists: ${require('fs').existsSync(testPath)}`);

try {
    console.log('Executing: cursor "' + testPath + '"');
    execSync(`cursor "${testPath}"`, {
        stdio: 'pipe',
        timeout: 5000,
        env: process.env
    });
    console.log('SUCCESS: Cursor command executed');
} catch (error) {
    console.log('FAILED: Cursor command failed');
    console.log('Error:', error.message);
    console.log('Code:', error.code);
    console.log('Signal:', error.signal);
}



