# ScriptFlow Product Page - Implementation Guide

**Version**: 1.0.0  
**Date**: December 30, 2025  
**Status**: Production-Ready (pending image replacement)

---

## Overview

The ScriptFlow product page is a comprehensive, server-rendered HTML page that showcases the platform's features, use cases, pricing, and social proof. It reuses the exact header, footer, and design system from the landing page to maintain brand consistency.

---

## Quick Start

### 1. Local Preview

```bash
cd /Users/bricelengama/Documents/Marketing\ Opti/Cursor/clasp-deployer-web

# Option A: Python HTTP Server
python3 -m http.server 8000

# Option B: Node.js HTTP Server
npx http-server -p 8000

# Open in browser
open http://localhost:8000/product.html
```

### 2. Production Deployment

The product page is a static HTML file. Deploy it alongside your existing landing page:

```bash
# Copy files to your web server
scp product.html user@server:/var/www/html/
scp -r assets/ user@server:/var/www/html/

# Or deploy via Git
git add product.html assets/js/product.js assets/img/PRODUCT_IMAGES_README.md
git commit -m "Add production-ready product page"
git push origin main
```

---

## File Structure

```
clasp-deployer-web/
├── product.html                          # Main product page (NEW)
├── assets/
│   ├── js/
│   │   └── product.js                    # Product page interactions (NEW)
│   ├── img/
│   │   ├── product-dashboard-hero.webp   # Hero screenshot (placeholder)
│   │   ├── product-og-image.png          # OG image (placeholder)
│   │   ├── feature-*.webp                # 6 feature screenshots (placeholders)
│   │   ├── screenshot-*.webp             # 4 carousel images (placeholders)
│   │   └── PRODUCT_IMAGES_README.md      # Image requirements (NEW)
├── landing.html                          # Landing page (existing)
├── landing.css                           # Shared styles (existing)
├── landing.js                            # Shared interactions (existing)
├── cookie-consent.js                     # GDPR cookie consent (existing)
├── auth.js                               # Authentication (existing, optional)
├── PRODUCT_PAGE_QA_REPORT.md             # QA validation report (NEW)
└── PRODUCT_PAGE_README.md                # This file (NEW)
```

---

## Page Sections

### 1. Hero Section
- **Purpose**: Immediately communicate product value
- **Content**: H1 headline, subheadline, 2 CTAs, hero screenshot
- **CTAs**: "Start Free Trial" (primary), "See Pricing" (secondary)

### 2. Problem → Solution
- **Purpose**: Address user pain points and position ScriptFlow as the solution
- **Content**: 4 cards (2 problems, 2 solutions)
- **Design**: Grid layout with hover effects

### 3. Key Features (6 cards)
- Unified IDE
- Version Control
- Deploy & Sync
- Live Logs & Alerts
- Integrated Debugger & Tests
- Team Collaboration

**Each card includes**:
- Icon
- 1-line benefit
- 2-line detail
- Micro-screenshot (300x180px)

### 4. Use Cases (4 verticals)
- Agencies
- Operations Teams
- Citizen Developers
- Enterprises

**Each includes**:
- Title with icon
- 4 bullet points describing benefits

### 5. Screenshots Carousel
- **Purpose**: Visual product tour
- **Content**: 4 full-size screenshots (1000x600px)
- **Features**: Keyboard navigation (arrow keys), indicators, auto-advance, lightbox expansion

### 6. Pricing Teaser
- **Purpose**: Drive conversion with clear pricing
- **Content**: 3 pricing tiers (Free, Pro, Enterprise)
- **Design**: Grid layout, "Most Popular" badge on Pro plan

### 7. Social Proof
- **Purpose**: Build trust with testimonials and integrations
- **Content**: 3 testimonial cards, 6 integration logos
- **Testimonials**: Customer name, role, company, 5-star rating

### 8. FAQ (6 questions)
- **Purpose**: Answer common objections
- **Features**: Native `<details>` accordion, keyboard accessible
- **Analytics**: Track which questions are expanded

### 9. Footer CTA
- **Purpose**: Final conversion opportunity
- **Content**: Repeated CTA + link to docs

---

## Analytics Events

All events are pushed to `window.dataLayer` and are compatible with Google Tag Manager and GA4.

### Standard Events

| Event Name | Trigger | Data |
|-----------|---------|------|
| `page_view` | Page load | page_title, page_location, page_type |
| `cta_click` | Any CTA button | cta_text, cta_id, cta_location |
| `pricing_click` | Pricing plan selection | plan, pricing_location |
| `screenshot_view` | Carousel navigation | screenshot_index, screenshot_total |
| `lightbox_open` / `lightbox_close` | Screenshot expansion | image_alt |
| `feature_explore` | Feature card click | feature_name |
| `use_case_view` | Use case card click | use_case |
| `faq_interaction` | FAQ expand/collapse | question, action |
| `scroll_depth` | Scroll milestones | percent_scrolled (25, 50, 75, 100) |
| `time_on_page` | Every 30 seconds | seconds |
| `carousel_navigation` | Prev/Next/Indicator | direction, target_slide |

