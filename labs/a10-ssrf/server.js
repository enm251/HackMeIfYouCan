const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 200;

function addLog(entry) {
  logs.push({
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log interceptor - capture all non-settings/logs requests
app.use((req, res, next) => {
  const skip = req.path.startsWith('/api/settings') || req.path.startsWith('/api/logs');
  if (skip) return next();
  const start = Date.now();
  const origEnd = res.end;
  res.end = function (...args) {
    addLog({
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start + 'ms',
      ip: req.ip || req.socket.remoteAddress,
      securityMode: securityMode
    });
    origEnd.apply(res, args);
  };
  next();
});

// ---------------------------------------------------------------------------
// Security Mode Endpoints
// ---------------------------------------------------------------------------
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ mode: securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    addLog({ event: 'security-mode-change', mode });
    return res.json({ success: true, mode: securityMode });
  }
  res.status(400).json({ error: 'Invalid mode. Use "secure" or "vulnerable".' });
});

// ---------------------------------------------------------------------------
// Logs Endpoints
// ---------------------------------------------------------------------------
app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/logs/clear', (req, res) => {
  logs.length = 0;
  res.json({ success: true, message: 'Logs cleared.' });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isLocalAddress(ip) {
  if (!ip) return false;
  return ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost';
}

function isPrivateIP(hostname) {
  // Blocks RFC1918, loopback, link-local, metadata IPs
  const patterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^localhost$/i,
    /^::1$/,
    /^::ffff:127\./,
    /^0x/i,
    /^\d+$/ // decimal IP notation
  ];
  return patterns.some(p => p.test(hostname));
}

function resolveDecimalOrHexIP(host) {
  // Convert hex IP like 0x7f000001 to dotted quad
  if (/^0x[0-9a-fA-F]+$/.test(host)) {
    const num = parseInt(host, 16);
    return [(num >> 24) & 0xFF, (num >> 16) & 0xFF, (num >> 8) & 0xFF, num & 0xFF].join('.');
  }
  // Convert decimal IP like 2130706433
  if (/^\d+$/.test(host) && host.length > 3) {
    const num = parseInt(host, 10);
    if (num > 0 && num <= 0xFFFFFFFF) {
      return [(num >> 24) & 0xFF, (num >> 16) & 0xFF, (num >> 8) & 0xFF, num & 0xFF].join('.');
    }
  }
  return host;
}

// ---------------------------------------------------------------------------
// Internal Admin Endpoints (localhost only)
// ---------------------------------------------------------------------------

// Stage 1 secret - MUST stay exactly as-is for verify_labs.js compatibility
app.get('/admin/secret', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  if (isLocalAddress(ip)) {
    return res.json({
      success: true,
      flag: 'FLAG{ssrf_internal_metadata_leak}',
      message: 'Secret administrative logging keys retrieved successfully.'
    });
  }
  res.status(403).json({
    success: false,
    error: "Access Denied: Only localhost can access this endpoint."
  });
});

// Stage 2 secret
app.get('/admin/stage2/secret', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  if (isLocalAddress(ip)) {
    return res.json({
      success: true,
      flag: 'FLAG{ssrf_hex_ip_blacklist_bypass}',
      message: 'Stage 2 secret retrieved via blacklist bypass.'
    });
  }
  res.status(403).json({
    success: false,
    error: "Access Denied: Only localhost can access this endpoint."
  });
});

