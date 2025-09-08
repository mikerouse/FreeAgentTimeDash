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
