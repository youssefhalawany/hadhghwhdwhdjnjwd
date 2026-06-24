const { app, BrowserWindow, Menu, shell, Notification } = require("electron");
const path = require("path");

// The URL of your deployed Vercel app
const APP_URL = "https://hadhghwhdwhdjnjwd.vercel.app";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "..", "public", "icons", "icon-512x512.png"),
  });

  // Load the deployed web app
  mainWindow.loadURL(APP_URL);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Handle offline: try to reload when connection is restored
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription);
    // Show offline page or retry
    if (errorCode === -106 || errorCode === -6) {
      // ERR_INTERNET_DISCONNECTED or ERR_FILE_NOT_FOUND
      setTimeout(() => {
        mainWindow.loadURL(APP_URL);
      }, 5000);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// macOS native menu
const menuTemplate = [
  {
    label: "ANH Portal",
    submenu: [
      { role: "about" },
      { type: "separator" },
      {
        label: "Preferences",
        accelerator: "CmdOrCtrl+,",
        click: () => {
          if (mainWindow) {
            mainWindow.loadURL(APP_URL + "/settings/cashiers");
          }
        },
      },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Navigate",
    submenu: [
      {
        label: "Dashboard",
        accelerator: "CmdOrCtrl+1",
        click: () => mainWindow?.loadURL(APP_URL + "/"),
      },
      {
        label: "Cashier Portal",
        accelerator: "CmdOrCtrl+2",
        click: () => mainWindow?.loadURL(APP_URL + "/cashier"),
      },
      {
        label: "Shift Reports",
        accelerator: "CmdOrCtrl+3",
        click: () => mainWindow?.loadURL(APP_URL + "/shift-reports/manager"),
      },
      {
        label: "Checklists",
        accelerator: "CmdOrCtrl+4",
        click: () => mainWindow?.loadURL(APP_URL + "/checklists/manager"),
      },
      {
        label: "Financial Reports",
        accelerator: "CmdOrCtrl+5",
        click: () => mainWindow?.loadURL(APP_URL + "/financial-reports"),
      },
      { type: "separator" },
      {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: () => mainWindow?.reload(),
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      { role: "toggleDevTools" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "front" },
    ],
  },
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
