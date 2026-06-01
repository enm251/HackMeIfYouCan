const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;

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

// Transaction Logger Middleware
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
// Security Settings & Log Endpoints
// ---------------------------------------------------------------------------
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, securityMode });
  } else {
    res.status(400).json({ error: "Invalid security mode specification." });
  }
});

app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/logs/clear', (req, res) => {
  logs.length = 0;
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// CORS Route Handlers with Multi-stage logic
// ---------------------------------------------------------------------------

// Stage 1: Origin Reflection
app.get('/api/sensitive-profile', (req, res) => {
  const origin = req.headers.origin || '*';
  
  if (securityMode === 'secure') {
    // SECURE: Enforce strict whitelist, no dynamic reflection
    res.setHeader('Access-Control-Allow-Origin', 'http://trusted-corp.com');
  } else {
    // VULNERABLE: Reflect any origin with credentials allowed
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.json({
    username: 'admin',
    email: 'admin@corporate.local',
    role: 'administrator',
    flag: 'FLAG{cors_origin_credential_leak}'
  });
});

// Stage 2: Regex Suffix Bypass
app.get('/api/stage2/sensitive-data', (req, res) => {
  const origin = req.headers.origin || '';
  
  if (securityMode === 'secure') {
    // SECURE: Strict exact match check
    if (origin === 'http://trusted-corp.com' || origin === 'https://trusted-corp.com') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // VULNERABLE: Weak regex checks suffix only
    if (/trusted-corp\.com$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  res.json({
    accountNumber: '9902-1182-3847',
    balance: '$4,819,200.00',
    flag: 'FLAG{cors_regex_suffix_bypass}'
  });
});

// Stage 3: Null Origin Allowed
app.get('/api/stage3/confidential', (req, res) => {
  const origin = req.headers.origin || '';
  
  if (securityMode === 'secure') {
    if (origin !== 'null') {
      res.setHeader('Access-Control-Allow-Origin', 'http://trusted-corp.com');
    }
  } else {
    // VULNERABLE: Allow 'null' origin explicitly
    if (origin === 'null') {
      res.setHeader('Access-Control-Allow-Origin', 'null');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  res.json({
    apiToken: 'jwt_secret_token_18293712',
    flag: 'FLAG{cors_null_origin_bypass}'
  });
});

// Stage 4: Allowed Origin XSS / CSRF Chaining
app.get('/api/stage4/admin-data', (req, res) => {
  const origin = req.headers.origin || '';
  
  if (securityMode === 'secure') {
    if (origin === 'http://safe-subdomain.trusted-corp.com') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // VULNERABLE: Trust the subdomain strictly, but subdomain has XSS
    if (origin === 'http://safe-subdomain.trusted-corp.com' || origin === 'http://localhost:3000') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  res.json({
    sysconf: 'kernel.panic=1',
    flag: 'FLAG{cors_xss_chain_exfiltration_expert}'
  });
});

// Stage 4 XSS endpoint on allowed origin scope
app.get('/api/stage4/search', (req, res) => {
  const q = req.query.q || '';
  res.setHeader('Content-Type', 'text/html');
  if (securityMode === 'secure') {
    // SECURE: Output HTML escaping
    const escaped = q.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.send(`<h1>Search Results for:</h1> <p>${escaped}</p>`);
  } else {
    // VULNERABLE: Direct reflected XSS
    res.send(`<h1>Search Results for:</h1> <p>${q}</p>`);
  }
});

// Serve Frontend Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CORS Security Lab listening on port ${PORT}`);
});
