const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (htmlContent) => ipcRenderer.send('print-receipt', htmlContent),
  onPrintReply: (callback) => ipcRenderer.on('print-receipt-reply', (_event, data) => callback(data))
});
