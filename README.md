# 🚀 CLASP Deployer

A comprehensive deployment system for Google Apps Script projects with both web and command-line interfaces.

## 🎯 **Quick Start Options**

### **Option 1: Desktop App (Recommended)**
- **Double-click** "CLASP Deployer Web.command" on your desktop
- **Interactive CLI** that prompts for URL and project name
- **Immediate deployment** with live progress

### **Option 2: Command Line**
```bash
# Direct deployment with URL
npm run deploy "https://script.google.com/d/YOUR_SCRIPT_ID/edit" "My Project"

# Interactive mode
npm run deploy
```

### **Option 3: Web Interface (when available)**
```bash
npm run web
# Then open http://localhost:3002 in your browser
```

## ✨ Features

- **🌐 Browser-Based**: No installation required - runs in any modern browser
- **⚡ One-Click Deployment**: Deploy CLASP environments with a single click
- **📊 Real-time Progress**: Live deployment progress with detailed logs
- **🔗 Smart URL Parsing**: Automatically handles various Google Apps Script URL formats
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices
- **🎨 Modern UI**: Clean, dark-themed interface with smooth animations

## 🚀 Quick Start

### Option 1: Desktop Shortcut (Recommended)
1. **Double-click** "CLASP Deployer Web.command" on your desktop
2. Your browser will automatically open to `http://localhost:3002`
3. Start deploying!

### Option 2: Manual Start
```bash
# Navigate to the web app directory
cd clasp-deployer-web

# Start the server
npm start

# Open your browser to http://localhost:3002
```

### Option 3: From Project Root
```bash
# Start the web app
npm run web

# Open your browser to http://localhost:3002
```

## 📖 How to Use

### Deploying a Project

1. **Open the web app** in your browser
2. **Enter your script URL** or Script ID:
   - Full URL: `https://script.google.com/d/SCRIPT_ID/edit`
   - Short URL: `https://script.google.com/d/SCRIPT_ID`
   - Direct ID: `SCRIPT_ID`
3. **Optional**: Enter a project name (auto-generated if left empty)
4. **Click "Deploy Environment"** and watch the progress
5. **Success!** Your CLASP environment is deployed

### What Happens During Deployment

The tool automatically:
- ✅ Checks CLASP installation and authentication
- ✅ Parses your script URL to extract the Script ID
- ✅ Creates project structure in `scripts/`
- ✅ Generates `.clasp.json` and `appsscript.json`
- ✅ Pulls existing code or creates basic templates
- ✅ Pushes everything to Google Apps Script

## 🔧 Technical Details

### Architecture

```
clasp-deployer-web/
├── server.js          # Express.js server with deployment API
├── index.html         # Main web interface
├── styles.css         # Modern dark theme
├── app.js            # Frontend JavaScript logic
└── package.json      # Dependencies and scripts
```

### API Endpoints

- `GET /` - Serves the main web interface
- `POST /api/deploy` - Handles deployment requests

### Supported URL Formats

- `https://script.google.com/d/SCRIPT_ID/edit`
- `https://script.google.com/d/SCRIPT_ID`
- `https://script.google.com/macros/s/SCRIPT_ID/exec`
- Direct Script ID: `SCRIPT_ID`

## 🛠️ Development

### Prerequisites

- Node.js 14+ installed
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3002
```

### Project Structure

The web app communicates with your existing `deploy-clasp.js` script through a REST API, providing the same functionality as the command-line version with a beautiful web interface.

## 🌐 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🔒 Security

- Runs locally on `localhost:3002`
- No external data transmission
- All deployment logic runs on your machine
- Same security as command-line CLASP usage

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port 3002 is available
lsof -i :3002

# Kill process using port 3002
kill -9 <PID>
```

### Deployment Fails
- Check the deployment logs in the web interface
- Ensure CLASP is properly authenticated
- Verify your script URL is correct
- Make sure you have access to the Google Apps Script project

### Browser Issues
- Clear browser cache and reload
- Try a different browser
- Check browser console for errors

## 📋 Requirements

- **Node.js**: 14.0.0 or higher
- **Google Account**: With Google Apps Script access
- **Modern Browser**: Any recent version of Chrome, Firefox, Safari, or Edge

## 🎯 Use Cases

### For Beginners
- First-time CLASP users who want a visual interface
- Users who prefer web-based tools over command line
- Teams that need easy deployment access

### For Advanced Users
- Quick deployments without opening terminal
- Visual progress monitoring
- Easy access to project information and links

### For Development Teams
- Standardized deployment process
- Easy onboarding for new team members
- Consistent project setup across different machines

## 📄 License

MIT License - see the main project LICENSE file for details.

---

**🚀 Happy deploying with CLASP Deployer Web!**
