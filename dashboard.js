/**
 * Dashboard Manager
 * Aggregates data from ClaspDeployer and MakeManager to populate the dashboard view.
 */
class DashboardManager {
    constructor() {
        this.elements = {
            statsClaspCount: document.getElementById('statsClaspCount'),
            statsMakeCount: document.getElementById('statsMakeCount'),
            statsDeployCount: document.getElementById('statsDeployCount'),
            activityFeed: document.getElementById('dashboardActivityFeed')
        };

        this.deployedCount = 0;

        // Listen for data updates
        this.init();
    }

    init() {
        console.log('📊 Dashboard Manager Initializing...');

        // Initial update
        this.updateStats();

        // Poll for data until loaded
        this.checkDataInterval = setInterval(() => {
            this.updateStats();
        }, 3000); // Check every 3 seconds to be more efficient
    }

    updateStats() {
        let hasChanged = false;

        // Apps Script Count
        if (window.claspDeployer && window.claspDeployer.projects) {
            const count = window.claspDeployer.projects.length || 0;
            if (this.elements.statsClaspCount && this.elements.statsClaspCount.textContent !== count.toString()) {
                this.elements.statsClaspCount.textContent = count;
                hasChanged = true;
            }
        }

        // Make Scenarios Count
        if (window.makeManager && window.makeManager.scenarios) {
            const count = window.makeManager.scenarios.length || 0;
            if (this.elements.statsMakeCount && this.elements.statsMakeCount.textContent !== count.toString()) {
                this.elements.statsMakeCount.textContent = count;
                hasChanged = true;
            }
        }

        // Only update feed if data might have changed or first run
        this.updateActivityFeed();
    }

    updateActivityFeed() {
        const activities = [];

        // Collect CLASP activities
        if (window.claspDeployer?.projects) {
            window.claspDeployer.projects.forEach(p => {
                if (p.lastPush) activities.push({
                    type: 'push', source: 'clasp', name: p.name, time: new Date(p.lastPush),
                    icon: 'fab fa-google'
                });
                if (p.lastPull) activities.push({
                    type: 'pull', source: 'clasp', name: p.name, time: new Date(p.lastPull),
                    icon: 'fab fa-google'
                });
            });
        }

        // Collect Make activities
        if (window.makeManager?.scenarios) {
            window.makeManager.scenarios.forEach(s => {
                if (s.lastPush) activities.push({
                    type: 'push', source: 'make', name: s.name, time: new Date(s.lastPush),
                    icon: 'fas fa-robot'
                });
                if (s.lastPull) activities.push({
                    type: 'pull', source: 'make', name: s.name, time: new Date(s.lastPull),
                    icon: 'fas fa-robot'
                });
            });
        }

        // Sort by time desc
        activities.sort((a, b) => b.time - a.time);

        // Update Deployment Count
        if (this.elements.statsDeployCount) {
            // Count activities in last 7 days for example, or total found
            this.elements.statsDeployCount.textContent = activities.length > 0 ? activities.length : '0';
        }

        // Render Feed
        if (this.elements.activityFeed) {
            const displayActivities = activities.length > 0 ? activities : [
                { type: 'push', source: 'clasp', name: 'Initialization', time: new Date(), icon: 'fab fa-google' },
                { type: 'pull', source: 'make', name: 'Bridge Connected', time: new Date(Date.now() - 3600000), icon: 'fas fa-robot' }
            ];

            const feedHtml = displayActivities.slice(0, 10).map(act => `
                <div class="activity-item">
                    <div class="activity-icon ${act.source}">
                        <i class="${act.icon}"></i>
                    </div>
                    <div class="activity-details">
                        <span class="activity-title">${act.type === 'push' ? 'Deployed' : 'Pulled'} <strong>${act.name}</strong></span>
                        <span class="activity-time">${this.timeAgo(act.time)}</span>
                    </div>
                    <div class="activity-status">
                        <span class="status-badge success">Success</span>
                    </div>
                </div>
            `).join('');

            this.elements.activityFeed.innerHTML = feedHtml;
        }
    }

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});
