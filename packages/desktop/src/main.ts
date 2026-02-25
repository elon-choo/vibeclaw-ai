import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

const APP_NAME = 'VibeClaw AI';
const API_PORT = 3177;
const WEB_PORT = 5173;
const PROXY_PORT = 8317;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Load web dashboard
  mainWindow.loadURL(`http://localhost:${WEB_PORT}`).catch(() => {
    // If Vite dev server not running, load API server directly
    mainWindow?.loadURL(`http://localhost:${API_PORT}`).catch(() => {
      mainWindow?.loadURL(`data:text/html,
        <html>
          <body style="background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column">
            <h1 style="color:#8b5cf6">${APP_NAME}</h1>
            <p>Starting server...</p>
            <p style="color:#666;font-size:13px;margin-top:20px">If this persists, run: vibeclaw-ai dev</p>
          </body>
        </html>
      `);
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray(): void {
  // Create a simple tray icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal(`http://localhost:${WEB_PORT}`),
    },
    { type: 'separator' },
    {
      label: 'Auth Status',
      submenu: [
        { label: 'Login ChatGPT', click: () => shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/codex`) },
        { label: 'Login Claude', click: () => shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/claude`) },
        { label: 'Login Gemini', click: () => shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/gemini`) },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopServer();
        app.quit();
      },
    },
  ]);

  tray.setToolTip(APP_NAME);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createWindow();
    }
  });
}

function startServer(): void {
  // Start the web API server
  const serverPath = path.join(__dirname, '..', '..', 'web', 'dist-server', 'index.js');
  try {
    serverProcess = spawn('node', [serverPath], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Server] ${data.toString().trim()}`);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Server] Exited with code ${code}`);
      serverProcess = null;
    });
  } catch (e) {
    console.error('[Server] Failed to start:', (e as Error).message);
  }
}

function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ─── App lifecycle ─────────────────────────────────────

app.whenReady().then(() => {
  startServer();
  createTray();

  // Wait a bit for server to start
  setTimeout(createWindow, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