### Testing Analytics

Open browser console and check `window.dataLayer`:

```javascript
// View all tracked events
console.table(window.dataLayer);

// Click a CTA and verify event
// Expected output:
{
  event: 'cta_click',
  cta_text: 'Start Free Trial',
  cta_id: 'hero-cta-primary',
  cta_location: 'product_hero',
  page_location: '/product.html'
}
```

---

## SEO & Structured Data

### Meta Tags
- **Title**: "ScriptFlow Product — Unified IDE for Apps Script & Automation Workflows"
- **Description**: 160 characters, includes primary keywords
- **Canonical**: https://scriptflowapp.space/product.html
- **Open Graph**: 5 tags (title, description, image, url, type)
- **Twitter Card**: 5 tags (card, site, title, description, image)

### JSON-LD Structured Data
1. **Organization** - Company info, social profiles, contact
2. **SoftwareApplication** - Product details, pricing, ratings
3. **Website** - Site info, search action
4. **FAQPage** - 6 FAQ questions with answers

### Validation
After deployment, validate structured data:
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org/

---

## Accessibility Features

### WCAG 2.1 AA Compliance
- ✅ Semantic HTML5 elements (`<header>`, `<main>`, `<section>`, `<footer>`)
- ✅ Skip-to-content link for keyboard users
- ✅ All images have meaningful alt text
- ✅ Color contrast meets WCAG AA standards
- ✅ All interactive elements are keyboard accessible
- ✅ ARIA labels on complex controls (carousel, accordion)
- ✅ Focus-visible outline (3px blue) for keyboard navigation

### Keyboard Navigation
- **Tab**: Navigate between interactive elements
- **Enter/Space**: Activate buttons and links
- **Arrow Left/Right**: Navigate carousel
- **Escape**: Close lightbox

### Screen Reader Support
- All images have descriptive alt text
- ARIA labels on carousel controls
- Live region for carousel announcements
- Native `<details>` element for FAQ (built-in accessibility)

---

## Performance Optimizations

### Lighthouse Targets
- **Performance**: 95+ (Target: +20 vs landing page baseline)
- **Accessibility**: 95+
- **SEO**: 98+
- **Best Practices**: 95+

### Critical Rendering Path
- Inline critical CSS (hero section styles)
- Deferred JavaScript (`defer` attribute)
- Preloaded fonts
- Optimized images (WebP, lazy loading)

### Image Optimization
- **Format**: WebP (30% smaller than JPG/PNG)
- **Lazy Loading**: Applied to below-the-fold images
- **Eager Loading**: Hero image (LCP optimization)
- **Dimensions**: Width/height attributes prevent CLS

### Core Web Vitals
- **LCP (Largest Contentful Paint)**: <2.5s (hero image optimized)
- **FID (First Input Delay)**: <100ms (no blocking scripts)
- **CLS (Cumulative Layout Shift)**: <0.1 (width/height set on images)

---

## Browser Support

### Supported Browsers
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅
- Opera 76+ ✅

### Progressive Enhancement
- **JavaScript disabled**: Content remains accessible, interactive features disabled
- **CSS disabled**: Semantic HTML ensures readability
- **Images disabled**: Alt text provides context

---

## Customization Guide

### Updating Copy
All content is in `product.html`. Search for these sections:
- Hero headline: Line ~233
- Feature cards: Line ~559
- Use cases: Line ~658
- Pricing: Line ~788
- Testimonials: Line ~932
- FAQ: Line ~1046

### Replacing Images
See `assets/img/PRODUCT_IMAGES_README.md` for detailed requirements.

**Quick replacement**:
```bash
cd assets/img

# Replace hero screenshot
cp /path/to/your/dashboard-screenshot.webp product-dashboard-hero.webp

# Replace feature screenshots
cp /path/to/feature1.webp feature-unified-ide.webp
# ... repeat for all 6 features

# Replace carousel screenshots
cp /path/to/screenshot1.webp screenshot-dashboard.webp
# ... repeat for all 4 carousel images
```

### Updating Analytics IDs
In `product.html`, line ~127:
```javascript
window.GTM_CONTAINER_ID = 'GTM-XXXXXXX'; // Replace with your GTM ID
window.GA4_MEASUREMENT_ID = 'G-PZ1SQN4MRY'; // Replace with your GA4 ID
```

### Customizing Colors
Colors are inherited from `landing.css` via CSS variables:
```css
:root {
  --brand-blue: #4285f4;
  --brand-google-red: #ea4335;
  --brand-google-yellow: #fbbc04;
  --brand-google-green: #34a853;
}
```
To customize, add a `<style>` block in `product.html` or modify `landing.css`.

