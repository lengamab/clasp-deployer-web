// Test script to verify project listing functionality
const fs = require('fs');
const path = require('path');

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

console.log('Existing projects found:');
const projects = listExistingProjects();
if (projects.length === 0) {
  console.log('No projects found');
} else {
  projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.name} (${project.scriptId})`);
  });
}





