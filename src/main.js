const { app, BrowserWindow, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');

// Prefer .icns on macOS for proper app bundle/dock appearance
const ICON_PATH = process.platform === 'darwin'
  ? path.join(__dirname, '../public/bytelab.icns')
  : path.join(__dirname, '../public/bytelab.png');

function createWindow() {
  // Use the current display's work area for initial sizing
  const { workAreaSize } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: workAreaSize.width,
    height: workAreaSize.height,
    show: false, // avoid visible resize flicker
    titleBarStyle: 'hiddenInset', // macOS: hide native titlebar, keep traffic lights inset
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#000000',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Compose title with app name and version
  const appName = app.getName ? app.getName() : 'ByteLab';
  const appVersion = app.getVersion ? app.getVersion() : '1.0.0';
  const title = `${appName} v${appVersion}`;
  win.setTitle(title);
  // Prevent page from overriding the title
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle(title); });

  win.loadFile(path.join(__dirname, '../public/index.html'));
  win.once('ready-to-show', () => {
    try { win.maximize(); } catch (_) {}
    win.show();
  });
}

// IPC: provide app info for custom titlebar text
ipcMain.handle('get-app-info', () => ({ name: app.getName(), version: app.getVersion() }));

app.whenReady().then(() => {
  // Set macOS dock icon at runtime (uses .icns for best results)
  if (process.platform === 'darwin') {
    try { app.dock.setIcon(nativeImage.createFromPath(ICON_PATH)); } catch (_) {}
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
