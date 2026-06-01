const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;
const VALID_USER = 'admin_sec_operator';
const VALID_PASS = 'shadow123';

const ipAttempts = new Map(); // ip -> { count, timestamp }
const lockedUsers = new Set(); // usernames

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
// Security settings & log history endpoints
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
// Login Endpoints
// ---------------------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const stage = parseInt(req.query.stage) || 1;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (securityMode === 'secure') {
    // SECURE MODE: Strict constant-time generic comparisons and global rate limits
    const now = Date.now();
    const attempts = ipAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
    if (attempts.count >= 5 && now - attempts.lastAttempt < 30000) {
      return res.status(429).json({ success: false, error: "Too many login attempts. Access temporarily restricted." });
    }

    attempts.count++;
    attempts.lastAttempt = now;
    ipAttempts.set(clientIp, attempts);

    // Generic error
    if (username !== VALID_USER || password !== VALID_PASS) {
      // Artificially wait to prevent timing attacks
      setTimeout(() => {
        return res.status(401).json({ success: false, error: "Invalid credentials." });
      }, 250);
      return;
    }

    return res.json({
      success: true,
      token: "session_tok_" + Math.random().toString(36).substring(2),
      flag: "FLAG{verbose_errors_enable_brute_force}"
    });
  }

  // VULNERABLE behavior per stage
  if (stage === 1) {
    // Stage 1: Standard Username Enumeration
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }
    if (username !== VALID_USER) {
      return res.status(401).json({ success: false, error: "Invalid username" });
    }
    if (password !== VALID_PASS) {
      return res.status(401).json({ success: false, error: "Incorrect password for user" });
    }
    return res.json({
      success: true,
      token: "session_tok_" + Math.random().toString(36).substring(2),
      flag: "FLAG{verbose_errors_enable_brute_force}"
    });
  }

  if (stage === 2) {
    // Stage 2: IP-based rate limiting
    const now = Date.now();
    const attempts = ipAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
    if (attempts.count >= 3 && now - attempts.lastAttempt < 15000) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded for this IP. Rotate IP to bypass." });
    }

    attempts.count++;
    attempts.lastAttempt = now;
    ipAttempts.set(clientIp, attempts);

    if (username !== VALID_USER) {
      return res.status(401).json({ success: false, error: "Invalid username" });
    }
    if (password !== VALID_PASS) {
      return res.status(401).json({ success: false, error: "Incorrect password for user" });
    }

    return res.json({
      success: true,
      token: "session_tok_" + Math.random().toString(36).substring(2),
      flag: "FLAG{brute_force_ip_rotation_bypass}"
    });
  }

  if (stage === 3) {
    // Stage 3: Account Lockout after 3 attempts
    if (lockedUsers.has(username)) {
      return res.status(423).json({ success: false, error: "Account locked due to multiple failed login attempts." });
    }

    const attempts = ipAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    ipAttempts.set(clientIp, attempts);

    if (attempts.count >= 3) {
      lockedUsers.add(username);
    }

    if (username !== VALID_USER) {
      return res.status(401).json({ success: false, error: "Invalid username" });
    }
    if (password !== VALID_PASS) {
      return res.status(401).json({ success: false, error: "Incorrect password for user" });
    }

    return res.json({
      success: true,
      token: "session_tok_" + Math.random().toString(36).substring(2),
      flag: "FLAG{brute_force_lockout_bypass}"
    });
  }

  if (stage === 4) {
    // Stage 4: Timing-based username enumeration
    // If username exists, execute heavy computation database or wait loop.
    // Attacker measures response time to determine user existence.
    const start = Date.now();
    if (username === VALID_USER) {
      // Simulate heavy lookup delay
      let waitTill = Date.now() + 200;
      while (Date.now() < waitTill) {}
    }

    if (username !== VALID_USER || password !== VALID_PASS) {
      return res.status(401).json({ success: false, error: "Authentication failed" });
    }

    return res.json({
      success: true,
      token: "session_tok_" + Math.random().toString(36).substring(2),
      flag: "FLAG{brute_force_timing_enum_expert}"
    });
  }
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Brute Force Lab listening on port ${PORT}`);
});
