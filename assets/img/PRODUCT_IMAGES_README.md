# Product Page Images - Requirements

This document lists all images required for the product page. Replace placeholders with actual optimized images.

## Required Images (Priority Order)

### 1. Hero Section
- **File**: `product-dashboard-hero.webp`
- **Dimensions**: 1000x600px (16:9 ratio)
- **Description**: Main product UI screenshot showing the unified dashboard interface with project list, deployment controls, and live logs
- **Alt text**: "ScriptFlow unified dashboard interface showing project list, deployment controls, and live logs"
- **Format**: WebP with JPG fallback
- **Optimization**: Compress to <150KB

### 2. Open Graph Image
- **File**: `product-og-image.png`
- **Dimensions**: 1200x630px (OG standard)
- **Description**: Product hero image for social media sharing
- **Alt text**: "ScriptFlow Product - Unified IDE for Automation"
- **Format**: PNG (required by OG)
- **Optimization**: Compress to <300KB

### 3. Feature Screenshots (Micro-screenshots)
All feature screenshots should be 300x180px, WebP format, compressed to <50KB each.

- **File**: `feature-unified-ide.webp`
  - Alt: "Unified IDE showing multiple project types"
  
- **File**: `feature-version-control.webp`
  - Alt: "Version control interface with deployment history"
  
- **File**: `feature-deploy-sync.webp`
  - Alt: "One-click deployment interface"
  
- **File**: `feature-live-logs.webp`
  - Alt: "Live log streaming terminal"
  
- **File**: `feature-debugger.webp`
  - Alt: "Debugging interface with breakpoints"
  
- **File**: `feature-team-collab.webp`
  - Alt: "Team collaboration dashboard"

### 4. Carousel Screenshots
All carousel screenshots should be 1000x600px, WebP format, compressed to <200KB each.

- **File**: `screenshot-dashboard.webp`
  - Alt: "ScriptFlow main dashboard with project overview and quick actions"
  
- **File**: `screenshot-deploy.webp`
  - Alt: "Deployment interface showing version history and rollback options"
  
- **File**: `screenshot-logs.webp`
  - Alt: "Live logs terminal with real-time execution monitoring"
  
- **File**: `screenshot-ai-converter.webp`
  - Alt: "AI Blueprint Converter interface converting Make.com workflow"

## Image Optimization Guidelines

### WebP Generation
Use the following command to convert existing images to WebP:
```bash
cwebp -q 80 input.png -o output.webp
```

### Responsive srcset (Optional Enhancement)
For better performance, consider adding responsive srcset:
```html
<img 
  src="image.webp" 
  srcset="image-480w.webp 480w, image-768w.webp 768w, image-1200w.webp 1200w"
  sizes="(max-width: 768px) 100vw, 1000px"
  alt="Description"
  width="1000"
  height="600"
  loading="lazy"
>
```

### Fallback Images
Provide JPG fallbacks for older browsers:
```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.jpg" type="image/jpeg">
  <img src="image.jpg" alt="Description" width="1000" height="600">
</picture>
```

## Placeholder Generation (Temporary)

Until actual screenshots are available, you can:

1. **Use Existing Dashboard Preview**:
   - Copy `dashboard-preview.webp` and rename/duplicate for placeholder use

2. **Generate Placeholders with Text**:
   - Use online tools like placeholder.com: `https://via.placeholder.com/1000x600/4285f4/ffffff?text=Product+Dashboard`

3. **Screenshot Your Dev Environment**:
   - Take actual screenshots of the dashboard, IDE, logs, etc. from the running app

## Image Checklist

- [ ] Hero: product-dashboard-hero.webp (1000x600)
- [ ] OG Image: product-og-image.png (1200x630)
- [ ] Feature: feature-unified-ide.webp (300x180)
- [ ] Feature: feature-version-control.webp (300x180)
- [ ] Feature: feature-deploy-sync.webp (300x180)
- [ ] Feature: feature-live-logs.webp (300x180)
- [ ] Feature: feature-debugger.webp (300x180)
- [ ] Feature: feature-team-collab.webp (300x180)
- [ ] Carousel: screenshot-dashboard.webp (1000x600)
- [ ] Carousel: screenshot-deploy.webp (1000x600)
- [ ] Carousel: screenshot-logs.webp (1000x600)
- [ ] Carousel: screenshot-ai-converter.webp (1000x600)

## Quick Placeholder Setup

Run this command to create symbolic links to existing dashboard image as temporary placeholders:

```bash
cd assets/img
ln -s dashboard-preview.webp product-dashboard-hero.webp
ln -s og-image.png product-og-image.png
ln -s dashboard-preview.webp feature-unified-ide.webp
ln -s dashboard-preview.webp feature-version-control.webp
ln -s dashboard-preview.webp feature-deploy-sync.webp
ln -s dashboard-preview.webp feature-live-logs.webp
ln -s dashboard-preview.webp feature-debugger.webp
ln -s dashboard-preview.webp feature-team-collab.webp
ln -s dashboard-preview.webp screenshot-dashboard.webp
ln -s dashboard-preview.webp screenshot-deploy.webp
ln -s dashboard-preview.webp screenshot-logs.webp
ln -s dashboard-preview.webp screenshot-ai-converter.webp
```

This will make the page functional immediately while you replace with proper screenshots.

