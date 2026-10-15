const { contextBridge } = require('electron');

// Mantemos a API mínima e segura para a UI web.
contextBridge.exposeInMainWorld('aplexsond', {
  platform: 'desktop',
});
