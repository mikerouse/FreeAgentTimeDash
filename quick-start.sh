#!/bin/bash

echo "🚀 Quick Start - FreeAgent Time Tracker"
echo "======================================"

# Check if we have node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if electron-store is installed (required for simplified version)
if [ ! -d "node_modules/electron-store" ]; then
    echo "📦 Installing electron-store..."
    npm install electron-store
fi

echo "✅ Dependencies ready"

# Run syntax check on critical files
echo ""
echo "🔍 Checking syntax..."

files=("main-simple.js" "preload-simple.js" "src/renderer/js/storage-adapter-simple.js" "src/renderer/js/time-tracker-clean.js")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        if node -c "$file" 2>/dev/null; then
            echo "✅ $file"
        else
            echo "❌ $file has syntax errors"
            exit 1
        fi
    else
        echo "⚠️  Missing: $file"
    fi
done

echo ""
echo "🚀 Starting Electron app..."
echo ""

# Set development environment
export NODE_ENV=development

# Run the app
npm run dev