---

## Testing Checklist

### Manual Testing
- [ ] Hero section displays correctly
- [ ] All 6 feature cards render with images
- [ ] Carousel navigates with prev/next buttons
- [ ] Carousel indicators work
- [ ] Clicking screenshot opens lightbox
- [ ] Lightbox closes on X, Escape, or background click
- [ ] Pricing cards display all 3 plans
- [ ] FAQ accordion expands/collapses
- [ ] All CTAs point to correct destinations
- [ ] Footer links resolve correctly
- [ ] Page is responsive on mobile/tablet/desktop

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Accessibility Testing
- [ ] Keyboard navigation works (Tab, Enter, Arrow keys)
- [ ] Skip-to-content link appears on Tab
- [ ] Screen reader announces all content (test with VoiceOver/NVDA)
- [ ] Color contrast passes WCAG AA (use Lighthouse or axe DevTools)

### Performance Testing
```bash
# Run Lighthouse
lighthouse http://localhost:8000/product.html --view
```
- [ ] Performance score >= 95
- [ ] Accessibility score >= 95
- [ ] SEO score >= 98

### Analytics Testing
Open DevTools Console:
```javascript
// Check dataLayer exists
console.log(window.dataLayer);

// Click a CTA button
// Verify event appears in dataLayer

// Open GA4 Real-Time view (after deployment)
// Verify events are received
```

---

## Troubleshooting

### Issue: Images not loading
**Solution**: Check file paths in `product.html`. All image paths should be relative:
```html
<img src="assets/img/product-dashboard-hero.webp" alt="...">
```

### Issue: Analytics events not firing
**Solution**: 
1. Check cookie consent is accepted (analytics only load after consent)
2. Verify `window.dataLayer` exists in console
3. Check browser console for errors

### Issue: Carousel not working
**Solution**: 
1. Verify `product.js` is loaded (`defer` attribute)
2. Check browser console for JavaScript errors
3. Ensure carousel HTML structure is intact

### Issue: Styles not applying
**Solution**: 
1. Verify `landing.css` is loaded
2. Check for CSS specificity conflicts
3. Clear browser cache

### Issue: Lightbox not opening
**Solution**: 
1. Verify `product.js` is loaded
2. Check that images have `cursor: pointer` style
3. Ensure lightbox HTML exists in page

---

## Deployment Guide

### Pre-Deployment Checklist
- [ ] Replace all placeholder images with actual screenshots
- [ ] Update GTM Container ID to production value
- [ ] Update GA4 Measurement ID to production value
- [ ] Run Lighthouse audit (all scores >= 95)
- [ ] Validate JSON-LD (Google Rich Results test)
- [ ] Test all links (internal and external)
- [ ] Verify email links work
- [ ] Check responsive design on real devices

### Server Configuration
```nginx
# Nginx example
server {
    listen 443 ssl http2;
    server_name scriptflowapp.space;

    # Enable Gzip compression
    gzip on;
    gzip_types text/html text/css application/javascript image/svg+xml;

    # Cache static assets
    location ~* \.(webp|jpg|png|gif|svg|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML no-cache
    location ~ \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### Post-Deployment
1. **Verify page loads**: https://scriptflowapp.space/product.html
2. **Test analytics**: Check GA4 Real-Time view
3. **Submit sitemap**: Google Search Console
4. **Monitor performance**: Core Web Vitals report
5. **Set up alerts**: Uptime monitoring, error tracking

---

## Maintenance

### Regular Updates
- **Monthly**: Review analytics, update testimonials if new ones available
- **Quarterly**: Refresh screenshots if UI changes
- **Annually**: Update pricing, revise copy based on user feedback

### A/B Testing Opportunities
1. Hero headline variations
2. CTA button text ("Start Free Trial" vs "Get Started Free")
3. Pricing tier order
4. Testimonial rotation
5. Feature card order

---

## Support & Resources

### Documentation
- **QA Report**: `PRODUCT_PAGE_QA_REPORT.md`
- **Image Requirements**: `assets/img/PRODUCT_IMAGES_README.md`
- **Landing Page**: `landing.html` (reference for design patterns)

### External Tools
- **Lighthouse**: https://developers.google.com/web/tools/lighthouse
- **Rich Results Test**: https://search.google.com/test/rich-results
- **PageSpeed Insights**: https://pagespeed.web.dev/
- **Schema Validator**: https://validator.schema.org/

### Contact
For questions or issues, contact the ScriptFlow development team.

---

## License & Credits

**Copyright**: © 2025 ScriptFlow. All rights reserved.

**Design System**: Based on ScriptFlow landing page (landing.html)

**Dependencies**:
- Google Fonts (Open Source)
- Font Awesome (Free license)
- No other external libraries

---

**Last Updated**: December 30, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production-Ready

