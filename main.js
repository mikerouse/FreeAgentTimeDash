const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, nativeImage } = require('electron');
const path = require('path');
const FreeAgentOAuthServer = require('./src/main/oauth-server');

// Keep a global reference of the window object
let mainWindow;
let tray;
let isQuitting = false;
let oauthServer;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 450,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    title: 'FreeAgent Time Tracker',
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets/icons/tray-icon.png');
    tray = new Tray(iconPath);
  } catch (error) {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Time Tracker',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Timer 1 (Alt+1)',
      click: () => mainWindow.webContents.send('toggle-timer', 1)
    },
    {
      label: 'Timer 2 (Alt+2)',
      click: () => mainWindow.webContents.send('toggle-timer', 2)
    },
    {
      label: 'Timer 3 (Alt+3)',
      click: () => mainWindow.webContents.send('toggle-timer', 3)
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => mainWindow.webContents.send('show-settings')
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('FreeAgent Time Tracker');
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupGlobalShortcuts() {
  globalShortcut.register('Alt+1', () => mainWindow.webContents.send('toggle-timer', 1));
  globalShortcut.register('Alt+2', () => mainWindow.webContents.send('toggle-timer', 2));
  globalShortcut.register('Alt+3', () => mainWindow.webContents.send('toggle-timer', 3));
  globalShortcut.register('Alt+T', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  globalShortcut.register('Alt+S', () => mainWindow.webContents.send('stop-all-timers'));
}

function setupIPCHandlers() {
  // App info
  ipcMain.handle('get-app-version', () => app.getVersion());

  // FreeAgent OAuth
  ipcMain.handle('freeagent-authenticate', async () => {
    try {
      if (!oauthServer) throw new Error('OAuth server not initialized');
      return await oauthServer.authenticate();
    } catch (error) {
      console.error('OAuth authentication error:', error);
      throw error;
    }
  });

  ipcMain.handle('freeagent-refresh-token', async (event, refreshToken) => {
    try {
      if (!oauthServer) throw new Error('OAuth server not initialized');
      return await oauthServer.refreshAccessToken(refreshToken);
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  });

  // Notifications and tray
  ipcMain.on('show-notification', (event, title, body) => {
    new Notification({ title, body, icon: path.join(__dirname, 'assets/icons/icon.png') }).show();
  });

  ipcMain.on('update-tray-tooltip', (event, tooltip) => {
    if (tray) tray.setToolTip(tooltip);
  });

  ipcMain.on('timer-started', (event, timerName) => {
    new Notification({
      title: 'Timer Started',
      body: `${timerName} timer is now running`,
      icon: path.join(__dirname, 'assets/icons/icon.png')
    }).show();
  });

  ipcMain.on('timer-stopped', (event, timerName, duration) => {
    new Notification({
      title: 'Timer Stopped',
      body: `${timerName} - ${duration}`,
      icon: path.join(__dirname, 'assets/icons/icon.png')
    }).show();
  });
}

async function initializeApp() {
  setupIPCHandlers();
  
  // Start OAuth server
  try {
    oauthServer = new FreeAgentOAuthServer();
    await oauthServer.start();
  } catch (error) {
    console.warn('OAuth server failed to start:', error.message);
  }
  
  createWindow();
  createTray();
  setupGlobalShortcuts();
}

// App events
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (oauthServer) {
    try {
      oauthServer.stop();
    } catch (error) {
      console.error('Error stopping OAuth server:', error);
    }
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}