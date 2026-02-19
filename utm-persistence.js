/**
 * UTM Persistence Utility
 * Ensures UTM parameters and common click IDs are preserved across internal navigation.
 */
(function () {
    const TRACKING_PARAMS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'fbclid', 'dclid', 'msclkid', 'ttclid'
    ];

    /**
     * Get current tracking parameters from URL and Session Storage
     */
    function getTrackingParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const params = {};

        TRACKING_PARAMS.forEach(param => {
            // Priority: URL > SessionStorage
            if (urlParams.has(param)) {
                params[param] = urlParams.get(param);
                // Save to session storage for persistence within the session
                try {
                    sessionStorage.setItem('sf_track_' + param, params[param]);
                } catch (e) { }
            } else {
                try {
                    const stored = sessionStorage.getItem('sf_track_' + param);
                    if (stored) params[param] = stored;
                } catch (e) { }
            }
        });

        return params;
    }

    /**
     * Append tracking parameters to a URL
     */
    function appendParamsToUrl(url, trackingParams) {
        if (!url || Object.keys(trackingParams).length === 0) return url;

        // Skip external links, social, mailto, tel, etc.
        if (url.startsWith('http') && !url.includes(window.location.hostname)) return url;
        if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:') || url.startsWith('#')) return url;

        try {
            // Handle both relative and absolute internal URLs
            const baseUrl = window.location.origin;
            const urlObj = new URL(url, baseUrl);

            // Only modify internal links
            if (urlObj.origin !== baseUrl) return url;

            const searchParams = urlObj.searchParams;
            Object.entries(trackingParams).forEach(([key, value]) => {
                // Don't overwrite existing params if they are already in the link
                if (!searchParams.has(key)) {
                    searchParams.set(key, value);
                }
            });

            // Return relative path if original was relative
            if (!url.startsWith('http') && !url.startsWith('/')) {
                return urlObj.pathname.substring(1) + urlObj.search + urlObj.hash;
            } else if (!url.startsWith('http')) {
                return urlObj.pathname + urlObj.search + urlObj.hash;
            }

            return urlObj.toString();
        } catch (e) {
            console.error('[UTM Persistence] Error parsing URL:', url, e);
            return url;
        }
    }

    /**
     * Update all internal links on the page
     */
    function updateLinks() {
        const trackingParams = getTrackingParams();
        if (Object.keys(trackingParams).length === 0) return;

        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const originalHref = link.getAttribute('href');
            const newHref = appendParamsToUrl(originalHref, trackingParams);
            if (newHref !== originalHref) {
                link.href = newHref;
            }
        });
    }

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateLinks);
    } else {
        updateLinks();
    }

    // Also watch for dynamically added content
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                updateLinks();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Expose utility globally if needed
    window.UTM_PERSISTENCE = {
        getParams: getTrackingParams,
        updateLinks: updateLinks,
        decorateUrl: (url) => appendParamsToUrl(url, getTrackingParams())
    };

    console.log('[UTM Persistence] Initialized and links updated.');
})();
