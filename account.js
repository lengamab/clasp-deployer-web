/**
 * Account Manager
 * Handles user subscription, usage limits, and billing display
 */
class AccountManager {
    constructor() {
        this.subscriptionData = null;
        this.usageData = null;
        this.init();
    }

    init() {
        console.log('👤 AccountManager initialized');
        // We defer loading until the page is actually viewed to save resources
        // or we can load it on init if we want to show badges elsewhere
    }

    async loadAccountData() {
        await Promise.all([
            this.loadSubscription(),
            this.loadUsage()
        ]);
        this.renderAll();
    }

    async loadSubscription() {
        try {
            const response = await fetch('/api/user/subscription');
            if (response.ok) {
                this.subscriptionData = await response.json();
            } else {
                console.error('Failed to load subscription data');
                // Fallback mock data if server endpoint missing during dev
                this.subscriptionData = this.getMockSubscription();
            }
        } catch (error) {
            console.error('Error loading subscription:', error);
            this.subscriptionData = this.getMockSubscription();
        }
    }

    async loadUsage() {
        try {
            const response = await fetch('/api/user/usage');
            if (response.ok) {
                this.usageData = await response.json();
            } else {
                console.error('Failed to load usage data');
                this.usageData = this.getMockUsage();
            }
        } catch (error) {
            console.error('Error loading usage:', error);
            this.usageData = this.getMockUsage();
        }
    }

    getMockSubscription() {
        return {
            tier: 'Pro',
            status: 'active',
            billingCycle: 'monthly',
            amount: 19,
            currency: 'USD',
            renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
            features: [
                'Unlimited Local Projects',
                'Unlimited Make.com Scenarios',
                'Advanced Analytics',
                'Priority Support'
            ]
        };
    }

    getMockUsage() {
        return {
            appsScriptProjects: { current: 12, limit: null }, // null means unlimited
            makeScenarios: { current: 8, limit: null },
            dailyDeployments: { current: 45, limit: 100 }
        };
    }

    renderAll() {
        if (!document.getElementById('accountPage')) return;

        this.renderSubscriptionCard();
        this.renderUsageWidget();
    }

    renderSubscriptionCard() {
        const container = document.getElementById('subscriptionCard');
        if (!container || !this.subscriptionData) return;

        const { tier, status, amount, currency, renewalDate, features } = this.subscriptionData;
        const renewalDateObj = new Date(renewalDate);
        const dateString = renewalDateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

        let tierColor = 'var(--text-primary)';
        let tierClass = '';
        if (tier === 'Pro') {
            tierColor = 'var(--accent-purple)';
            tierClass = 'neon-purple';
        } else if (tier === 'Agency') {
            tierColor = 'var(--accent-blue)';
            tierClass = 'neon-blue';
        }

        const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;

        container.innerHTML = `
            <div class="subscription-header">
                <div>
                    <span class="subscription-label">Current Plan</span>
                    <h2 class="subscription-tier" style="color: ${tierColor}">${tier}</h2>
                    <span class="subscription-status status-${status}">${status.toUpperCase()}</span>
                </div>
                <div class="subscription-price">
                    <span class="amount">${currencySymbol}${amount}</span>
                    <span class="period">/mo</span>
                </div>
            </div>
            
            <div class="subscription-details">
                <p>Renews on ${dateString}</p>
                <div class="features-list-compact">
                    ${features.map(f => `<div class="feature-item"><i class="fas fa-check"></i> ${f}</div>`).join('')}
                </div>
            </div>

            <div class="subscription-actions">
                <button class="glass-btn primary" onclick="window.location.href='/pricing'">Manage Subscription</button>
                <button class="glass-btn" onclick="window.location.href='/pricing#plans'">Compare Plans</button>
            </div>
        `;

        container.className = `glass-panel subscription-card ${tierClass}`;
    }

    renderUsageWidget() {
        const container = document.getElementById('usageStatsGrid');
        if (!container || !this.usageData) return;

        const { appsScriptProjects, makeScenarios, dailyDeployments } = this.usageData;

        container.innerHTML = `
            ${this.createUsageItem('Apps Script Projects', appsScriptProjects.current, appsScriptProjects.limit, 'fab fa-google', 'var(--accent-blue)')}
            ${this.createUsageItem('Make.com Scenarios', makeScenarios.current, makeScenarios.limit, 'fas fa-robot', 'var(--accent-purple)')}
            ${this.createUsageItem('Daily Deployments', dailyDeployments.current, dailyDeployments.limit, 'fas fa-rocket', 'var(--accent-green)')}
        `;
    }

    createUsageItem(label, current, limit, iconClass, color) {
        const isUnlimited = limit === null || limit === Infinity;
        const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));

        const limitText = isUnlimited ? 'Unlimited' : `${limit}`;
        // For unlimited, we show a generic "active" bar or just the text
        const progressStyle = isUnlimited
            ? `width: 100%; opacity: 0.1;`
            : `width: ${percentage}%;`;

        return `
            <div class="usage-item glass-panel">
                <div class="usage-icon" style="color: ${color}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="usage-info">
                    <div class="usage-header">
                        <span class="usage-label">${label}</span>
                        <span class="usage-values">${current} / ${limitText}</span>
                    </div>
                    <div class="usage-progress-track">
                        <div class="usage-progress-fill" style="${progressStyle} background-color: ${color}"></div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.accountManager = new AccountManager();
});
