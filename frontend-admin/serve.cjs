const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5174;
const DIST = path.join(__dirname, 'dist');
const PROXY_TARGET = 'http://127.0.0.1:8899';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// SPA fallback: serve index.html for non-file routes
const SPA_ROUTES = ['/login', '/dashboard', '/elders', '/care-records', '/bills',
  '/medications', '/shifts', '/vital-signs', '/alerts', '/reports', '/users', '/roles', '/approvals', '/settings'];

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

function proxyApi(req, res) {
  const targetUrl = PROXY_TARGET + req.url;
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.path,
    method: req.method,
    headers: { ...req.headers, host: parsed.host },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Backend unreachable' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // Proxy API requests
  if (parsed.pathname.startsWith('/api')) {
    return proxyApi(req, res);
  }

  // SPA fallback for known routes
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (SPA_ROUTES.includes(cleanPath) || cleanPath.startsWith('/elders/')) {
    return serveFile(res, path.join(DIST, 'index.html'));
  }

  // Static file
  let filePath = path.join(DIST, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  // Final fallback: SPA
  serveFile(res, path.join(DIST, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Frontend serving at http://localhost:${PORT}`);
  console.log(`API proxy: /api -> ${PROXY_TARGET}`);
});
