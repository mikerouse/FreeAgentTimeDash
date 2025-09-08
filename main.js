const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const OAuthServer = require('./src/main/oauth-server');

// Keep a global reference of the window object
let mainWindow;
let tray;
let oauthServer;
let isQuitting = false;

// Enable live reload for Electron in development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 450,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    autoHideMenuBar: true, // Hide menu bar by default
    frame: true
  });

  // Load the app
  mainWindow.loadFile('src/renderer/index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus window if this is first launch
    if (process.platform === 'darwin') {
      mainWindow.show();
    } else {
      mainWindow.focus();
    }
  });

  // Handle window closed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first minimize
      if (process.platform === 'win32' || process.platform === 'linux') {
        new Notification({
          title: 'FreeAgent Time Tracker',
          body: 'App minimized to system tray. Click the tray icon to restore.',
          icon: path.join(__dirname, 'assets/icons/icon.png')
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Development tools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icons/tray-icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quick Start',
      submenu: [
        { 
          label: 'Start Timer 1', 
          accelerator: 'Alt+1',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 1);
          }
        },
        { 
          label: 'Start Timer 2', 
          accelerator: 'Alt+2',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 2);
          }
        },
        { 
          label: 'Start Timer 3', 
          accelerator: 'Alt+3',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 3);
          }
        }
      ]
    },
    { type: 'separator' },
    { 
      label: 'Show App', 
      click: () => showMainWindow() 
    },
    { 
      label: 'Settings', 
      click: () => {
        showMainWindow();
        mainWindow.webContents.send('show-settings');
      }
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
  
  // Double-click to show window
  tray.on('double-click', () => {
    showMainWindow();
  });

  // Single click behavior (Windows/Linux)
  if (process.platform === 'win32' || process.platform === 'linux') {
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    });
  }
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function registerGlobalShortcuts() {
  // Global shortcuts for timer control
  const shortcuts = [
    {
      key: 'Alt+1',
      action: () => {
        showMainWindow();
        mainWindow.webContents.send('toggle-timer', 1);
      }
    },
    {
      key: 'Alt+2', 
      action: () => {
        showMainWindow();
        mainWindow.webContents.send('toggle-timer', 2);
      }
    },
    {
      key: 'Alt+3',
      action: () => {
        showMainWindow();
        mainWindow.webContents.send('toggle-timer', 3);
      }
    },
    {
      key: 'Alt+T',
      action: () => showMainWindow()
    }
  ];

  shortcuts.forEach(({ key, action }) => {
    const registered = globalShortcut.register(key, action);
    if (!registered) {
      console.log(`Failed to register global shortcut: ${key}`);
    }
  });
}

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { 
          label: 'New Timer',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('create-timer');
          }
        },
        { 
          label: 'Export Timeslips',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('export-timeslips');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Timers',
      submenu: [
        { 
          label: 'Start Timer 1', 
          accelerator: 'Alt+1',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 1);
          }
        },
        { 
          label: 'Start Timer 2', 
          accelerator: 'Alt+2',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 2);
          }
        },
        { 
          label: 'Start Timer 3', 
          accelerator: 'Alt+3',
          click: () => {
            showMainWindow();
            mainWindow.webContents.send('toggle-timer', 3);
          }
        },
        { type: 'separator' },
        {
          label: 'Stop All Timers',
          accelerator: 'Alt+S',
          click: () => {
            mainWindow.webContents.send('stop-all-timers');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About FreeAgent Time Tracker',
              message: 'FreeAgent Time Tracker v1.0.0',
              detail: 'Professional time tracking with FreeAgent integration.\n\nBuilt with Electron.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // macOS menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for renderer process communication
function setupIPCHandlers() {
  // Initialize OAuth server
  oauthServer = new OAuthServer(mainWindow);
  
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  // OAuth handling
  ipcMain.handle('start-oauth-flow', async (event, clientId, authUrl) => {
    try {
      const code = await oauthServer.authenticate(clientId, authUrl);
      return { success: true, code };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-oauth-redirect-uri', () => {
    return oauthServer.getRedirectUri();
  });

  ipcMain.on('show-notification', (event, title, body) => {
    new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'assets/icons/icon.png')
    }).show();
  });

  ipcMain.on('update-tray-tooltip', (event, tooltip) => {
    if (tray) {
      tray.setToolTip(tooltip);
    }
  });

  ipcMain.on('timer-started', (event, timerName) => {
    new Notification({
      title: 'Timer Started',
      body: `${timerName} timer is now running`,
      icon: path.join(__dirname, 'assets/icons/timer-active.png')
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

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  createApplicationMenu();
  registerGlobalShortcuts();
  setupIPCHandlers();
  
  // Check for updates
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  // Keep app running on macOS when window is closed
  if (process.platform !== 'darwin') {
    if (!isQuitting) {
      // Don't quit, just hide to tray
      return;
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    showMainWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available.');
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It will be downloaded in the background.',
    detail: `Version ${info.version} is now available.`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.');
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});