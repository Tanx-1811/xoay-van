// Zero-dependency static server: `npm start` or `node server.mjs [port]`
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixedPort = process.argv[2] || process.env.PORT;
let port = Number(fixedPort || 5173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function send(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { send(res, 400, 'Bad request'); return; }
  let file = path.join(root, pathname);
  const rel = path.relative(root, file);
  // stay inside the project and never serve dotfiles such as .git
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).some((p) => p.startsWith('.'))) { send(res, 403, 'Forbidden'); return; }
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { send(res, 404, 'Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.on('error', (err) => {
  // the default port may be taken by another dev server (5173 is Vite's): try the next ones
  if (err.code === 'EADDRINUSE' && !fixedPort && port < 5190) { port++; server.listen(port); return; }
  console.error(err.code === 'EADDRINUSE' ? `Cổng ${port} đang được dùng. Hãy chọn cổng khác: node server.mjs 8080` : err.message);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Xoay Vần running at http://localhost:${port}`);
  const lan = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal);
  if (lan.length) console.log(`On a phone on the same Wi-Fi: http://${lan[0].address}:${port}`);
});
