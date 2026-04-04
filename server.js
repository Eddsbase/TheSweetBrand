/* ============================================
   LOCAL DEV SERVER — The Sweet Brand
   For development/preview ONLY — not deployed
   ============================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // ---- Content API endpoints ----
  if (pathname === '/api/content' && req.method === 'GET') {
    const contentPath = path.join(ROOT, 'content.json');
    fs.readFile(contentPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read content.json' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/api/content' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const content = JSON.parse(body);
        const contentPath = path.join(ROOT, 'content.json');
        fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ---- Users API ----
  if (pathname === '/api/users' && req.method === 'GET') {
    const usersPath = path.join(ROOT, 'admin-users.json');
    fs.readFile(usersPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read users' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/api/users' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const users = JSON.parse(body);
        const usersPath = path.join(ROOT, 'admin-users.json');
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ---- Asset Upload ----
  if (pathname === '/api/upload' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].split('boundary=')[1];
      // Simple multipart parser
      const filename = `upload-${Date.now()}.png`;
      const assetsDir = path.join(ROOT, 'assets');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
      const filePath = path.join(assetsDir, filename);
      fs.writeFileSync(filePath, buffer);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: `assets/${filename}` }));
    });
    return;
  }

  // ---- Asset List ----
  if (pathname === '/api/assets' && req.method === 'GET') {
    const assetsDir = path.join(ROOT, 'assets');
    if (!fs.existsSync(assetsDir)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }
    const files = fs.readdirSync(assetsDir).map(f => ({
      name: f,
      path: `assets/${f}`,
      size: fs.statSync(path.join(assetsDir, f)).size,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // ---- Static file serving ----
  if (pathname === '/') pathname = '/index.html';
  // Directory index files
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Remove query string
  const cleanPath = pathname.split('?')[0];
  let filePath = path.join(ROOT, cleanPath);

  // If path is a directory, try index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try serving 404.html
        fs.readFile(path.join(ROOT, '404.html'), (err404, data404) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(err404 ? '<h1>404 Not Found</h1>' : data404);
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    // Cache headers for assets
    if (['.png','.jpg','.jpeg','.webp','.avif','.svg','.otf','.mp4','.webm'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  🍬 The Sweet Brand — Dev Server`);
  console.log(`  ➜ Local: http://localhost:${PORT}`);
  console.log(`  ➜ Admin: http://localhost:${PORT}/admin/`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
