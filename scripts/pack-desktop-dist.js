/**
 * Copia o build web (dist/) para dentro da pasta do Electron
 * (desktop/dist/) para que ele seja embutido no app.asar.
 *
 * O electron-builder nao empacota globs que escapam a pasta do app,
 * entao o caminho precisa estar DENTRO da pasta do app.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'dist');
const target = path.join(root, 'desktop', 'dist');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  console.error(
    '[pack-desktop-dist] Build web não encontrado em "dist/". Rode `npm run web:export` primeiro.'
  );
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });

const count = fs.readdirSync(target, { recursive: true }).length;
console.log(`[pack-desktop-dist] dist/ copiado para desktop/dist (${count} itens)`);
