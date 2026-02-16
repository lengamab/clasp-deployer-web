/**
 * Navigation Manager
 * Handles page switching, sidebar active states, and global shortcuts
 */
class NavigationManager {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarItems = document.querySelectorAll('.nav-item[data-page]');
        // Add listeners for other navigation elements (like in Quick Actions or Project Cards)
        this.init();
    }

    init() {
        console.log('🧭 NavigationManager initialized');
        this.activeSearchResultIndex = -1;

        // Handle Sidebar Clicks
        this.sidebarItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                if (page) {
                    this.switchToPage(page);
                }
            });
        });

        // Handle Global Search Input
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                const results = document.querySelectorAll('.search-result-item');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateSearchResults(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateSearchResults(-1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.activeSearchResultIndex >= 0 && results[this.activeSearchResultIndex]) {
                        results[this.activeSearchResultIndex].click();
                    } else if (searchInput.value.startsWith('/')) {
                        // Execute direct command if no results selected but value matches a command
                        this.handleSearch(searchInput.value, true);
                    }
                } else if (e.key === 'Escape') {
                    this.closeSearch();
                    searchInput.blur();
                }
            });
        }

        // Handle Global Search Focus (Cmd+K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('globalSearch');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        });

        // Close search on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-bar')) {
                this.closeSearch();
            }
        });

        // Handle URL Hash if present (simple routing)
        const hash = window.location.hash.slice(1);
        if (['dashboard', 'clasp', 'make', 'account', 'ai-converter'].includes(hash)) {
            this.switchToPage(hash);
        } else {
            // Default to dashboard
            this.switchToPage('dashboard');
        }

        // Expose to window for inline onclick handlers
        window.navigationManager = this;
    }

    navigateSearchResults(direction) {
        const results = document.querySelectorAll('.search-result-item');
        if (results.length === 0) return;

        // Clear previous active
        results.forEach(r => r.classList.remove('active'));

        this.activeSearchResultIndex += direction;

        if (this.activeSearchResultIndex >= results.length) this.activeSearchResultIndex = 0;
        if (this.activeSearchResultIndex < 0) this.activeSearchResultIndex = results.length - 1;

        results[this.activeSearchResultIndex].classList.add('active');
        results[this.activeSearchResultIndex].scrollIntoView({ block: 'nearest' });
    }

    handleSearch(query, executeImmediately = false) {
        if (!query) {
            this.closeSearch();
            return;
        }

        const results = [];
        const q = query.toLowerCase();

        // System Commands
        const commands = [
            { id: '/dashboard', name: 'Go to Dashboard', type: 'command', page: 'dashboard', icon: 'fas fa-grid-2' },
            { id: '/clasp', name: 'Apps Script Projects', type: 'command', page: 'clasp', icon: 'fab fa-google' },
            { id: '/scripts', name: 'Apps Script Projects', type: 'command', page: 'clasp', icon: 'fab fa-google' },
            { id: '/make', name: 'Make.com Scenarios', type: 'command', page: 'make', icon: 'fas fa-robot' },
            { id: '/scenarios', name: 'Make.com Scenarios', type: 'command', page: 'make', icon: 'fas fa-robot' },
            { id: '/settings', name: 'Open Settings', type: 'command', action: 'settings', icon: 'fas fa-cog' },
            { id: '/refresh', name: 'Refresh Data', type: 'command', action: 'refresh', icon: 'fas fa-sync-alt' }
        ];

        // Filter and execute immediately if needed
        if (executeImmediately) {
            const cmd = commands.find(c => c.id === q);
            if (cmd) {
                if (cmd.page) this.switchToPage(cmd.page);
                if (cmd.action === 'settings') document.getElementById('settingsBtn')?.click();
                if (cmd.action === 'refresh') {
                    window.claspDeployer?.loadExistingProjects();
                    window.makeManager?.loadScenarios();
                }
                this.closeSearch();
                document.getElementById('globalSearch').value = '';
                return;
            }
        }

        // Add matching commands to results
        commands.forEach(c => {
            if (c.id.includes(q)) {
                results.push(c);
            }
        });

        if (query.length < 2 && results.length === 0) {
            this.closeSearch();
            return;
        }

        // Search CLASP Projects
        if (window.claspDeployer?.projects) {
            window.claspDeployer.projects.forEach(p => {
                if (p.name.toLowerCase().includes(q) || p.scriptId?.toLowerCase().includes(q)) {
                    results.push({ type: 'clasp', name: p.name, id: p.scriptId, page: 'clasp', icon: 'fab fa-google' });
                }
            });
        }

        // Search Make Scenarios
        if (window.makeManager?.scenarios) {
            window.makeManager.scenarios.forEach(s => {
                if (s.name.toLowerCase().includes(q) || s.id.toString().includes(q)) {
                    results.push({ type: 'make', name: s.name, id: s.id, page: 'make', icon: 'fas fa-robot' });
                }
            });
        }

        this.renderSearchResults(results);
    }

    renderSearchResults(results) {
        let dropdown = document.getElementById('searchDropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'searchDropdown';
            dropdown.className = 'search-results-dropdown glass-panel';
            document.querySelector('.search-bar').appendChild(dropdown);
        }

        this.activeSearchResultIndex = -1; // Reset selection

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-no-results">No matches found</div>';
        } else {
            dropdown.innerHTML = results.map((res, index) => `
                <div class="search-result-item" onclick="window.navigationManager.selectSearchResult('${res.page || ''}', '${res.id || ''}', '${res.action || ''}')">
                    <div class="result-icon ${res.type}">
                        <i class="${res.icon}"></i>
                    </div>
                    <div class="result-info">
                        <span class="result-name">${res.name}</span>
                        <span class="result-meta">
                            ${res.type === 'command' ? '<span class="result-badge command">Command</span>' : ''}
                            ${res.type === 'clasp' ? 'Apps Script' : ''}
                            ${res.type === 'make' ? 'Make Scenario' : ''}
                        </span>
                    </div>
                </div>
            `).join('');
        }

        dropdown.style.display = 'block';
    }

    selectSearchResult(page, id, action) {
        if (action === 'settings') {
            document.getElementById('settingsBtn')?.click();
        } else if (action === 'refresh') {
            window.claspDeployer?.loadExistingProjects();
            window.makeManager?.loadScenarios();
        } else if (page) {
            this.switchToPage(page);
        }

        this.closeSearch();
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) searchInput.value = '';

        // Highlight the specific item if possible (smooth scroll)
        if (id) {
            setTimeout(() => {
                const el = document.querySelector(`[data-id="${id}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight-pulse');
                    setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
                }
            }, 300);
        }
    }

    closeSearch() {
        const dropdown = document.getElementById('searchDropdown');
        if (dropdown) dropdown.style.display = 'none';
        this.activeSearchResultIndex = -1;
    }

    switchToPage(pageId) {
        console.log(`Navigating to: ${pageId}`);

        // 1. Update State
        this.currentPage = pageId;
        window.location.hash = pageId;

        // 2. Update Sidebar Active State
        this.sidebarItems.forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 3. Map pageId to actual element ID prefix
        // Some pages use hyphens in data-page but camelCase in element IDs
        const pageIdToElementMap = {
            'dashboard': 'dashboard',
            'clasp': 'clasp',
            'make': 'make',
            'account': 'account',
            'ai-converter': 'aiConverter'
        };

        const elementIdPrefix = pageIdToElementMap[pageId] || pageId;

        // 4. Update Main Content Views
        Object.values(pageIdToElementMap).forEach(prefix => {
            const el = document.getElementById(`${prefix}Page`);
            if (el) {
                if (prefix === elementIdPrefix) {
                    el.classList.add('active');
                    el.style.display = 'block';

                    // Trigger data load for specific pages
                    if (prefix === 'account' && window.accountManager) {
                        window.accountManager.loadAccountData();
                    }
                } else {
                    el.classList.remove('active');
                    el.style.display = 'none';
                }
            }
        });

        // 5. Update Header Title logic
        const titleMap = {
            'dashboard': 'Dashboard',
            'clasp': 'Apps Script Projects',
            'make': 'Make.com Scenarios',
            'account': 'Account & Billing',
            'ai-converter': 'AI Blueprint Converter'
        };
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = titleMap[pageId] || 'Dashboard';
        }

        // 6. Trigger specific functional refreshes if needed
        if (pageId === 'clasp' && window.claspDeployer) {
            // window.claspDeployer.loadExistingProjects(); // Optional: Auto-refresh
        }
        if (pageId === 'ai-converter') {
            this.ensureAiConverterVisible();
        }
    }

    ensureAiConverterVisible() {
        const page = document.getElementById('aiConverterPage');
        if (!page) return;

        page.style.display = 'block';
        page.style.visibility = 'visible';

        const splitLayout = page.querySelector('.split-layout');
        if (splitLayout && getComputedStyle(splitLayout).display === 'none') {
            splitLayout.style.display = 'grid';
        }

        const inputPanel = document.getElementById('aiInputPanel');
        if (inputPanel && getComputedStyle(inputPanel).display === 'none') {
            inputPanel.style.display = 'flex';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if validation passes
    if (document.querySelector('.sidebar')) {
        window.navigationManager = new NavigationManager();
    }
});
