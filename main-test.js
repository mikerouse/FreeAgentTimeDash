const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-test.js')
    }
  });

  mainWindow.loadFile('src/renderer/test-ipc.html');

  // Open DevTools to see console
  mainWindow.webContents.openDevTools();
}

// Setup IPC handlers FIRST
function setupIPC() {
  console.log('Setting up IPC handlers...');
  
  ipcMain.handle('get-app-version', () => {
    console.log('✅ get-app-version handler called successfully!');
    return app.getVersion();
  });
  
  ipcMain.handle('test-handler', () => {
    console.log('✅ test-handler called successfully!');
    return 'IPC is working!';
  });
  
  console.log('✅ IPC handlers registered');
}

app.whenReady().then(() => {
  setupIPC(); // Setup IPC FIRST
  createWindow(); // Then create window
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('Main process started');