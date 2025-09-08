# FreeAgent Time Tracker Chrome Extension

A Chrome extension designed specifically for developers with ADHD to track time more effectively across multiple clients with automatic FreeAgent integration.

## Security Implementation

✅ **OAuth credentials are secured using:**
- Chrome Identity API for authentication flow
- Proxy server on Render.com for token exchange
- Client secret stored only on server (never in extension code)
- Ready for Chrome Web Store submission

## Features

- **3 simultaneous timers** with one-click start/stop
- **Always visible** - persistent in browser with visual indicators
- **ADHD-friendly reminders** - obvious notifications during work hours
- **Keyboard shortcuts** (Alt+1, Alt+2, Alt+3)
- **Automatic FreeAgent sync** via API
- **Idle detection** with smart pause suggestions
- **Visual feedback** - animated active timers, color coding

## Setup Instructions

### 1. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the folder containing these files
4. The Time Tracker icon should appear in your browser toolbar

### 2. FreeAgent Connection

The extension uses secure OAuth authentication:

1. **Proxy Server**: Deployed at `https://freeagenttimedash.onrender.com`
2. **Client ID**: `t7BdB9vrNrTG9rcxQXMy7Q` (configured in extension)
3. **Client Secret**: Stored securely on proxy server
4. **OAuth Flow**: Chrome Identity API handles authentication

To connect:
1. Click the extension icon
2. Click "Connect FreeAgent"
3. Authorize the application
4. Start tracking time!

### 3. Find Your Extension ID

1. Go to `chrome://extensions/`
2. Find "FreeAgent Time Tracker" in the list
3. Copy the ID (long string of letters) under the extension name
4. Update your FreeAgent app's redirect URI with this ID

### 4. Test the Extension

1. Click the extension icon to open the popup
2. Try starting/stopping timers
3. Test keyboard shortcuts (Alt+1, Alt+2, Alt+3)
4. Connect to FreeAgent when ready

## File Structure

```
/
├── manifest.json          # Extension configuration
├── popup.html            # Main interface
├── popup.js              # UI logic and timer controls
├── background.js         # Persistent timer logic and notifications
├── auth.js              # Secure OAuth authentication service
├── oauth.html           # (Deprecated - kept for reference)
├── icons/               # Extension icons (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## Development Notes

### Current Features
- ✅ Basic timer functionality
- ✅ Local storage persistence
- ✅ Chrome extension popup UI
- ✅ Keyboard shortcuts
- ✅ Badge notifications
- ✅ FreeAgent OAuth flow (needs credentials)
- ✅ Idle detection
- ✅ Work hours reminders

### Missing Icons
You'll need to add icon files to the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels) 
- `icon128.png` (128x128 pixels)

You can create simple colored circles or use a timer icon. For now, the extension will work without them but may show missing icon warnings.

### Next Development Steps

1. **Test basic functionality** without FreeAgent first
2. **Add FreeAgent credentials** and test OAuth flow
3. **Customize client names** in the storage
4. **Add project mapping** between timers and FreeAgent projects
5. **Implement retry logic** for failed API calls
6. **Add time adjustment UI** for correcting entries
7. **Create settings page** for configuration

## ADHD-Specific Features

- **Obvious visual feedback** - active timers pulse and change color
- **Browser badge** shows number of active timers
- **Smart reminders** every 30 minutes during work hours if no timer is running
- **Keyboard shortcuts** for quick switching without mouse
- **Forgiveness features** - easy time adjustment and backfilling
- **Always visible** - persistent in browser, survives restarts

## Troubleshooting

### Extension won't load
- Check that all files are in the same folder
- Make sure Developer mode is enabled in Chrome
- Check the console for error messages

### FreeAgent connection fails
- Ensure proxy server is running at https://freeagenttimedash.onrender.com
- Check that your extension ID matches the FreeAgent redirect URI
- Verify FreeAgent app permissions are correct
- Check browser console for specific error messages

### Timers don't persist
- Check Chrome storage permissions
- Try reloading the extension
- Look for JavaScript errors in the console

## Future Enhancements

- **Team features** for agencies
- **Advanced reporting** and analytics
- **Integration with other tools** (Toggl, Harvest, etc.)
- **Mobile companion** for cross-device tracking
- **Project templates** and smart suggestions
- **Time blocking** integration with calendar

## Contributing

This is a personal project but feel free to fork and modify for your own use. The code is structured to be easily extensible.

# FreeAgent Time Tracker Desktop App

A professional desktop time tracking application with FreeAgent integration, built with Electron.

## 🎯 Features

- **Desktop Native**: Standalone app with system tray integration
- **Global Shortcuts**: Alt+1, Alt+2, Alt+3 for instant timer control
- **FreeAgent Integration**: Direct timeslip creation and project sync
- **Smart Time Rounding**: Professional 30-minute default with customizable options
- **Always Available**: Minimize to tray, never lose your timers
- **Cross Platform**: Windows, macOS, and Linux support
- **Auto Updates**: Seamless background updates

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ installed
- FreeAgent developer account (for API access)

### Installation

1. **Clone and install dependencies:**
```bash
cd FreeAgentTimeDashCode
npm install
```

2. **Configure FreeAgent API:**
   - Update `src/renderer/js/freeagent-api.js` with your FreeAgent client ID
   - Set up OAuth redirect handling

3. **Run in development:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
```

