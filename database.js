const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('./auth-config');

// Initialize database
const db = new Database(config.DB_PATH);

// Create tables
function initDatabase() {
    console.log('📦 Initializing database...');

    // User Credentials table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            platform_id TEXT NOT NULL, -- 'make', 'zapier', 'n8n', 'appscript'
            credential_key TEXT NOT NULL, -- 'apiToken', 'apiKey', 'instanceUrl'
            credential_value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, platform_id, credential_key)
        )
    `);

    console.log('✅ Database tables ready');
    seedAdminUser();
    migrateExistingProjects();
    migrateExistingConfigToAdmin();
}

// Migrate .make-config.json to admin user if it exists
function migrateExistingConfigToAdmin() {
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminUser) return;

    const configPath = path.join(__dirname, '.make-config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.apiToken) {
                console.log('🔄 Migrating .make-config.json token to admin user...');
                saveUserCredential(adminUser.id, 'make', 'apiToken', config.apiToken);
            }
        } catch (error) {
            console.error('Failed to migrate config:', error.message);
        }
    }
}

// Seed default admin user
function seedAdminUser() {
    const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');

    if (!adminUser) {
        console.log('👤 Creating default admin user...');
        const passwordHash = bcrypt.hashSync('admin', config.BCRYPT_ROUNDS);

        const stmt = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)');
        stmt.run('admin', passwordHash, 'Admin User');
        console.log('✅ Default admin user created (admin/admin)');
    }
}

// Migrate existing projects on disk to the admin user
function migrateExistingProjects() {
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminUser) return;

    const userId = adminUser.id;
    console.log('🔄 Checking for projects to migrate...');

    // 1. Clasp Projects
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    if (fs.existsSync(scriptsDir)) {
        const folders = fs.readdirSync(scriptsDir).filter(f => {
            const fullPath = path.join(scriptsDir, f);
            return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
        });

        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO user_projects (user_id, project_name, project_path, project_type)
            VALUES (?, ?, ?, ?)
        `);

        folders.forEach(folder => {
            const projectPath = path.join(scriptsDir, folder);
            insertStmt.run(userId, folder, projectPath, 'clasp');
        });
    }

    // 2. Make Scenarios (Local)
    const makeDir = path.join(__dirname, '..', 'make-scenarios', 'scenarios');
    if (fs.existsSync(makeDir)) {
        const scenarioFolders = fs.readdirSync(makeDir).filter(f => {
            const fullPath = path.join(makeDir, f);
            return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
        });

        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO user_projects (user_id, project_name, project_path, project_type)
            VALUES (?, ?, ?, ?)
        `);

        scenarioFolders.forEach(folder => {
            const projectPath = path.join(makeDir, folder);
            // Folder name usually contains ID, might want to clean it or just use it as name
            insertStmt.run(userId, folder, projectPath, 'make');
        });
    }

    console.log('✅ Project migration complete');
}

// Helper functions
function findUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserById(id) {
    return db.prepare('SELECT id, username, name, created_at FROM users WHERE id = ?').get(id);
}

function getUserProjects(userId) {
    return db.prepare('SELECT * FROM user_projects WHERE user_id = ?').all(userId);
}

function saveUserCredential(userId, platformId, key, value) {
    const stmt = db.prepare(`
        INSERT INTO user_credentials (user_id, platform_id, credential_key, credential_value, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, platform_id, credential_key) DO UPDATE SET
            credential_value = excluded.credential_value,
            updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(userId, platformId, key, value);
}

function getUserCredentials(userId, platformId) {
    return db.prepare('SELECT credential_key, credential_value FROM user_credentials WHERE user_id = ? AND platform_id = ?').all(userId, platformId);
}

function getUserCredential(userId, platformId, key) {
    const result = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND platform_id = ? AND credential_key = ?').get(userId, platformId, key);
    return result ? result.credential_value : null;
}

module.exports = {
    db,
    initDatabase,
    findUserByUsername,
    findUserById,
    getUserProjects,
    saveUserCredential,
    getUserCredentials,
    getUserCredential
};
