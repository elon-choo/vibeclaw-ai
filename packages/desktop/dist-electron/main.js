"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const APP_NAME = 'VibeClaw AI';
const API_PORT = 3177;
const WEB_PORT = 5173;
const PROXY_PORT = 8317;
let mainWindow = null;
let tray = null;
let serverProcess = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
}
function createTray() {
    // Create a simple tray icon
    const icon = electron_1.nativeImage.createEmpty();
    tray = new electron_1.Tray(icon);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { label: APP_NAME, enabled: false },
        { type: 'separator' },
        {
            label: 'Open Dashboard',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
                else {
                    createWindow();
                }
            },
        },
        {
            label: 'Open in Browser',
            click: () => electron_1.shell.openExternal(`http://localhost:${WEB_PORT}`),
        },
        { type: 'separator' },
        {
            label: 'Auth Status',
            submenu: [
                { label: 'Login ChatGPT', click: () => electron_1.shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/codex`) },
                { label: 'Login Claude', click: () => electron_1.shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/claude`) },
                { label: 'Login Gemini', click: () => electron_1.shell.openExternal(`http://localhost:${API_PORT}/api/auth/login/gemini`) },
            ],
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                stopServer();
                electron_1.app.quit();
            },
        },
    ]);
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
        else {
            createWindow();
        }
    });
}
function startServer() {
    // Start the web API server
    const serverPath = path.join(__dirname, '..', '..', 'web', 'dist-server', 'index.js');
    try {
        serverProcess = (0, child_process_1.spawn)('node', [serverPath], {
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'production' },
        });
        serverProcess.stdout?.on('data', (data) => {
            console.log(`[Server] ${data.toString().trim()}`);
        });
        serverProcess.stderr?.on('data', (data) => {
            console.error(`[Server] ${data.toString().trim()}`);
        });
        serverProcess.on('exit', (code) => {
            console.log(`[Server] Exited with code ${code}`);
            serverProcess = null;
        });
    }
    catch (e) {
        console.error('[Server] Failed to start:', e.message);
    }
}
function stopServer() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}
// ─── App lifecycle ─────────────────────────────────────
electron_1.app.whenReady().then(() => {
    startServer();
    createTray();
    // Wait a bit for server to start
    setTimeout(createWindow, 1500);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
        else {
            mainWindow?.show();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopServer();
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    stopServer();
});
