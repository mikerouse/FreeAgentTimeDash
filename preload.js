const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // FreeAgent OAuth
  freeagentAuthenticate: () => ipcRenderer.invoke('freeagent-authenticate'),
  freeagentRefreshToken: (refreshToken) => ipcRenderer.invoke('freeagent-refresh-token', refreshToken),
  
  // Notifications and system integration
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  updateTrayTooltip: (tooltip) => ipcRenderer.send('update-tray-tooltip', tooltip),
  timerStarted: (timerName) => ipcRenderer.send('timer-started', timerName),
  timerStopped: (timerName, duration) => ipcRenderer.send('timer-stopped', timerName, duration),
  
  // Event listeners
  onToggleTimer: (callback) => ipcRenderer.on('toggle-timer', callback),
  onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
  onStopAllTimers: (callback) => ipcRenderer.on('stop-all-timers', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Storage API
contextBridge.exposeInMainWorld('storage', {
  get: (key, defaultValue) => {
    try {
      const stored = localStorage.getItem('freeagent-timetracker-' + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem('freeagent-timetracker-' + key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },
  
  delete: (key) => {
    try {
      localStorage.removeItem('freeagent-timetracker-' + key);
      return true;
    } catch (error) {
      return false;
    }
  },
  
  clear: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('freeagent-timetracker-')) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  },
  
  has: (key) => {
    try {
      return localStorage.getItem('freeagent-timetracker-' + key) !== null;
    } catch (error) {
      return false;
    }
  }
});