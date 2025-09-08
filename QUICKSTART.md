# Quick Start Scripts

## Development
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

## Building

### All Platforms
```bash
npm run build
```

### Specific Platforms  
```bash
# Windows only
npm run build-win

# macOS only  
npm run build-mac

# Linux only
npm run build-linux
```

## First Time Setup

1. **Install Node.js 16+**
2. **Clone repository**
3. **Install dependencies:** `npm install`
4. **Configure FreeAgent API credentials**
5. **Run:** `npm run dev`

## FreeAgent API Setup

1. Go to https://dev.freeagent.com
2. Create new application
3. Set OAuth redirect to: `http://localhost:8080/oauth/callback`
4. Copy Client ID to `src/renderer/js/freeagent-api.js`
5. Set Client Secret (secure this in production)

## Troubleshooting

### "Cannot find module" error
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
npm install electron-builder --save-dev
npm run build
```

### App won't start
- Check Node.js version: `node --version`
- Clear cache and reinstall dependencies
- Check console for error messages