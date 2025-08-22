const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

function createWindow() {
  // Use the current display's work area for initial sizing
  const { workAreaSize } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: workAreaSize.width,
    height: workAreaSize.height,
    show: false, // avoid visible resize flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, '../public/index.html'));
  win.once('ready-to-show', () => {
    try { win.maximize(); } catch (_) {}
    win.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
