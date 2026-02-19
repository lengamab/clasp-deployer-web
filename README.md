# 🚀 ScriptFlow: Reclaiming Serverless Automation

[![Deploy to Cloud Run](https://github.com/lengamab/clasp-deployer-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/lengamab/clasp-deployer-web/actions/workflows/deploy.yml)

**ScriptFlow** is a professional developer platform that bridges the gap between high-overhead no-code tools (Make.com, Zapier, n8n) and the cost-effective power of **Google Apps Script**.

Save up to **90% on automation operation costs** by converting visual logic into high-performance, serverless code that runs for free on Google Cloud infrastructure.

---

## ✨ Key Features

### 🤖 AI Blueprint Converter
Stop paying per "Operation." Export your Make.com, Zapier, or n8n blueprints as JSON and use our AI engine to convert them into production-ready Google Apps Script in seconds.

### �️ Professional Unified IDE
Bring modern software engineering standards to Apps Script:
- **Full Version Control**: Native CLASP integration for Git-like project management.
- **Visual Execution Monitoring**: Track logs, errors, and performance across all projects in one dashboard.
- **Multi-Environment Support**: Seamlessly manage Dev, Staging, and Production deployments.

### ⚡ Instant Deployment
Deploy changes to the Google Cloud in under 60 seconds. Our unified interface handles the complexity of authentication, project creation, and code pushing.

---

## 🎯 Quick Start

### Cloud Deployment (Production)
ScriptFlow is optimized for Google Cloud Run. Every push to the `main` branch automatically builds and deploys to production via **GitHub Actions**.

- **URL**: [scriptflowapp.space](https://scriptflowapp.space)

### Local Development
To run ScriptFlow on your machine:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Google Auth**:
   Ensure you have `clasp` installed and authenticated:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
3. **Start the Server**:
   ```bash
   npm start
   # Open http://localhost:8080
   ```

---

## 🏗️ Technical Architecture

ScriptFlow is built for speed and reliability:
- **Frontend**: Vanilla JS with modern CSS3 (Glassmorphism design).
- **Backend**: Node.js / Express.js served via Docker.
- **Database**: High-performance SQLite for local state management.
- **Deployment**: Google Cloud Run + Container Registry.
- **CI/CD**: GitHub Actions using `google-github-actions`.

---

## 🔍 SEO & Visibility
ScriptFlow is technically optimized for top-tier search visibility:
- **Rich Snippets**: Full `SoftwareApplication` and `VideoObject` schema integration.
- **High Intent Content**: Targeted landing pages for "Make.com vs Apps Script" and "Zapier vs Apps Script."
- **Performance**: Average page size <50KB with optimized WebP assets.

---

## 🤝 Contributing
Contributions are welcome! Whether it's improving the AI converter logic or refining the IDE experience, feel free to open a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

© 2026 ScriptFlow. Reclaiming automation for developers.
