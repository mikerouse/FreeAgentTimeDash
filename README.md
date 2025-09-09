# FreeAgent Time Tracker

A professional desktop time tracking application for FreeAgent users.

## Features

- **Multi-Timer Support**: Track time for 3 different clients simultaneously
- **FreeAgent Integration**: Real OAuth authentication with your FreeAgent account
- **System Integration**: System tray, global shortcuts (Alt+1, Alt+2, Alt+3)
- **Timer Management**: Start/stop timers with visual feedback and notifications
- **Settings**: Configurable time rounding, notifications, and timer names
- **Data Persistence**: Timer states and settings saved between sessions

## Quick Start

1. **Clean Up Development Files** (if needed)
   ```bash
   cleanup.bat
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure FreeAgent App**
   - In your FreeAgent Developer account, set redirect URI to:
   ```
   http://localhost:8080/oauth/callback
   ```

3. **Start Application**
   ```bash
   start.bat
   ```
   or
   ```bash
   npm start
   ```

4. **First Time Setup**
   - Click "⚙️ Settings" 
   - Click "Connect FreeAgent"
   - Login and authorize in browser
   - Return to app - you're connected!

## OAuth Configuration

Your OAuth credentials are securely stored in `src/main/freeagent-config.js`:
- Client ID: `t7BdB9vrNrTG9rcxQXMy7Q`
- Client Secret: Protected in main process
- Redirect URI: `http://localhost:8080/oauth/callback`

## Usage

### Timers
- **Start/Stop**: Click timer buttons or use Alt+1, Alt+2, Alt+3
- **Configure**: Click ⚙️ icons to customize timer names and colors
- **System Tray**: Right-click tray icon for quick access

### Settings
- **Time Rounding**: 15min, 30min, or 1 hour rounding options
- **Notifications**: Enable/disable timer start/stop notifications
- **FreeAgent**: Connect/disconnect your account

### Global Shortcuts
- `Alt+1` - Toggle Timer 1
- `Alt+2` - Toggle Timer 2  
- `Alt+3` - Toggle Timer 3
- `Alt+T` - Show/hide app window
- `Alt+S` - Stop all timers

## File Structure

```
FreeAgentTimeDashCode/
├── main.js                           # Main Electron process
├── preload.js                        # IPC bridge
├── package.json                      # Dependencies and scripts
├── start.bat                         # Windows startup script
├── src/
│   ├── main/
│   │   ├── freeagent-config.js      # OAuth credentials (secure)
│   │   └── oauth-server.js          # OAuth server
│   └── renderer/
│       ├── index.html               # Main UI
│       ├── styles/main.css          # Application styles
│       └── js/
│           ├── app.js               # Application initialization
│           ├── storage-adapter.js   # Data persistence
│           ├── freeagent-api.js     # FreeAgent API client
│           └── time-tracker-clean.js # Timer logic
└── assets/icons/                    # Application icons
```

## Building

To create distributable packages:

```bash
npm run build
```

## Security

- OAuth client secret is never exposed to renderer process
- All credentials stored locally with encryption
- Secure token refresh handled automatically
- HTTPS-only API communication

## License

MIT License
