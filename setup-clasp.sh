#!/bin/bash

# Google Apps Script CLASP Setup Script
echo "🚀 Setting up Google Apps Script CLASP environment..."

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo "❌ CLASP not found. Installing..."
    npm install -g @google/clasp
fi

# Check if user is logged in
echo "🔐 Checking CLASP authentication..."
if ! clasp status &> /dev/null; then
    echo "⚠️  Not logged in to CLASP. Please run:"
    echo "   npm run setup:auth"
    echo "   or: npx clasp login"
else
    echo "✅ CLASP is authenticated"
fi

echo ""
echo "📋 Available commands:"
echo "  npm run setup:auth     - Login to Google"
echo "  npm run setup:check    - Check CLASP status"
echo "  npm run deploy         - 🚀 Deploy new CLASP environment from URL"
echo "  npm run build-push     - Build TypeScript and push all"
echo "  npm run bpo:push       - Push BPO Weekly Offenders script"
echo "  npm run ops:push       - Push OPS x WFM to Make script"
echo "  npm run scripts:list   - List available scripts"
echo ""
echo "🎯 Quick start:"
echo "  1. npm run deploy        # 🚀 Deploy from script URL"
echo "  2. npm run setup:auth    # Alternative: manual auth"
echo "  3. npm run build-push    # Push all changes"
echo "  4. npm run bpo:open      # Open BPO script"
echo ""
echo "✨ Setup complete!"
