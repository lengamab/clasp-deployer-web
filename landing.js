/**
 * ScriptFlow Landing Page Logic
 * Handles animations, sticky navigation, and interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    initStickyNav();
    initSmoothScroll();
    initEntranceAnimations();
    initParticleSystem();
});

/**
 * Handle sticky navigation state on scroll
 */
function initStickyNav() {
    const nav = document.querySelector('.landing-nav');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

/**
 * Smooth scrolling for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Intersection Observer for scroll animations
 */
function initEntranceAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Select elements to animate
    const animateElements = document.querySelectorAll('.feature-card, .section-title, .section-tag');

    animateElements.forEach(el => {
        // Set initial state
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

        observer.observe(el);
    });
}

/**
 * Floating Points Particle System
 * Inspired by Google Antigravity
 */
function initParticleSystem() {
    const canvas = document.getElementById('hero-particles-canvas');
    if (!canvas) return;

    const heroSection = canvas.closest('.hero');
    if (!heroSection) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    // Configuration
    const particleCount = 300; // Increased count for denser effect
    const mouseDistance = 250; // Larger interaction radius

    // Theme State
    let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Theme Palettes
    const themeColors = {
        light: [
            'rgba(66, 133, 244, 0.6)',  // Blue (Increased from 0.4)
            'rgba(234, 67, 53, 0.6)',   // Red (Increased from 0.4)
            'rgba(251, 188, 5, 0.6)',   // Yellow (Increased from 0.4)
            'rgba(52, 168, 83, 0.6)',   // Green (Increased from 0.4)
            'rgba(95, 99, 104, 0.4)'    // Grey (Increased from 0.2)
        ],
        dark: [
            'rgba(138, 180, 248, 0.6)', // Light Blue (Increased from 0.4)
            'rgba(242, 139, 130, 0.6)', // Light Red (Increased from 0.4)
            'rgba(253, 214, 99, 0.6)',  // Light Yellow (Increased from 0.4)
            'rgba(129, 201, 149, 0.6)', // Light Green (Increased from 0.4)
            'rgba(232, 234, 237, 0.4)'  // Light Gray (Increased from 0.2)
        ]
    };

    // Listen for theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        isDark = e.matches;
    });

    // Mouse state
    const mouse = { x: null, y: null };

    // Resize handler - set canvas dimensions and matching CSS style to prevent stretching
    function resize() {
        const rect = heroSection.getBoundingClientRect();
        width = canvas.width = rect.width;
        height = canvas.height = rect.height;

        // CRITICAL: Set CSS dimensions to match canvas resolution exactly
        // This prevents the browser from scaling/stretching the canvas
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        initParticles();
    }

    // Particle Class
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5; // Velocity X
            this.vy = (Math.random() - 0.5) * 0.5; // Velocity Y
            this.size = Math.random() * 1.2 + 0.5; // Reduced size for thinner look
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 30) + 1; // Weight for mouse interaction

            // Store index instead of fixed color string to allow theme switching
            this.colorIndex = Math.floor(Math.random() * 5);

            // Random orbit direction: 1 (clockwise) or -1 (counter-clockwise)
            this.swirlDirection = Math.random() < 0.5 ? 1 : -1;
        }

        update() {
            // physics simulation

            // 1. Mouse Interaction (Attraction/Orbit)
            if (mouse.x != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouseDistance) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouseDistance - distance) / mouseDistance;

                    // Ultra Gentle Attraction (Gravity) - Even Slower
                    const attractionStrength = 0.004;

                    // Orbit/Swirl Force (Tangential) with Random Direction
                    const swirlStrength = 0.006;
                    const swirlX = -forceDirectionY;
                    const swirlY = forceDirectionX;

                    // Apply forces
                    this.vx += forceDirectionX * force * this.density * attractionStrength;
                    this.vy += forceDirectionY * force * this.density * attractionStrength;

                    // Apply random orbit
                    this.vx += swirlX * force * this.density * swirlStrength * this.swirlDirection;
                    this.vy += swirlY * force * this.density * swirlStrength * this.swirlDirection;
                }
            }

            // 2. Normal floating motion
            this.x += this.vx;
            this.y += this.vy;

            // 3. Friction - Higher drag for slower liquid feel
            this.vx *= 0.95;
            this.vy *= 0.95;

            // 4. Return to base drift (floating feeling)
            // Much slower random ambient movement
            if (Math.abs(this.vx) < 0.1) this.vx += (Math.random() - 0.5) * 0.02;
            if (Math.abs(this.vy) < 0.1) this.vy += (Math.random() - 0.5) * 0.02;

            // 5. Boundary check - bounce off walls
            if (this.x > width || this.x < 0) this.vx = -this.vx;
            if (this.y > height || this.y < 0) this.vy = -this.vy;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            // Dynamically select color based on current theme
            const palette = isDark ? themeColors.dark : themeColors.light;
            ctx.fillStyle = palette[this.colorIndex];
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        requestAnimationFrame(animate);
    }

    // Event Listeners
    window.addEventListener('resize', resize);

    // Track mouse relative to hero for accurate interaction
    heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    heroSection.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Start
    resize();
    animate();
}

/**
 * Magnetic Buttons Effect
 * Buttons gently attract to cursor
 */
function initMagneticButtons() {
    // Only target anchor tags for nav items to exclude dropdown containers (which are divs)
    const magnetics = document.querySelectorAll('.btn-cta, .btn-secondary, a.nav-link-item');

    magnetics.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Subtle magnetic pull (reduced multiplier for refinement)
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) scale(1.02)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0) scale(1)';
            setTimeout(() => {
                btn.style.transition = 'transform 0.2s';
            }, 0);
        });

        // Reset transition on enter to make movement snappy
        btn.addEventListener('mouseenter', () => {
            btn.style.transition = 'transform 0.1s linear';
        });
    });
}

/**
 * Spotlight Card Effect
 * Subtle glow follows cursor on cards
 */
function initSpotlightCards() {
    const cards = document.querySelectorAll('.feature-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set CSS variables for spotlight position
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initStickyNav();
    initSmoothScroll();
    initEntranceAnimations();
    initParticleSystem();
    initMagneticButtons();
    initSpotlightCards();
});
