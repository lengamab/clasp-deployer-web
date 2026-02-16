/**
 * Cookie Consent Manager for GDPR Compliance
 * Handles user consent before loading analytics/tracking scripts
 */

(function () {
    'use strict';

    const CONSENT_KEY = 'scriptflow_cookie_consent';
    const CONSENT_VERSION = '1'; // Bump this to re-ask consent

    // Check existing consent
    function getConsent() {
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === CONSENT_VERSION) {
                    return parsed.accepted;
                }
            }
        } catch (e) {
            console.warn('Cookie consent: unable to read localStorage');
        }
        return null;
    }

    // Store consent
    function setConsent(accepted) {
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify({
                accepted: accepted,
                version: CONSENT_VERSION,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            console.warn('Cookie consent: unable to write localStorage');
        }
    }

    // Load Analytics (GTM + GA4) only after consent
    function loadAnalytics() {
        if (window.analyticsLoaded) return;
        window.analyticsLoaded = true;

        const gtmId = window.GTM_CONTAINER_ID || 'GTM-XXXXXXX';
        const ga4Id = window.GA4_MEASUREMENT_ID || 'G-PZ1SQN4MRY';

        // 1. Load GTM
        if (gtmId !== 'GTM-XXXXXXX') {
            (function (w, d, s, l, i) {
                w[l] = w[l] || [];
                w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
                var f = d.getElementsByTagName(s)[0],
                    j = d.createElement(s),
                    dl = l != 'dataLayer' ? '&l=' + l : '';
                j.async = true;
                j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
                f.parentNode.insertBefore(j, f);
            })(window, document, 'script', 'dataLayer', gtmId);
            console.log('GTM: Loaded (' + gtmId + ')');
        } else {
            console.log('GTM: Placeholder ID, skipping');
        }

        // 2. Load GA4
        if (ga4Id !== 'G-PZ1SQN4MRY') {
            // Load gtag.js
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga4Id;
            document.head.appendChild(script);

            // Initialize dataLayer
            window.dataLayer = window.dataLayer || [];
            function gtag() { window.dataLayer.push(arguments); }
            gtag('js', new Date());
            gtag('config', ga4Id, { 'anonymize_ip': true }); // GDPR best practice

            console.log('GA4: Loaded (' + ga4Id + ')');
        } else {
            console.log('GA4: Placeholder ID, skipping');
        }
    }

    // Create and show consent banner
    function showBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <p><strong>🍪 We value your privacy</strong></p>
                    <p>We use cookies to enhance your experience and analyze site traffic. 
                    <a href="/cookies" target="_blank">Learn more</a></p>
                </div>
                <div class="cookie-consent-buttons">
                    <button id="cookie-decline" class="cookie-btn cookie-btn-secondary">Decline</button>
                    <button id="cookie-accept" class="cookie-btn cookie-btn-primary">Accept All</button>
                </div>
            </div>
        `;

        // Inject styles
        const style = document.createElement('style');
        style.textContent = `
            #cookie-consent-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--bg-surface, #fff);
                border-top: 1px solid var(--border-subtle, #e0e0e0);
                box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
                padding: 16px 24px;
                z-index: 10000;
                animation: slideUp 0.3s ease-out;
            }
            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .cookie-consent-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                flex-wrap: wrap;
            }
            .cookie-consent-text p {
                margin: 0 0 4px;
                font-size: 14px;
                color: var(--text-primary, #333);
            }
            .cookie-consent-text a {
                color: var(--brand-blue, #4285f4);
                text-decoration: underline;
            }
            .cookie-consent-buttons {
                display: flex;
                gap: 12px;
                flex-shrink: 0;
            }
            .cookie-btn {
                padding: 10px 20px;
                border-radius: 24px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }
            .cookie-btn-primary {
                background: var(--text-primary, #202124);
                color: var(--bg-primary, #fff);
            }
            .cookie-btn-primary:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            .cookie-btn-secondary {
                background: transparent;
                border: 1px solid var(--border-strong, #dadce0);
                color: var(--text-primary, #333);
            }
            .cookie-btn-secondary:hover {
                background: var(--bg-secondary, #f8f9fa);
            }
            @media (max-width: 600px) {
                .cookie-consent-content {
                    flex-direction: column;
                    text-align: center;
                }
                .cookie-consent-buttons {
                    width: 100%;
                    justify-content: center;
                }
            }
            @media (prefers-color-scheme: dark) {
                #cookie-consent-banner {
                    background: #202124;
                    border-color: #3c4043;
                }
                .cookie-consent-text p {
                    color: #e8eaed;
                }
                .cookie-btn-primary {
                    background: #e8eaed;
                    color: #202124;
                }
                .cookie-btn-secondary {
                    border-color: #5f6368;
                    color: #e8eaed;
                }
                .cookie-btn-secondary:hover {
                    background: #3c4043;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Event handlers
        document.getElementById('cookie-accept').addEventListener('click', function () {
            setConsent(true);
            banner.remove();
            loadAnalytics();
            initAnalyticsTracking();
        });

        document.getElementById('cookie-decline').addEventListener('click', function () {
            setConsent(false);
            banner.remove();
        });
    }

    // Initialize analytics event tracking
    function initAnalyticsTracking() {
        window.dataLayer = window.dataLayer || [];

        // Track CTA clicks
        document.querySelectorAll('.btn-cta, .btn-secondary').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                const btnText = this.textContent.trim();
                const btnId = this.id || 'unknown';
                dataLayer.push({
                    event: 'cta_click',
                    cta_text: btnText,
                    cta_id: btnId,
                    page_location: window.location.pathname
                });
            });
        });

        // Track video plays
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            playButton.addEventListener('click', function () {
                dataLayer.push({
                    event: 'video_demo_play',
                    video_location: 'landing_hero'
                });
            });
        }

        // Track pricing clicks
        document.querySelectorAll('[href*="pricing"], [href*="plan="]').forEach(function (link) {
            link.addEventListener('click', function () {
                dataLayer.push({
                    event: 'pricing_click',
                    pricing_source: this.textContent.trim()
                });
            });
        });

        // Track FAQ interactions
        document.querySelectorAll('.faq-item summary').forEach(function (summary) {
            summary.addEventListener('click', function () {
                dataLayer.push({
                    event: 'faq_interaction',
                    question: this.textContent.trim()
                });
            });
        });

        console.log('Analytics: Event tracking initialized');
    }

    // Initialize on DOM ready
    function init() {
        const consent = getConsent();

        if (consent === true) {
            // User already accepted
            loadAnalytics();
            initAnalyticsTracking();
        } else if (consent === false) {
            // User declined, don't show banner again
            console.log('Analytics: User previously declined cookies');
        } else {
            // No consent yet, show banner
            showBanner();
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for manual triggering
    window.CookieConsent = {
        reset: function () {
            localStorage.removeItem(CONSENT_KEY);
            location.reload();
        },
        getStatus: function () {
            return getConsent();
        }
    };
})();
