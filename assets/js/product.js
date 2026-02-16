/**
 * ScriptFlow Product Page Logic
 * Handles carousel, lightbox, analytics events, and progressive enhancements
 */

(function () {
    'use strict';

    // Initialize all product page features
    document.addEventListener('DOMContentLoaded', () => {
        initCarousel();
        initLightbox();
        initProductAnalytics();
        initAccessibility();
        initProgressiveEnhancements();
    });

    /**
     * Screenshot Carousel
     * Keyboard accessible with arrow keys and indicator buttons
     */
    function initCarousel() {
        const track = document.querySelector('.carousel-track');
        const slides = document.querySelectorAll('.carousel-slide');
        const prevBtn = document.querySelector('.carousel-prev');
        const nextBtn = document.querySelector('.carousel-next');
        const indicators = document.querySelectorAll('.carousel-indicator');

        if (!track || slides.length === 0) return;

        let currentSlide = 0;
        const totalSlides = slides.length;

        function updateCarousel(newIndex) {
            // Clamp index
            if (newIndex < 0) newIndex = totalSlides - 1;
            if (newIndex >= totalSlides) newIndex = 0;

            currentSlide = newIndex;

            // Move track
            track.style.transform = `translateX(-${currentSlide * 100}%)`;

            // Update indicators
            indicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === currentSlide);
                indicator.setAttribute('aria-selected', index === currentSlide ? 'true' : 'false');
            });

            // Push analytics event
            if (window.dataLayer) {
                window.dataLayer.push({
                    event: 'screenshot_view',
                    screenshot_index: currentSlide + 1,
                    screenshot_total: totalSlides
                });
            }
        }

        // Button handlers
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                updateCarousel(currentSlide - 1);
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'carousel_navigation',
                        direction: 'previous'
                    });
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                updateCarousel(currentSlide + 1);
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'carousel_navigation',
                        direction: 'next'
                    });
                }
            });
        }

        // Indicator handlers
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                updateCarousel(index);
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'carousel_navigation',
                        direction: 'indicator',
                        target_slide: index + 1
                    });
                }
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                updateCarousel(currentSlide - 1);
            } else if (e.key === 'ArrowRight') {
                updateCarousel(currentSlide + 1);
            }
        });

        // Auto-advance (optional, paused on hover)
        let autoAdvanceInterval;
        const startAutoAdvance = () => {
            autoAdvanceInterval = setInterval(() => {
                updateCarousel(currentSlide + 1);
            }, 5000);
        };

        const stopAutoAdvance = () => {
            if (autoAdvanceInterval) {
                clearInterval(autoAdvanceInterval);
            }
        };

        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', stopAutoAdvance);
            carouselContainer.addEventListener('mouseleave', startAutoAdvance);
        }

        // Start auto-advance
        startAutoAdvance();
    }

    /**
     * Lightbox for Screenshot Expansion
     * Allows users to view screenshots in full size
     */
    function initLightbox() {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const closeBtn = document.querySelector('.lightbox-close');

        if (!lightbox || !lightboxImg) return;

        // Make all carousel slides clickable
        const carouselSlides = document.querySelectorAll('.carousel-slide img');
        carouselSlides.forEach((img) => {
            img.addEventListener('click', () => {
                lightboxImg.src = img.src;
                lightboxImg.alt = img.alt;
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent scrolling

                // Analytics event
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'lightbox_open',
                        image_alt: img.alt
                    });
                }
            });
        });

        // Make feature screenshots clickable too
        const featureScreenshots = document.querySelectorAll('.feature-card img');
        featureScreenshots.forEach((img) => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                lightboxImg.src = img.src;
                lightboxImg.alt = img.alt;
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden';

                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'lightbox_open',
                        image_alt: img.alt
                    });
                }
            });
        });

        // Close lightbox
        const closeLightbox = () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';

            if (window.dataLayer) {
                window.dataLayer.push({
                    event: 'lightbox_close'
                });
            }
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeLightbox);
        }

        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    }

    /**
     * Product Page Analytics
     * Tracks CTA clicks, pricing interactions, demo plays, and signups
     */
    function initProductAnalytics() {
        window.dataLayer = window.dataLayer || [];

        // Track page view
        dataLayer.push({
            event: 'page_view',
            page_title: document.title,
            page_location: window.location.href,
            page_type: 'product'
        });

        // Track all CTA clicks with detailed context
        document.querySelectorAll('.btn-cta, .btn-secondary').forEach((btn) => {
            btn.addEventListener('click', function (e) {
                const btnText = this.textContent.trim();
                const btnId = this.id || 'unknown';
                const eventName = this.getAttribute('data-event-name') || 'cta_click';
                const plan = this.getAttribute('data-plan');

                const eventData = {
                    event: eventName,
                    cta_text: btnText,
                    cta_id: btnId,
                    cta_location: getSectionName(this),
                    page_location: window.location.pathname
                };

                if (plan) {
                    eventData.plan = plan;
                }

                dataLayer.push(eventData);
            });
        });

        // Track pricing plan clicks with detailed context
        document.querySelectorAll('[data-plan]').forEach((link) => {
            link.addEventListener('click', function () {
                const plan = this.getAttribute('data-plan');
                dataLayer.push({
                    event: 'pricing_click',
                    plan: plan,
                    pricing_location: 'product_page_teaser'
                });
            });
        });

        // Track feature card interactions
        document.querySelectorAll('.feature-card').forEach((card) => {
            card.addEventListener('click', function () {
                const featureName = this.querySelector('h3')?.textContent.trim();
                dataLayer.push({
                    event: 'feature_explore',
                    feature_name: featureName
                });
            });
        });

        // Track use case exploration
        document.querySelectorAll('.use-case-card').forEach((card) => {
            card.addEventListener('click', function () {
                const useCaseName = this.querySelector('h3')?.textContent.trim();
                dataLayer.push({
                    event: 'use_case_view',
                    use_case: useCaseName
                });
            });
        });

        // Track FAQ interactions
        document.querySelectorAll('.faq-item summary').forEach((summary) => {
            summary.addEventListener('click', function () {
                const isOpen = this.parentElement.hasAttribute('open');
                const question = this.textContent.trim();

                dataLayer.push({
                    event: 'faq_interaction',
                    question: question,
                    action: isOpen ? 'collapse' : 'expand'
                });
            });
        });

        // Track scroll depth milestones
        let scrollMilestones = [25, 50, 75, 100];
        let trackedMilestones = [];

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            );

            scrollMilestones.forEach((milestone) => {
                if (scrollPercent >= milestone && !trackedMilestones.includes(milestone)) {
                    trackedMilestones.push(milestone);
                    dataLayer.push({
                        event: 'scroll_depth',
                        percent_scrolled: milestone
                    });
                }
            });
        });

        // Track time on page (send every 30 seconds while active)
        let timeOnPage = 0;
        const timeTracker = setInterval(() => {
            timeOnPage += 30;
            dataLayer.push({
                event: 'time_on_page',
                seconds: timeOnPage
            });

            // Stop after 5 minutes
            if (timeOnPage >= 300) {
                clearInterval(timeTracker);
            }
        }, 30000);

        // Track outbound links
        document.querySelectorAll('a[href^="http"]').forEach((link) => {
            if (!link.href.includes(window.location.hostname)) {
                link.addEventListener('click', function () {
                    dataLayer.push({
                        event: 'outbound_link',
                        link_url: this.href,
                        link_text: this.textContent.trim()
                    });
                });
            }
        });

        console.log('Product Analytics: Event tracking initialized');
    }

    /**
     * Accessibility Enhancements
     * Ensures keyboard navigation and screen reader support
     */
    function initAccessibility() {
        // Ensure all interactive elements are keyboard accessible
        const interactiveElements = document.querySelectorAll('.feature-card, .use-case-card, .solution-card');

        interactiveElements.forEach((element) => {
            // Add tabindex if not already present
            if (!element.hasAttribute('tabindex') && !element.querySelector('a, button')) {
                element.setAttribute('tabindex', '0');
            }

            // Add keyboard event listeners
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    element.click();
                }
            });
        });

        // Announce carousel changes to screen readers
        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            const announcer = document.createElement('div');
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.style.position = 'absolute';
            announcer.style.left = '-9999px';
            carouselContainer.appendChild(announcer);

            const indicators = document.querySelectorAll('.carousel-indicator');
            indicators.forEach((indicator) => {
                indicator.addEventListener('click', () => {
                    const slideNumber = parseInt(indicator.getAttribute('data-slide')) + 1;
                    announcer.textContent = `Viewing screenshot ${slideNumber} of ${indicators.length}`;
                });
            });
        }

        // Improve focus visibility
        const style = document.createElement('style');
        style.textContent = `
            *:focus-visible {
                outline: 3px solid var(--brand-blue);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);

        console.log('Accessibility: Enhancements initialized');
    }

    /**
     * Progressive Enhancements
     * Features that enhance the experience when JS is enabled
     */
    function initProgressiveEnhancements() {
        // Animate elements on scroll into view
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe cards and sections
        const animateElements = document.querySelectorAll(
            '.feature-card, .solution-card, .use-case-card, .pricing-card, .testimonial-card'
        );

        animateElements.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(el);
        });

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#' || targetId === '#main-content') return;

                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Update URL without triggering navigation
                    history.pushState(null, '', targetId);
                }
            });
        });

        // Add loading="lazy" to images below the fold if not already set
        const images = document.querySelectorAll('img');
        images.forEach((img, index) => {
            if (index > 3 && !img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
        });

        console.log('Progressive Enhancements: Initialized');
    }

    /**
     * Helper: Get section name for analytics context
     */
    function getSectionName(element) {
        const section = element.closest('section');
        if (!section) return 'unknown';

        // Try to get section identifier from ID or class
        if (section.id) return section.id;

        const sectionTitle = section.querySelector('.section-title');
        if (sectionTitle) {
            return sectionTitle.textContent.trim().toLowerCase().replace(/\s+/g, '_');
        }

        return 'unknown';
    }

    /**
     * Demo Video Play Handler (if video is added later)
     */
    function initDemoVideo() {
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            playButton.addEventListener('click', function () {
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'demo_play',
                        video_location: 'product_page'
                    });
                }

                // Replace placeholder with actual video embed
                const videoContainer = this.closest('.video-container');
                if (videoContainer) {
                    // Example: Embed YouTube/Vimeo video
                    videoContainer.innerHTML = `
                        <iframe 
                            width="100%" 
                            height="100%" 
                            src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1" 
                            frameborder="0" 
                            allow="autoplay; encrypted-media" 
                            allowfullscreen>
                        </iframe>
                    `;
                }
            });
        }
    }

    // Expose public API if needed
    window.ProductPage = {
        version: '1.0.0',
        trackCustomEvent: function (eventName, eventData) {
            if (window.dataLayer) {
                window.dataLayer.push({
                    event: eventName,
                    ...eventData
                });
            }
        }
    };

})();

