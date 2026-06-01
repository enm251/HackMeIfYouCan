const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// State & Memory Store
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;
const authorizationCodes = new Map(); // code -> { username, redirectUri }
const accessTokens = new Map();       // token -> username
const activeSessions = new Map();     // sessionId -> username
const attackerLogs = [];

const CLIENT_ID = 'client123';
const CLIENT_SECRET = 'secret123';

function addLog(entry) {
  logs.push({
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

// Seed admin sessions
const adminSessionId = 'sess_admin_preseeded';
activeSessions.set(adminSessionId, 'admin');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Transaction Logger Middleware
app.use((req, res, next) => {
  const skip = req.path.startsWith('/api/settings') || req.path.startsWith('/api/logs') || req.path.startsWith('/api/attacker-receiver');
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
// Attacker Receiver Endpoints (Simulates Attacker Host)
// ---------------------------------------------------------------------------
app.get('/api/attacker-receiver', (req, res) => {
  const query = req.query;
  attackerLogs.push({
    timestamp: new Date().toISOString(),
    query: query,
    headers: req.headers
  });
  res.send('<h1>Logged</h1><p>Leaked request successfully logged by attacker receiver.</p>');
});

app.get('/api/attacker-receiver/logs', (req, res) => {
  res.json({ logs: attackerLogs });
});

app.post('/api/attacker-receiver/clear', (req, res) => {
  attackerLogs.length = 0;
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Security Mode & Logger APIs
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
    res.status(400).json({ error: "Invalid security mode." });
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
// OAuth Provider Flow
// ---------------------------------------------------------------------------

// Bot simulator to mimic admin trigger-login (Compatibility with verify_labs.js)
app.get('/api/trigger-login', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL." });

  // Simulate admin triggering the oauth flow (which auto-authorizes and redirects)
  const targetUrl = new URL(url);
  const redirectUri = targetUrl.searchParams.get('redirect_uri');
  const code = 'code_admin_' + generateToken();
  authorizationCodes.set(code, { username: 'admin', redirectUri });

  // Fast trigger redirect with simulated code
  let redirectUrl = redirectUri + (redirectUri.includes('?') ? '&' : '?') + `code=${code}`;
  
  // Docker port mapping workaround: rewrite host mapped port to container internal port 3000
  redirectUrl = redirectUrl.replace(/localhost:\d+/, 'localhost:3000');
  
  // Trigger attacker logging
  fetch(redirectUrl)
    .then(() => {
      res.json({ success: true, message: "Admin authorization flow successfully triggered." });
    })
    .catch(err => {
      res.json({ success: true, message: "Admin flow triggered with external redirection." });
    });
});

// Authorize Route
app.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state, stage } = req.query;
  const stageNum = parseInt(stage) || 1;

  if (client_id !== CLIENT_ID) return res.status(400).send("Invalid client_id");
  if (!redirect_uri) return res.status(400).send("Missing redirect_uri");

  // Validate redirect_uri based on Security Mode and Stage
  if (securityMode === 'secure') {
    // SECURE: Enforce absolute exact whitelist check
    if (redirect_uri !== 'http://localhost:30020/oauth/callback') {
      return res.status(403).send("Security Block: Invalid redirect_uri. Exact match required.");
    }
  } else {
    // VULNERABLE behavior per stage
    if (stageNum === 1) {
      // Stage 1: Path Traversal Bypass
      if (!redirect_uri.startsWith('http://localhost:30020/oauth/callback')) {
        return res.status(403).send("Invalid redirect_uri - domain mismatch");
      }
    } else if (stageNum === 2) {
      // Stage 2: Weak Regex Check suffix
      if (!/.*\.trusted-corp\.com/.test(redirect_uri)) {
        return res.status(403).send("Invalid redirect_uri - only trusted-corp.com allowed");
      }
    }
  }

  // Pre-seed mock login session
  const code = 'code_' + generateToken();
  authorizationCodes.set(code, { username: 'admin', redirectUri: redirect_uri });

  const targetUrl = redirect_uri + (redirect_uri.includes('?') ? '&' : '?') + `code=${code}` + (state ? `&state=${state}` : '');
  res.redirect(targetUrl);
});

// Callback Route (Client Application Callback)
app.get('/oauth/callback', (req, res) => {
  const { code, state } = req.query;

  // Simulate token exfiltration
  const sessionId = 'sess_user_' + generateToken();
  activeSessions.set(sessionId, 'admin');
  res.cookie('session_id', sessionId, { httpOnly: true });

  res.send(`
    <html>
    <head>
      <title>Authentication Complete</title>
      <script>
        // PostMessage leakage for Stage 4
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth_callback', code: '${code}' }, '*');
        }
      </script>
    </head>
    <body>
      <h3>Authentication Successful</h3>
      <p>Session initialized. You may close this window.</p>
    </body>
    </html>
  `);
});

// Client App Flag endpoint
app.get('/api/admin/flag', (req, res) => {
  const sessionId = req.cookies.session_id;
  const username = activeSessions.get(sessionId);

  if (username === 'admin') {
    res.json({
      username: 'admin',
      role: 'administrator',
      flag: 'FLAG{oauth_redirect_uri_hijack}'
    });
  } else {
    res.status(403).json({ error: "Access Denied: Administrator role required." });
  }
});

// Serve frontend dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OAuth Security Lab listening on port ${PORT}`);
});
