#!/bin/bash

# Debug startup script for FreeAgent Time Tracker

echo "🐛 FreeAgent Time Tracker - Debug Mode"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in project directory. Please run from FreeAgentTimeDashCode/"
    exit 1
fi

echo "📁 Current directory: $(pwd)"

# Check Node.js
echo ""
echo "🔍 Checking Node.js..."
if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js found: $(node --version)"
else
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

# Check dependencies
echo ""
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules found"
else
    echo "⚠️  node_modules not found. Running npm install..."
    npm install
fi

# Check critical files
echo ""
echo "📄 Checking critical files..."

files=(
    "main.js"
    "preload.js"
    "src/renderer/index.html"
    "src/renderer/js/storage-adapter.js"
    "src/renderer/js/freeagent-api.js"
    "src/renderer/js/time-tracker-clean.js"
    "src/renderer/js/app.js"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo ""
    echo "❌ Some critical files are missing. Please check the project structure."
    exit 1
fi

# Check for syntax errors
echo ""
echo "🔍 Checking for JavaScript syntax errors..."

js_files=(
    "src/renderer/js/storage-adapter.js"
    "src/renderer/js/freeagent-api.js" 
    "src/renderer/js/time-tracker-clean.js"
    "src/renderer/js/app.js"
)

for file in "${js_files[@]}"; do
    if node -c "$file" 2>/dev/null; then
        echo "✅ $file - syntax OK"
    else
        echo "❌ $file - syntax error"
        echo "   Run: node -c $file"
    fi
done

# Test page option
echo ""
echo "🧪 Test Options:"
echo "1. Open test page in browser: file://$(pwd)/test.html"
echo "2. Run Electron app: npm run dev"
echo ""

# Ask user what to do
read -p "Would you like to (1) open test page, (2) run app, or (q) quit? " choice

case $choice in
    1)
        echo "Opening test page..."
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "test.html"
        elif command -v open >/dev/null 2>&1; then
            open "test.html"
        else
            echo "Please open test.html in your browser manually"
        fi
        ;;
    2)
        echo "Starting Electron app..."
        npm run dev
        ;;
    q|Q)
        echo "Goodbye!"
        ;;
    *)
        echo "Invalid choice. Run script again to try."
        ;;
esac