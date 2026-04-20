const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3030;

const ZATCA_HOSTS = {
  sandbox:    'gw-fatoora.zatca.gov.sa',
  simulation: 'gw-fatoora.zatca.gov.sa',
  production: 'gw-fatoora.zatca.gov.sa',
};

const ZATCA_PATHS = {
  sandbox:    '/e-invoicing/developer-portal',
  simulation: '/e-invoicing/simulation',
  production: '/e-invoicing/core',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, OTP, Authorization, Accept, Accept-Language, Accept-Version',
    'Access-Control-Max-Age': '86400',
  };
}

function forwardToZATCA(req, res, body) {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const env = parsed.searchParams.get('env') || 'sandbox';
  const host = ZATCA_HOSTS[env] || ZATCA_HOSTS.sandbox;
  const basePath = ZATCA_PATHS[env] || ZATCA_PATHS.sandbox;
  const targetPath = basePath + parsed.pathname;

  const fwdHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': req.headers['accept-language'] || 'ar',
    'Accept-Version': req.headers['accept-version'] || 'V2',
  };
  if (req.headers['otp']) fwdHeaders['OTP'] = req.headers['otp'];
  if (req.headers['authorization']) fwdHeaders['Authorization'] = req.headers['authorization'];

  const options = {
    hostname: host,
    port: 443,
    path: targetPath,
    method: 'POST',
    headers: { ...fwdHeaders, 'Content-Length': Buffer.byteLength(body) },
  };

  console.log(`[PROXY] ${req.method} ${parsed.pathname}?env=${env} → https://${host}${targetPath}`);

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      console.log(`[PROXY] ← ${proxyRes.statusCode} (${data.length} bytes)`);
      res.writeHead(proxyRes.statusCode, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[PROXY] Error: ${err.message}`);
    res.writeHead(502, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  });

  proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ZATCA Proxy', port: PORT }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => forwardToZATCA(req, res, body));
    return;
  }

  res.writeHead(404, { ...corsHeaders(), 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   ZATCA Proxy Server                     ║`);
  console.log(`  ║   http://localhost:${PORT}                  ║`);
  console.log(`  ║   Ready to forward requests to ZATCA     ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
