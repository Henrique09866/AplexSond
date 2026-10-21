const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Onde fica o build web ───────────────────────────────────
// Em dev: <raiz>/dist  |  Empacotado: resources/app.asar/dist
// (Electron lê do asar de forma transparente via `fs`.)

const DIST_DIR = app.isPackaged
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.mp3':   'audio/mpeg',
  '.wav':   'audio/wav',
  '.m4a':   'audio/mp4',
  '.txt':   'text/plain; charset=utf-8',
};

let staticServer = null;
let staticServerPort = 0;

// ─── Servidor estático local ─────────────────────────────────
// O Expo gera assets com caminho absoluto (`/_expo/...`), então
// abrir via `file://` não funciona. Servimos o `dist` em
// 127.0.0.1 com porta aleatória — reproduz exatamente o ambiente
// do navegador, sem conflito de porta.

function startStaticServer() {
  if (staticServer) {
    return Promise.resolve(staticServerPort);
  }

  return new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
      const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.join(DIST_DIR, requestPath);

      // Impede path traversal para fora do diretório do app.
      if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          // Fallback de SPA: qualquer rota não encontrada abre o index.
          filePath = path.join(DIST_DIR, 'index.html');
        }

        fs.readFile(filePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, {
            'Content-Type':
              MIME_TYPES[path.extname(filePath).toLowerCase()] ||
              'application/octet-stream',
            'Cache-Control': 'no-cache',
          });
          res.end(data);
        });
      });
    });

    staticServer.on('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      staticServerPort = staticServer.address().port;
      resolve(staticServerPort);
    });
  });
}

// ─── Janela ──────────────────────────────────────────────────

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0A0A0A',
    title: 'AplexSond',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Útil para desenvolvimento: APLEXSOND_DEV_URL=http://localhost:8081
  const devUrl = process.env.APLEXSOND_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    const port = await startStaticServer();
    win.loadURL(`http://127.0.0.1:${port}/`);
  }

  win.on('closed', () => {});
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