## 📦 Building Distributables

### Windows
```bash
npm run build-win
```
Creates: `dist/FreeAgent Time Tracker Setup.exe`

### macOS
```bash
npm run build-mac  
```
Creates: `dist/FreeAgent Time Tracker.dmg`

### Linux
```bash
npm run build-linux
```
Creates: `dist/FreeAgent Time Tracker.AppImage`

## 🎮 Usage

### Quick Start
1. Launch the app
2. Use Alt+1, Alt+2, Alt+3 to start/stop timers
3. Click the cog icon to configure timer projects
4. Connect to FreeAgent for automatic timeslip creation

### System Tray
- **Click**: Show/hide main window
- **Right-click**: Quick timer controls and settings
- **Double-click**: Always show main window

### Keyboard Shortcuts
- `Alt+1/2/3`: Toggle timers 1, 2, 3
- `Alt+T`: Show main window
- `Alt+S`: Stop all running timers
- `Escape`: Close open panels
- `Ctrl/Cmd+S`: Save active form

## 🔧 Configuration

### Timer Setup
1. Click the ⚙️ button next to any timer
2. Set timer name and color
3. Connect to FreeAgent and select client/project
4. Save configuration

### FreeAgent Connection
1. Click "Setup FreeAgent" 
2. Follow OAuth authentication flow
3. Grant permissions to your FreeAgent account
4. Timers will now sync timeslips automatically

### Settings
- **Time Rounding**: 15min, 30min, 1hour intervals
- **Rounding Method**: Round to nearest vs always round up
- **Notifications**: Control timer start/stop notifications
- **Auto-save**: Automatically save drafts when timers stop

## 📁 Project Structure

```
src/
├── renderer/          # Frontend (HTML/CSS/JS)
│   ├── index.html    # Main application window
│   ├── styles/       # CSS stylesheets
│   └── js/           # Application logic
│       ├── app.js           # Main app initialization
│       ├── time-tracker.js  # Timer management
│       ├── freeagent-api.js # FreeAgent integration
│       └── storage-adapter.js # Storage abstraction
├── main/             # Electron main process (future)
main.js               # Main Electron process
preload.js           # Secure context bridge
package.json         # Dependencies and build config
```

## 🔒 Security

- **Context Isolation**: Renderer process is isolated from Node.js
- **Secure Storage**: API tokens encrypted with electron-store
- **CSP Headers**: Content Security Policy prevents code injection
- **No Node Integration**: Renderer cannot access Node.js directly

## 🛠 Development

### Debug Mode
```bash
npm run dev
```
- Opens DevTools automatically
- Hot reload enabled
- Verbose logging

### Production Build
```bash
npm run build
```
- Optimized bundles
- Auto-updater enabled
- Code signing (if configured)

## 📋 Roadmap

### Phase 1: Core Functionality ✅
- [x] Timer management
- [x] Desktop app structure
- [x] System tray integration
- [x] Global shortcuts
- [x] FreeAgent API integration

### Phase 2: Enhanced Features (In Progress)
- [ ] OAuth callback server
- [ ] Offline timeslip queue
- [ ] Time reporting dashboard
- [ ] Export functionality
- [ ] Multi-language support

### Phase 3: Advanced Features
- [ ] Team collaboration
- [ ] Invoice integration
- [ ] Advanced reporting
- [ ] Mobile companion app
- [ ] Browser extension sync

## 🐛 Troubleshooting

### App Won't Start
1. Check Node.js version (16+ required)
2. Run `npm install` to update dependencies
3. Clear cache: `npm run clean` (if available)

### FreeAgent Connection Issues
1. Verify API credentials in freeagent-api.js
2. Check OAuth redirect URL matches FreeAgent app settings
3. Ensure internet connection is stable

### Performance Issues
1. Close unnecessary panels
2. Clear application cache via Settings
3. Restart application
4. Update to latest version

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check README and inline comments
- FreeAgent API: https://dev.freeagent.com

---

**Built with ❤️ using Electron and modern web technologies**
