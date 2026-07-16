const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the live Cashier application URL
  // Replace with localhost during local development
  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev ? 'http://localhost:3005/cashier' : 'https://ckkk-576e7.web.app/cashier';
  
  mainWindow.loadURL(startUrl);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Thermal Printing Logic ---
ipcMain.on('print-receipt', (event, htmlContent) => {
  // Create a hidden window for the receipt
  let printWindow = new BrowserWindow({ 
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 12px; 
            width: 72mm; /* Leave a small margin from 80mm */
            margin: 0 auto; 
            padding: 4mm;
            color: #000;
            background: #fff;
          }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `;

  const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  
  printWindow.loadURL(dataUri);

  printWindow.webContents.on('did-finish-load', () => {
    // Print silently to the default printer (which should be set to the Bixolon in Windows Control Panel)
    printWindow.webContents.print({ 
      silent: true, 
      printBackground: true,
      margins: { marginType: 'none' } 
    }, (success, errorType) => {
      if (!success) console.error('Print failed:', errorType);
      
      printWindow.close();
      printWindow = null;
      
      event.reply('print-receipt-reply', { success, errorType });
    });
  });
});
