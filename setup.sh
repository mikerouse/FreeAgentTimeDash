#!/bin/bash

# FreeAgent Time Tracker - Development Setup Script

echo "🚀 FreeAgent Time Tracker - Desktop App Setup"
echo "=============================================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version too old. Please install Node.js 16 or higher."
    echo "   Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
if npm install; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if we have required dependencies
echo ""
echo "🔍 Checking dependencies..."

if [ ! -d "node_modules/electron" ]; then
    echo "❌ Electron not installed correctly"
    exit 1
fi

if [ ! -d "node_modules/electron-store" ]; then
    echo "❌ electron-store not installed correctly"
    exit 1
fi

echo "✅ All dependencies verified"

# Create icons directory if it doesn't exist
if [ ! -d "assets/icons" ]; then
    echo ""
    echo "📁 Creating assets directory..."
    mkdir -p assets/icons
    echo "✅ Assets directory created"
fi

# Create placeholder icons (simple colored rectangles)
echo ""
echo "🎨 Creating placeholder icons..."

# Note: In a real deployment, you'd create proper icons
# For now, we'll just create the directory structure
touch assets/icons/icon.png
touch assets/icons/icon.ico  
touch assets/icons/icon.icns
touch assets/icons/tray-icon.png
touch assets/icons/timer-active.png

echo "✅ Icon placeholders created"

# Configuration check
echo ""
echo "⚙️ Configuration Check"
echo "======================"

if grep -q "YOUR_DESKTOP_CLIENT_ID" src/renderer/js/freeagent-api.js; then
    echo "⚠️  FreeAgent API not configured yet"
    echo "   Please update src/renderer/js/freeagent-api.js with your:"
    echo "   - Client ID"
    echo "   - Client Secret"
    echo ""
    echo "   Get these from: https://dev.freeagent.com"
else
    echo "✅ FreeAgent API configured"
fi

# Final status
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Configure FreeAgent API credentials (if not done)"
echo "2. Add proper app icons to assets/icons/"
echo "3. Run the app:"
echo ""
echo "   npm run dev     # Development mode"
echo "   npm run build   # Production build"
echo ""
echo "For more information, see README.md and QUICKSTART.md"
echo ""