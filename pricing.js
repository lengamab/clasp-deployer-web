/**
 * Pricing Page Manager
 * Handles pricing toggle, currency switching, and interactions
 */
class PricingManager {
    constructor() {
        this.isYearly = false;
        this.currency = 'USD'; // Default
        this.rates = {
            USD: { symbol: '$', rate: 1 },
            EUR: { symbol: '€', rate: 1 } // Using 1:1 parity for simplicity as is common in SaaS
        };

        // Base prices in default currency (USD)
        // Adjust these if you want different pricing for EUR
        this.prices = {
            starter: { monthly: 0, yearly: 0 },
            pro: { monthly: 19, yearly: 15 },
            agency: { monthly: 49, yearly: 39 }
        };

        this.init();
    }

    init() {
        // 1. Detect User Location / Currency Preference
        this.detectCurrency();

        // 2. Setup Toggle
        const toggle = document.getElementById('pricingToggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.isYearly = e.target.checked;
                this.updatePrices();
            });
        }

        // 3. Setup Currency Selector
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.value = this.currency;
            currencySelect.addEventListener('change', (e) => {
                this.currency = e.target.value;
                this.updatePrices();
            });
        }

        // 4. Setup Comparison Modal
        this.initModal();

        // Initial Render
        this.updatePrices();
    }

    initModal() {
        const modal = document.getElementById('compareModal');
        const btn = document.getElementById('comparePlansBtn');
        const closeBtn = document.querySelector('.modal-close');

        if (!modal || !btn) return;

        const openModal = () => {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        };

        const closeModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };

        btn.addEventListener('click', openModal);

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });
    }

    detectCurrency() {
        try {
            // Check browser locale
            const locale = navigator.language || navigator.userLanguage;
            // Simple heuristic: if locale implies Europe, default to EUR
            // e.g. de-DE, fr-FR, it-IT, es-ES, nl-NL
            const eurLocales = ['de', 'fr', 'it', 'es', 'nl', 'pt', 'fi', 'el'];
            if (eurLocales.some(code => locale.startsWith(code)) || locale === 'en-GB' || locale === 'en-IE') {
                this.currency = 'EUR';
            }
        } catch (e) {
            console.warn('Currency detection failed, defaulting to USD', e);
        }
    }

    updatePrices() {
        const period = this.isYearly ? 'yearly' : 'monthly';
        const symbol = this.rates[this.currency].symbol;

        // Helper to update specific plan
        const updatePlan = (id, priceObj) => {
            const priceEl = document.getElementById(`price${id}`);
            const billingEl = document.getElementById(`billing${id}`);

            // Get base price
            let priceVal = priceObj[period];

            // Apply currency conversion (if we had rates != 1, we would multiply here)
            // For now, assumming 1:1 mapping so value stays same

            if (priceEl) {
                priceEl.innerHTML = `<span class="currency">${symbol}</span>${priceVal}<span class="period">/mo</span>`;
            }

            if (billingEl) {
                if (this.isYearly) {
                    const yearlyTotal = priceVal * 12;
                    billingEl.textContent = `${symbol}${yearlyTotal} billed per year`;
                    billingEl.style.display = 'block';
                } else {
                    billingEl.style.display = 'none';
                }
            }
        };

        // Update Pro
        updatePlan('Pro', this.prices.pro);

        // Update Agency
        updatePlan('Agency', this.prices.agency);

        // Update Starter (usually 0 is 0 regardless of currency, but symbol changes)
        // We didn't give ID to starter price, but it's 0. If needed we can target it.
        const starterCard = document.querySelector('.pricing-card:first-child .price');
        if (starterCard) {
            // Starter is always 0
            starterCard.innerHTML = `<span class="currency">${symbol}</span>0<span class="period">/mo</span>`;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.pricingManager = new PricingManager();
});
