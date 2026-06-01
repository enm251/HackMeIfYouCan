const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const internalAuditLogs = [];
const leakedFlags = [];
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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Logger interceptor
app.use((req, res, next) => {
  const skip = req.path.startsWith('/api/settings') || req.path.startsWith('/api/logs') || req.path.startsWith('/api/leak') || req.path.startsWith('/api/attacker-receiver');
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
// Settings & Logs Endpoints
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
    res.status(400).json({ error: "Invalid mode." });
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
// Vulnerability Endpoints
// ---------------------------------------------------------------------------

// Login endpoint (Failed logins are saved to the audit logs)
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const xForwardedFor = req.headers['x-forwarded-for'] || 'Unknown';
  const stage = parseInt(req.query.stage) || 1;

  let loggedUa = userAgent;
  let loggedIp = xForwardedFor;

  if (securityMode === 'secure') {
    // SECURE MODE: Strict HTML escaping
    loggedUa = userAgent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    loggedIp = xForwardedFor.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  } else {
    if (stage === 2) {
      // Stage 2: UA is escaped, but IP header is raw!
      loggedUa = userAgent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  internalAuditLogs.push({
    timestamp: new Date().toISOString(),
    username: username || 'anonymous',
    userAgent: loggedUa,
    ip: loggedIp,
    stage: stage
  });

  res.status(401).send("<h1>Unauthorized</h1><p>Invalid credentials. Attempt logged.</p>");
});

// Attacker Leak Receivers
app.get('/api/leak', (req, res) => {
  const flag = req.query.flag;
  if (flag) {
    leakedFlags.push(flag);
  }
  res.json({ success: true });
});

app.get('/api/attacker-receiver/logs', (req, res) => {
  res.json({ flags: leakedFlags });
});

app.post('/api/attacker-receiver/clear', (req, res) => {
  leakedFlags.length = 0;
  res.json({ success: true });
});

// Admin Flag Endpoint
app.get('/api/admin/flag', (req, res) => {
  const stage = parseInt(req.query.stage) || 1;
  if (stage === 2) {
    res.json({ success: true, flag: "FLAG{log_xss_ip_header_bypass}" });
  } else if (stage === 3) {
    res.json({ success: true, flag: "FLAG{log_xss_csp_exfiltration_bypass}" });
  } else if (stage === 4) {
    res.json({ success: true, flag: "FLAG{log_xss_proto_pollution_render_expert}" });
  } else {
    res.json({ success: true, flag: "FLAG{log_poisoning_stored_xss}" });
  }
});

// Simulated Admin reviewing audit logs (Bot trigger)
app.get('/api/trigger-admin-view', (req, res) => {
  let triggered = false;
  let targetFlag = "FLAG{log_poisoning_stored_xss}";

  internalAuditLogs.forEach(log => {
    const text = log.userAgent + " " + log.username + " " + log.ip;
    if (text.includes('<script>') && text.includes('fetch')) {
      triggered = true;
      if (log.stage === 2) targetFlag = "FLAG{log_xss_ip_header_bypass}";
      if (log.stage === 3) targetFlag = "FLAG{log_xss_csp_exfiltration_bypass}";
      if (log.stage === 4) targetFlag = "FLAG{log_xss_proto_pollution_render_expert}";
    }
  });

  if (triggered) {
    // Simulate XSS execution making request to leak endpoint with stolen flag
    const leakUrl = `http://localhost:${PORT}/api/leak?flag=${targetFlag}`;
    fetch(leakUrl)
      .then(() => {})
      .catch(e => {});
  }

  res.json({
    success: true,
    message: "Administrator viewed the connection logs.",
    xssTriggered: triggered
  });
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Log XSS Lab listening on port ${PORT}`);
});
