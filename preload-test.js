const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  testHandler: () => ipcRenderer.invoke('test-handler')
});

console.log('✅ Preload script loaded - electronAPI exposed');

// Test that the bridge is working
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, electronAPI available:', !!window.electronAPI);
});