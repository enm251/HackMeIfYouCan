const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let securityMode = 'vulnerable';

// Simulated databases
const users = {
  admin: { password: "sUp3rS3cr3tP4ss!_" + crypto.randomBytes(4).toString('hex'), email: "admin@corporate.local" },
  guest: { password: "guest", email: "guest@corporate.local" },
  stage2_admin: { password: "stage2SecretSecure123!", email: "stage2_admin@corporate.local" },
  stage3_admin: { password: "stage3SecretSecure123!", email: "stage3_admin@corporate.local" },
  stage4_admin: { password: "stage4SecretSecure123!", email: "stage4_admin@corporate.local" }
};

const mailLog = [
  { to: "all-employees@corporate.local", subject: "Welcome to AeroPortal", body: "Portal v2.0 is online." }
];

const sessions = {};
const resetCodes = {};

// Stage 2, 3, 4 databases
const stage2Codes = {};
const stage3Tokens = {};
const stage4Tokens = {};

const analyticsLogs = [
  { timestamp: new Date().toISOString(), ip: "10.0.4.12", method: "GET", path: "/pixel.gif", referer: "http://corporate.local/dashboard" }
];

// Helper: parse cookies
function getSessionId(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts[0]) cookies[parts[0].trim()] = (parts[1] || '').trim();
  });
  return cookies['session_id'];
}

// Middleware: initialize session
app.use((req, res, next) => {
  let sessionId = getSessionId(req);
  if (!sessionId || !sessions[sessionId]) {
    sessionId = crypto.randomBytes(16).toString('hex');
    sessions[sessionId] = {
      username: null,
      codeVerified: false,
      verifiedUsername: null
    };
    res.cookie('session_id', sessionId, { path: '/' });
  }
  req.sessionId = sessionId;
  req.session = sessions[sessionId];
  next();
});

// Security Mode Settings API
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, securityMode });
  } else {
    res.status(400).json({ error: "Invalid mode" });
  }
});

// Outbound Mail Log
app.get('/api/mail-log', (req, res) => {
  res.json(mailLog);
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }
  
  const user = users[username.toLowerCase()];
  if (user && user.password === password) {
    req.session.username = username.toLowerCase();
    return res.json({ success: true, username: username.toLowerCase() });
  }
  
  res.status(401).json({ error: "Invalid username or password." });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.username = null;
  req.session.codeVerified = false;
  req.session.verifiedUsername = null;
  res.json({ success: true });
});

// --- STAGE 1 ---
app.post('/api/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required." });

  const normalizedUser = username.toLowerCase();
  const user = users[normalizedUser];
  if (!user) return res.status(404).json({ error: "User not found." });

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  resetCodes[normalizedUser] = code;

  mailLog.push({
    to: user.email,
    subject: "Reset Password Verification Code",
    body: `Use code ${code} to verify ownership of your account and complete password reset.`
  });

  res.json({ success: true, message: `Verification code generated and sent.` });
});

app.post('/api/verify-code', (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: "Username and code required." });

  const normalizedUser = username.toLowerCase();
  if (resetCodes[normalizedUser] && resetCodes[normalizedUser] === code.trim()) {
    req.session.codeVerified = true;
    req.session.verifiedUsername = normalizedUser;
    delete resetCodes[normalizedUser];
    return res.json({ success: true, message: "Code verified. Proceed to update password." });
  }
  res.status(400).json({ error: "Incorrect verification code." });
});

app.post('/api/reset-password', (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) return res.status(400).json({ error: "Username and password required." });

  const normalizedUser = username.toLowerCase();

  if (securityMode === 'secure') {
    // SECURE: Enforce that the reset username must match the verified user in the session!
    if (req.session.codeVerified && req.session.verifiedUsername === normalizedUser) {
      if (!users[normalizedUser]) return res.status(404).json({ error: "User not found." });
      users[normalizedUser].password = newPassword;
      req.session.codeVerified = false;
      req.session.verifiedUsername = null;
      return res.json({ success: true, message: "Password updated." });
    }
  } else {
    // VULNERABLE: Logical failure to verify session ownership of the target username!
    if (req.session.codeVerified) {
      if (!users[normalizedUser]) return res.status(404).json({ error: "User not found." });
      users[normalizedUser].password = newPassword;
      req.session.codeVerified = false;
      req.session.verifiedUsername = null;
      return res.json({ success: true, message: "Password updated." });
    }
  }
  res.status(403).json({ error: "Access Denied: Code verification step not completed." });
});