// Stage 3 - internal service on port 9999
let stage3Server;
function startStage3Service() {
  stage3Server = http.createServer((req, res) => {
    if (req.url === '/secret') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        flag: 'FLAG{ssrf_blind_port_scan_timing}',
        message: 'Blind SSRF port discovery successful.'
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  stage3Server.listen(9999, '127.0.0.1', () => {
    console.log('Stage 3 internal service running on port 9999');
  });
}

// Stage 4 secret
app.get('/admin/stage4/secret', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  if (isLocalAddress(ip)) {
    return res.json({
      success: true,
      flag: 'FLAG{ssrf_open_redirect_chain_expert}',
      message: 'Open redirect chain exploit successful.'
    });
  }
  res.status(403).json({
    success: false,
    error: "Access Denied: Only localhost can access this endpoint."
  });
});

// ---------------------------------------------------------------------------
// Stage 1: Direct SSRF (no restrictions)
// GET /api/fetch?url=<target>
// Backward-compatible with verify_labs.js
// ---------------------------------------------------------------------------
app.get('/api/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing parameter 'url'." });
  }

  // Secure mode: block private IPs
  if (securityMode === 'secure') {
    try {
      const parsed = new URL(url);
      const resolved = resolveDecimalOrHexIP(parsed.hostname);
      if (isPrivateIP(parsed.hostname) || isPrivateIP(resolved)) {
        addLog({ event: 'blocked-ssrf', url, stage: 1, reason: 'Private IP detected (secure mode)' });
        return res.status(403).json({ error: 'Request blocked: private/internal IP addresses are not allowed in secure mode.' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }
  }

  try {
    console.log('Stage 1 SSRF fetch: ' + url);
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load target URL: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// Stage 2: SSRF with localhost blacklist
// GET /api/stage2/fetch?url=<target>
// Blacklists: 127.0.0.1, localhost, [::1], 0.0.0.0
// Bypass with: 0x7f000001, 2130706433, 017700000001, etc.
// ---------------------------------------------------------------------------
app.get('/api/stage2/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing parameter 'url'." });
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Blacklist check (string-based, bypassable)
    const blacklist = ['127.0.0.1', 'localhost', '::1', '0.0.0.0', '[::1]'];

    if (securityMode === 'secure') {
      // Secure mode: resolve alternate representations too
      const resolved = resolveDecimalOrHexIP(hostname);
      if (blacklist.includes(hostname) || blacklist.includes(resolved) ||
          isPrivateIP(hostname) || isPrivateIP(resolved)) {
        addLog({ event: 'blocked-ssrf', url, stage: 2, reason: 'All private IP variants blocked (secure mode)' });
        return res.status(403).json({ error: 'Request blocked: all private IP representations are blocked in secure mode.' });
      }
    } else {
      // Vulnerable mode: only string blacklist, bypassable with hex/decimal IP
      if (blacklist.includes(hostname)) {
        addLog({ event: 'blocked-ssrf', url, stage: 2, reason: 'Hostname in blacklist' });
        return res.status(403).json({ error: 'Request blocked: ' + hostname + ' is in the URL blacklist.' });
      }
    }

    console.log('Stage 2 SSRF fetch: ' + url);
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load target URL: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// Stage 3: Blind SSRF - response body not returned, only status + timing
// GET /api/stage3/fetch?url=<target>
// Port 9999 has the secret service, use timing to detect open ports
// Then GET /api/stage3/exfiltrate?port=9999 to get flag once discovered
// ---------------------------------------------------------------------------
app.get('/api/stage3/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing parameter 'url'." });
  }

  if (securityMode === 'secure') {
    try {
      const parsed = new URL(url);
      const resolved = resolveDecimalOrHexIP(parsed.hostname);
      if (isPrivateIP(parsed.hostname) || isPrivateIP(resolved)) {
        addLog({ event: 'blocked-ssrf', url, stage: 3, reason: 'Private IP blocked (secure mode)' });
        return res.status(403).json({ error: 'Request blocked: internal requests disabled in secure mode.' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }
  }

  const start = Date.now();
  try {
    console.log('Stage 3 blind SSRF probe: ' + url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    // Blind: only return status and timing, NOT the body
    res.json({
      reachable: true,
      statusCode: response.status,
      duration: elapsed + 'ms',
      contentLength: response.headers.get('content-length') || 'unknown',
      note: 'Response body is not returned in blind SSRF mode.'
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    res.json({
      reachable: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
      duration: elapsed + 'ms',
      note: 'Response body is not returned in blind SSRF mode.'
    });
  }
});

// Stage 3: Exfiltrate endpoint - once the attacker discovers port 9999
app.get('/api/stage3/exfiltrate', async (req, res) => {
  const { port } = req.query;
  if (!port) {
    return res.status(400).json({ error: "Missing parameter 'port'." });
  }

  if (securityMode === 'secure') {
    addLog({ event: 'blocked-exfiltrate', port, stage: 3, reason: 'Exfiltration blocked in secure mode' });
    return res.status(403).json({ error: 'Exfiltration endpoint disabled in secure mode.' });
  }

  const targetPort = parseInt(port, 10);
  if (targetPort === 9999) {
    try {
      const response = await fetch('http://127.0.0.1:9999/secret');
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Internal service unreachable: ' + err.message });
    }
  }

  res.status(404).json({ error: 'No secret service found on port ' + port + '.' });
});

// ---------------------------------------------------------------------------
// Stage 4: Open Redirect Chain
// Strict validation: only allows URLs matching http://trusted-api.local/*
// But /api/redirect?to=<url> follows redirects, and is under trusted scope
// Chain: fetch trusted-api.local -> /api/redirect?to=/admin/stage4/secret
// ---------------------------------------------------------------------------

// Open redirect endpoint (the vulnerability to chain)
app.get('/api/redirect', (req, res) => {
  const { to } = req.query;
  if (!to) {
    return res.status(400).json({ error: "Missing parameter 'to'." });
  }

  if (securityMode === 'secure') {
    // Secure mode: no open redirects
    addLog({ event: 'blocked-redirect', to, stage: 4, reason: 'Open redirects disabled in secure mode' });
    return res.status(403).json({ error: 'Open redirects are disabled in secure mode.' });
  }

  console.log('Redirect to: ' + to);
  res.redirect(302, to);
});

app.get('/api/stage4/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing parameter 'url'." });
  }

  // Strict URL validation: only trusted-api.local OR localhost:3000 with /api/redirect path
  try {
    const parsed = new URL(url);
    const allowedHosts = ['trusted-api.local'];
    // Also allow localhost:3000 so the redirect chain can work internally
    const isLocalRedirect = (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
                            parsed.port === '3000' &&
                            parsed.pathname.startsWith('/api/redirect');

    if (securityMode === 'secure') {
      // Secure mode: only allow trusted-api.local, no redirect following
      if (!allowedHosts.includes(parsed.hostname)) {
        addLog({ event: 'blocked-ssrf', url, stage: 4, reason: 'Host not in allowlist (secure mode)' });
        return res.status(403).json({ error: 'Request blocked: only trusted-api.local is allowed. Redirect following is disabled.' });
      }
      // Fetch without following redirects
      const response = await fetch(url, { redirect: 'error' });
      const text = await response.text();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
      return res.send(text);
    }

    // Vulnerable mode: allow trusted-api.local hosts (and the internal redirect trick)
    if (!allowedHosts.includes(parsed.hostname) && !isLocalRedirect) {
      addLog({ event: 'blocked-ssrf', url, stage: 4, reason: 'Host not in allowlist' });
      return res.status(403).json({
        error: 'Request blocked: only URLs matching http://trusted-api.local/* are allowed.',
        hint: 'The server trusts requests to trusted-api.local domain.'
      });
    }

    console.log('Stage 4 SSRF fetch: ' + url);
    // Follow redirects (the vulnerability)
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load target URL: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// Stage info endpoint
// ---------------------------------------------------------------------------
app.get('/api/stages', (req, res) => {
  res.json({
    stages: [
      {
        id: 1,
        title: 'Direct SSRF',
        difficulty: 'Easy',
        description: 'The /api/fetch endpoint takes a user-supplied URL and fetches it server-side with no restrictions. Internal admin endpoints are only accessible from localhost (127.0.0.1). Exploit the SSRF to reach the protected /admin/secret endpoint.',
        endpoint: '/api/fetch?url=',
        target: '/admin/secret',
        flag_format: 'FLAG{...}'
      },
      {
        id: 2,
        title: 'Blacklist Bypass',
        difficulty: 'Medium',
        description: 'The /api/stage2/fetch endpoint blocks requests to common localhost representations (127.0.0.1, localhost, ::1, 0.0.0.0). However, the blacklist only checks exact string matches. Alternative IP notations such as hexadecimal (0x7f000001), decimal (2130706433), or octal representations can bypass the filter. Target: /admin/stage2/secret.',
        endpoint: '/api/stage2/fetch?url=',
        target: '/admin/stage2/secret',
        flag_format: 'FLAG{...}'
      },
      {
        id: 3,
        title: 'Blind SSRF Port Discovery',
        difficulty: 'Hard',
        description: 'The /api/stage3/fetch endpoint makes server-side requests but does NOT return the response body -- only status codes and timing data. An internal service is running on a non-standard port on localhost. Use timing-based analysis to scan for open ports. Once you discover the port, use the /api/stage3/exfiltrate?port= endpoint to retrieve the secret. The service port is between 9990-10000.',
        endpoint: '/api/stage3/fetch?url=',
        exfiltrate: '/api/stage3/exfiltrate?port=',
        target: 'Hidden internal service',
        flag_format: 'FLAG{...}'
      },
      {
        id: 4,
        title: 'Open Redirect Chain',
        difficulty: 'Expert',
        description: 'The /api/stage4/fetch endpoint enforces strict URL validation -- only http://trusted-api.local/* URLs are permitted. However, an open redirect exists at /api/redirect?to=<url>. If trusted-api.local resolves to the server itself (or you can make the server request its own redirect endpoint), you can chain the redirect to reach /admin/stage4/secret. Hint: trusted-api.local needs to resolve to 127.0.0.1. The redirect endpoint on this server at /api/redirect?to= will 302-redirect to any URL.',
        endpoint: '/api/stage4/fetch?url=',
        redirect: '/api/redirect?to=',
        target: '/admin/stage4/secret',
        flag_format: 'FLAG{...}'
      }
    ]
  });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log('SSRF Lab running on port ' + PORT);
  console.log('Security mode: ' + securityMode);
  startStage3Service();
});
