// main.js - 颐智康养桌面客户端主进程
const { app, BrowserWindow, ipcMain, Menu, Tray, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;
let tray = null;

// 判断是否开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 后端端口
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// 前端URL（开发模式连Vite，生产模式连后端静态文件）
const FRONTEND_URL = isDev ? 'http://127.0.0.1:5173' : BACKEND_URL;

function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend');
  }
  // 生产模式：资源在 resources/backend
  return path.join(process.resourcesPath || '', 'backend');
}

function getPythonExecutable() {
  // 生产模式尝试使用打包的Python，否则使用系统Python
  if (!isDev) {
    const embeddedPython = path.join(process.resourcesPath || '', 'python', 'python.exe');
    if (fs.existsSync(embeddedPython)) {
      console.log('[Python] Using embedded Python:', embeddedPython);
      return embeddedPython;
    }
    console.warn('[Python] Embedded Python not found, falling back to system Python');
  }
  // 回退到系统Python
  return 'python';
}

function getFrontendDistPath() {
  if (isDev) {
    // 开发模式：尝试使用 frontend-admin/dist，不存在则留空（走 Vite  dev server）
    const devDist = path.join(__dirname, '..', 'frontend-admin', 'dist');
    return fs.existsSync(devDist) ? devDist : '';
  }
  // 生产模式：资源在 resources/frontend
  return path.join(process.resourcesPath || '', 'frontend');
}

function startBackend() {
  const backendDir = getBackendPath();
  const pythonExe = getPythonExecutable();
  const frontendDist = getFrontendDistPath();

  console.log('[Backend] Starting...');
  console.log('[Backend] Dir:', backendDir);
  console.log('[Backend] Python:', pythonExe);
  console.log('[Backend] FrontendDist:', frontendDist || '(none)');

  // 嵌入式Python使用._pth控制搜索路径，忽略PYTHONPATH
  // 需要在site-packages中创建.pth文件来添加后端目录
  if (!isDev && pythonExe !== 'python') {
    const sitePackages = path.join(path.dirname(pythonExe), 'Lib', 'site-packages');
    const pthFile = path.join(sitePackages, 'yizhi-backend.pth');
    try {
      if (!fs.existsSync(pthFile) || fs.readFileSync(pthFile, 'utf8') !== backendDir) {
        fs.writeFileSync(pthFile, backendDir, 'utf8');
        console.log('[Backend] Created .pth file:', pthFile, '->', backendDir);
      }
    } catch (err) {
      console.error('[Backend] Failed to create .pth file:', err);
    }
  }

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
  };
  if (frontendDist) {
    env.FRONTEND_DIST_PATH = frontendDist;
  }
  // 嵌入式Python不需要用户级别的site-packages
  if (!isDev && pythonExe !== 'python') {
    delete env.PYTHONHOME;
    delete env.PYTHONPATH;
  }

  const proc = spawn(pythonExe, [
    '-m', 'uvicorn',
    'main:app',
    '--host', '127.0.0.1',
    '--port', String(BACKEND_PORT),
  ], {
    cwd: backendDir,
    env,
    detached: false,
  });

  backendProcess = proc;

  proc.stdout.on('data', (data) => {
    console.log(`[Backend stdout]: ${data}`);
  });

  proc.stderr.on('data', (data) => {
    console.error(`[Backend stderr]: ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
    backendProcess = null;
  });

  proc.on('error', (err) => {
    console.error('[Backend] Failed to start:', err);
  });

  return proc;
}

function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const check = () => {
      fetch(BACKEND_URL + '/api/health')
        .then(() => resolve(true))
        .catch(() => {
          count++;
          if (count >= retries) {
            reject(new Error('Backend health check timeout'));
          } else {
            setTimeout(check, 1000);
          }
        });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 加载前端
  mainWindow.loadURL(FRONTEND_URL).catch((err) => {
    console.error('Failed to load URL:', err);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip('颐智康养');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(async () => {
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);

  // 启动后端
  startBackend();

  // 等待后端就绪
  try {
    await waitForBackend(60);
    console.log('[Main] Backend is ready');
  } catch (err) {
    console.error('[Main] Backend failed to start:', err);
    app.quit();
    return;
  }

  // 创建窗口
  createWindow();

  // 创建托盘（生产模式）
  if (!isDev) {
    createTray();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 不退出，保留托盘
  }
});

app.on('before-quit', () => {
  // 关闭后端进程
  if (backendProcess) {
    console.log('[Main] Killing backend process...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});

// IPC：检查后端健康状态
ipcMain.handle('backend-health', async () => {
  try {
    const res = await fetch(BACKEND_URL + '/api/health');
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
});

// IPC：获取应用版本
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

// IPC：重启后端
ipcMain.handle('restart-backend', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  startBackend();
  return { ok: true };
});
