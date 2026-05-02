const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Initialize files if they don't exist
function initFile(filePath, defaultData = {}) {
    if (!fs.existsSync(filePath)) {
        fs.writeJsonSync(filePath, defaultData, { spaces: 2 });
    }
}

initFile(USERS_FILE, {});
initFile(STATS_FILE, { totalUsers: 0, totalMessages: 0, totalProjects: 0, startTime: Date.now() });
initFile(PROJECTS_FILE, {});

const Storage = {
    // User Management
    getUser(userId) {
        const users = fs.readJsonSync(USERS_FILE);
        return users[userId] || null;
    },

    saveUser(userId, data) {
        const users = fs.readJsonSync(USERS_FILE);
        users[userId] = { ...users[userId], ...data, updatedAt: Date.now() };
        fs.writeJsonSync(USERS_FILE, users, { spaces: 2 });
        return users[userId];
    },

    getAllUsers() {
        return fs.readJsonSync(USERS_FILE);
    },

    getVerifiedUsers() {
        const users = fs.readJsonSync(USERS_FILE);
        return Object.entries(users).filter(([_, u]) => u.verified);
    },

    // User registration with full details
    registerUser(userId, userInfo) {
        const users = fs.readJsonSync(USERS_FILE);
        if (!users[userId]) {
            users[userId] = {
                userId,
                username: userInfo.username || null,
                firstName: userInfo.first_name || '',
                lastName: userInfo.last_name || '',
                languageCode: userInfo.language_code || 'en',
                verified: false,
                joinedAt: Date.now(),
                messageCount: 0,
                projectCount: 0,
                lastActive: Date.now(),
                isBlocked: false,
                isAdmin: false
            };
            fs.writeJsonSync(USERS_FILE, users, { spaces: 2 });
            
            // Update stats
            this.incrementStat('totalUsers');
        }
        return users[userId];
    },

    verifyUser(userId) {
        return this.saveUser(userId, { verified: true, verifiedAt: Date.now() });
    },

    isUserVerified(userId) {
        const user = this.getUser(userId);
        return user ? user.verified : false;
    },

    blockUser(userId) {
        return this.saveUser(userId, { isBlocked: true });
    },

    unblockUser(userId) {
        return this.saveUser(userId, { isBlocked: false });
    },

    isUserBlocked(userId) {
        const user = this.getUser(userId);
        return user ? user.isBlocked : false;
    },

    incrementUserMessage(userId) {
        const user = this.getUser(userId);
        if (user) {
            this.saveUser(userId, { 
                messageCount: (user.messageCount || 0) + 1, 
                lastActive: Date.now() 
            });
        }
        this.incrementStat('totalMessages');
    },

    incrementUserProject(userId) {
        const user = this.getUser(userId);
        if (user) {
            this.saveUser(userId, { projectCount: (user.projectCount || 0) + 1 });
        }
        this.incrementStat('totalProjects');
    },

    // Stats Management
    getStats() {
        return fs.readJsonSync(STATS_FILE);
    },

    incrementStat(key, value = 1) {
        const stats = fs.readJsonSync(STATS_FILE);
        stats[key] = (stats[key] || 0) + value;
        fs.writeJsonSync(STATS_FILE, stats, { spaces: 2 });
    },

    // Project Tracking
    saveProject(userId, projectData) {
        const projects = fs.readJsonSync(PROJECTS_FILE);
        if (!projects[userId]) projects[userId] = [];
        projects[userId].push({
            ...projectData,
            createdAt: Date.now()
        });
        fs.writeJsonSync(PROJECTS_FILE, projects, { spaces: 2 });
        this.incrementUserProject(userId);
    },

    getUserProjects(userId) {
        const projects = fs.readJsonSync(PROJECTS_FILE);
        return projects[userId] || [];
    }
};

module.exports = Storage;
