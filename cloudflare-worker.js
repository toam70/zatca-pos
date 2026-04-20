/**
 * Cloudflare Worker — ZATCA API Proxy
 *
 * Deploy steps:
 *  1. Go to https://workers.cloudflare.com  (free account)
 *  2. Create a new Worker
 *  3. Replace the default code with this file
 *  4. Click "Save and Deploy"
 *  5. Copy your Worker URL (e.g. https://zatca-proxy.YOUR-NAME.workers.dev)
 *  6. Paste it in the "Proxy URL" field in the POS app
 */

const ZATCA_BASES = {
  sandbox:    'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, OTP, Authorization, Accept, Accept-Language, Accept-Version',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/ping')) {
      return json({ ok: true });
    }

    // Only proxy POST /compliance and POST /production/csids
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }
    if (url.pathname !== '/compliance' && url.pathname !== '/production/csids') {
      return json({ error: 'Not found' }, 404);
    }

    const env  = url.searchParams.get('env') || 'sandbox';
    const base = ZATCA_BASES[env];
    if (!base) return json({ error: 'Invalid env: ' + env }, 400);

    const targetUrl = base + url.pathname;
    const body      = await request.text();

    const headers = {
      'Content-Type':    'application/json',
      'Accept':          'application/json',
      'Accept-Language': request.headers.get('accept-language') || 'ar',
      'Accept-Version':  request.headers.get('accept-version')  || 'V2',
    };

    const otp  = request.headers.get('otp');
    const auth = request.headers.get('authorization');
    if (otp)  headers['OTP']           = otp;
    if (auth) headers['Authorization'] = auth;

    try {
      const resp = await fetch(targetUrl, { method: 'POST', headers, body });
      const text = await resp.text();
      return new Response(text, {
        status:  resp.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return json({ error: err.message }, 502);
    }
  },
};
