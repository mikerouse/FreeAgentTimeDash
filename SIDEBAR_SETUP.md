# Side Panel Setup and Extension ID Management

## Extension ID Issue
When developing Chrome extensions in unpacked mode, the extension ID changes each time you reload the extension. This affects OAuth redirect URLs.

## Solutions for Extension ID:

### Option 1: Get Current Extension ID (Recommended for Development)
1. Go to `chrome://extensions/`
2. Find "FreeAgent Time Tracker" 
3. Copy the extension ID (long string of letters)
4. Use this ID in your FreeAgent app OAuth settings

### Option 2: Create Fixed Extension ID (For Production)
To generate a proper key for a fixed extension ID:
1. Use Chrome's extension key generation tools
2. Or publish the extension to Chrome Web Store (which assigns a permanent ID)

## Current OAuth Redirect URL Format
```
chrome-extension://[YOUR-EXTENSION-ID]/auth.html
```

Replace `[YOUR-EXTENSION-ID]` with the actual ID from chrome://extensions/

## Side Panel Support
The extension now supports Chrome's side panel feature:

1. **Reload the extension** in Chrome extensions page
2. **Enable side panel**: The extension will automatically request side panel permissions  
3. **Access via toolbar**: Click the extension icon in the toolbar to open in side panel
4. **Persistent view**: The side panel stays open while browsing

## Button Functionality Fixed
- **Setup button**: Now properly shows the FreeAgent connection setup
- **Configure Timers button**: Now shows the configuration modal even when not connected to FreeAgent
- **Enhanced debugging**: Better logging to track button clicks and modal states

## Testing Steps
1. Reload the extension in Chrome
2. Note the new extension ID from chrome://extensions/
3. Update your FreeAgent app with the new redirect URL
4. Test the Setup and Configure Timers buttons
5. Try opening the extension as a side panel

The extension will now work as a persistent sidebar that doesn't disappear when you navigate between pages.
