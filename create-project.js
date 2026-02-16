#!/usr/bin/env node

/**
 * Project creation script for GAS development
 * Usage: node create-project.js "My Project Name"
 */

const fs = require('fs');
const path = require('path');

const projectName = process.argv[2];

if (!projectName) {
  console.log('❌ Please provide a project name:');
  console.log('   node create-project.js "My Project Name"');
  process.exit(1);
}

// Convert to kebab-case for folder name
const folderName = projectName
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-');

const templateDir = path.join(__dirname, '..', 'scripts', 'project-template');
const newProjectDir = path.join(__dirname, '..', 'scripts', folderName);

try {
  // Copy template
  copyFolderRecursive(templateDir, newProjectDir);

  // Update project name in config
  const configPath = path.join(newProjectDir, 'config.ts');
  let configContent = fs.readFileSync(configPath, 'utf8');
  configContent = configContent.replace(
    "name: 'New Project'",
    `name: '${projectName}'`
  );
  fs.writeFileSync(configPath, configContent);

  console.log('✅ Project created successfully!');
  console.log(`📁 Location: scripts/${folderName}`);
  console.log(`📝 Name: ${projectName}`);
  console.log('');
  console.log('Next steps:');
  console.log(`1. cd scripts/${folderName}`);
  console.log('2. Customize config.ts and Code.ts');
  console.log('3. Create appsscript.json for GAS deployment');
  console.log('4. Run: npx clasp create "' + projectName + '"');

} catch (error) {
  console.error('❌ Error creating project:', error.message);
  process.exit(1);
}

function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);

  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}
