const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3030;
const APP_FILE = path.join(__dirname, 'index.html');

const ZATCA_PATHS = {
  sandbox:    '/e-invoicing/developer-portal',
  simulation: '/e-invoicing/simulation',
  production: '/e-invoicing/core',
};

function forwardToZATCA(req, res, body) {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const env    = parsed.searchParams.get('env') || 'sandbox';
  const target = ZATCA_PATHS[env] + parsed.pathname;

  const fwdHeaders = {
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'Accept-Language': req.headers['accept-language'] || 'ar',
    'Accept-Version':  req.headers['accept-version']  || 'V2',
    'Content-Length':  Buffer.byteLength(body),
  };
  if (req.headers['otp'])           fwdHeaders['OTP']           = req.headers['otp'];
  if (req.headers['authorization']) fwdHeaders['Authorization'] = req.headers['authorization'];

  console.log(`[ZATCA] → ${parsed.pathname} (${env})`);

  const proxyReq = https.request(
    { hostname: 'gw-fatoora.zatca.gov.sa', port: 443, path: target, method: 'POST', headers: fwdHeaders },
    (proxyRes) => {
      let data = '';
      proxyRes.on('data', c => data += c);
      proxyRes.on('end', () => {
        console.log(`[ZATCA] ← ${proxyRes.statusCode}`);
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    }
  );
  proxyReq.on('error', err => {
    console.error('[ZATCA] Error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ── Serve index.html ──
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    fs.readFile(APP_FILE, (err, data) => {
      if (err) { res.writeHead(404); res.end('index.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ── ZATCA API proxy ──
  if (req.method === 'POST' && (url === '/compliance' || url === '/production/csids')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => forwardToZATCA(req, res, body));
    return;
  }

  // ── Health check ──
  if (req.method === 'GET' && url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  const appUrl = `http://localhost:${PORT}`;
  console.log('\n  ┌────────────────────────────────────────┐');
  console.log('  │   نظام ZATCA POS - جاهز للاستخدام     │');
  console.log(`  │   ${appUrl}               │`);
  console.log('  └────────────────────────────────────────┘');
  console.log(`\n  افتح المتصفح على: ${appUrl}\n`);

  // محاولة فتح المتصفح تلقائياً
  const open = process.platform === 'win32' ? 'start' :
               process.platform === 'darwin' ? 'open' : 'xdg-open';
  require('child_process').exec(`${open} ${appUrl}`, () => {});
});
