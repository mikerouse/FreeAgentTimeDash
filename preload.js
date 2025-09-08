const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // OAuth operations
  startOAuthFlow: (clientId, authUrl) => ipcRenderer.invoke('start-oauth-flow', clientId, authUrl),
  getOAuthRedirectUri: () => ipcRenderer.invoke('get-oauth-redirect-uri'),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  
  // System tray
  updateTrayTooltip: (tooltip) => ipcRenderer.send('update-tray-tooltip', tooltip),
  
  // Timer events
  timerStarted: (timerName) => ipcRenderer.send('timer-started', timerName),
  timerStopped: (timerName, duration) => ipcRenderer.send('timer-stopped', timerName, duration),
  
  // Listen for main process events
  onToggleTimer: (callback) => ipcRenderer.on('toggle-timer', callback),
  onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
  onCreateTimer: (callback) => ipcRenderer.on('create-timer', callback),
  onExportTimeslips: (callback) => ipcRenderer.on('export-timeslips', callback),
  onStopAllTimers: (callback) => ipcRenderer.on('stop-all-timers', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Storage API - secure wrapper for electron-store
contextBridge.exposeInMainWorld('storage', {
  get: (key, defaultValue) => {
    try {
      const Store = require('electron-store');
      const store = new Store({
        encryptionKey: 'freeagent-time-tracker-key',
        cwd: 'userData'
      });
      return store.get(key, defaultValue);
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      const Store = require('electron-store');
      const store = new Store({
        encryptionKey: 'freeagent-time-tracker-key',
        cwd: 'userData'
      });
      store.set(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  delete: (key) => {
    try {
      const Store = require('electron-store');
      const store = new Store({
        encryptionKey: 'freeagent-time-tracker-key',
        cwd: 'userData'
      });
      store.delete(key);
      return true;
    } catch (error) {
      console.error('Storage delete error:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      const Store = require('electron-store');
      const store = new Store({
        encryptionKey: 'freeagent-time-tracker-key',
        cwd: 'userData'
      });
      store.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
});