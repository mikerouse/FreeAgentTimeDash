# FreeAgent Time Tracker Chrome Extension

A Chrome extension designed specifically for developers with ADHD to track time more effectively across multiple clients with automatic FreeAgent integration.

Extension ID: nbohfjpbcaflnpchhibmhfdjogeafcim
OAuth Redirect URI:
```chrome-extension://nbohfjpbcaflnpchhibmhfdjogeafcim/oauth.html```

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

### 2. FreeAgent API Setup

To connect with FreeAgent, you'll need to create API credentials:

1. Go to [FreeAgent Developer Dashboard](https://dev.freeagent.com/apps)
2. Create a new app with these settings:
   - **App Name**: "Personal Time Tracker" (or whatever you prefer)
   - **OAuth Redirect URIs**: 
     ```
     chrome-extension://[YOUR_EXTENSION_ID]/oauth.html
     ```
   - **Permissions**: `timeslips:read`, `timeslips:write`, `projects:read`, `users:read`

3. After creating the app, note down:
   - Client ID
   - Client Secret

4. Update the OAuth credentials in `oauth.html`:
   ```javascript
   const clientId = 'YOUR_FREEAGENT_CLIENT_ID';
   const clientSecret = 'YOUR_FREEAGENT_CLIENT_SECRET';
   ```

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
├── oauth.html           # FreeAgent OAuth callback handler
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
- Verify your Client ID and Client Secret are correct
- Make sure the redirect URI matches exactly (including extension ID)
- Check that your FreeAgent app has the correct permissions

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