// --- STAGE 2 ---
app.post('/api/stage2/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required." });

  const normalizedUser = username.toLowerCase();
  if (!users[normalizedUser]) return res.status(404).json({ error: "User not found." });

  // Generate code (random but we do NOT send to mail log to force brute force)
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  stage2Codes[normalizedUser] = code;

  mailLog.push({
    to: users[normalizedUser].email,
    subject: "Reset Password Link Initialized",
    body: "A verification code has been generated. Use the 4-digit code to finalize password reset."
  });

  res.json({ success: true, message: "Verification code generated silently." });
});

app.post('/api/stage2/verify-code', (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: "Username and code required." });

  const normalizedUser = username.toLowerCase();

  // VULNERABLE: No rate limiting on verification, code is brute-forceable!
  if (stage2Codes[normalizedUser] && stage2Codes[normalizedUser] === code.trim()) {
    req.session.codeVerified = true;
    req.session.verifiedUsername = normalizedUser;
    delete stage2Codes[normalizedUser];
    return res.json({ success: true, flag: "FLAG{weak_prng_brute_force_success}" });
  }

  res.status(400).json({ error: "Incorrect verification code." });
});

// --- STAGE 3 ---
app.post('/api/stage3/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required." });

  const normalizedUser = username.toLowerCase();
  if (!users[normalizedUser]) return res.status(404).json({ error: "User not found." });

  const host = req.headers.host || 'corporate.local';
  const token = crypto.randomBytes(16).toString('hex');
  stage3Tokens[token] = normalizedUser;

  // VULNERABILITY: Construct reset URL based on Host header!
  const resetUrl = `http://${host}/reset?token=${token}`;

  mailLog.push({
    to: users[normalizedUser].email,
    subject: "Security System Reset Credentials Link",
    body: `Click the link to verify ownership and reset: ${resetUrl}`
  });

  res.json({ success: true, message: "Reset email dispatched." });
});

app.post('/api/stage3/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });

  const username = stage3Tokens[token];
  if (username) {
    delete stage3Tokens[token];
    return res.json({ success: true, username, flag: "FLAG{host_header_poisoning_leaked}" });
  }
  res.status(400).json({ error: "Invalid token" });
});

// --- STAGE 4 ---
app.post('/api/stage4/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required." });

  const normalizedUser = username.toLowerCase();
  if (!users[normalizedUser]) return res.status(404).json({ error: "User not found." });

  const token = crypto.randomBytes(16).toString('hex');
  stage4Tokens[token] = normalizedUser;

  // Simulate leakage by populating analytics logs with a mock referrer header
  analyticsLogs.push({
    timestamp: new Date().toISOString(),
    ip: "10.0.5.21",
    method: "GET",
    path: "/pixel.gif",
    referer: `http://corporate.local/reset-password.html?token=${token}`
  });

  mailLog.push({
    to: users[normalizedUser].email,
    subject: "Private Account Reset Token Dispatch",
    body: `Account token has been generated. Validate resetting at http://corporate.local/reset-password.html?token=${token}`
  });

  res.json({ success: true, message: "Account reset dispatched." });
});

app.get('/api/stage4/analytics-logs', (req, res) => {
  res.json(analyticsLogs);
});

app.post('/api/stage4/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token required" });

  const username = stage4Tokens[token];
  if (username) {
    delete stage4Tokens[token];
    return res.json({ success: true, username, flag: "FLAG{session_leak_via_referer_header}" });
  }
  res.status(400).json({ error: "Invalid token" });
});

// Get Flag
app.get('/api/admin/flag', (req, res) => {
  if (req.session.username === 'admin') {
    res.json({ success: true, flag: "FLAG{broken_reset_flow_hijacked}" });
  } else {
    res.status(403).json({ success: false, error: "Access Denied: Administrative session required." });
  }
});

app.listen(PORT, () => {
  console.log(`Insecure Design Lab running on port ${PORT}`);
});
