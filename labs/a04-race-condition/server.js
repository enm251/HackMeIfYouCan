const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Lab state & variables
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;

// Stage 1 State
let balance = 50;
let redeemedCoupons = new Set();

// Stage 2 State
let accounts = {
  attacker: 100,
  recipient: 0
};

// Stage 3 State
const tempSessionFile = path.join(__dirname, 'temp_session.txt');

// Stage 4 State
let oauthCodes = {
  'active_code_123': { used: false, user: 'admin' }
};

const stageFlags = {
  1: 'FLAG{race_condition_concurrency_bypass}',
  2: 'FLAG{race_condition_transfer_double_spend}',
  3: 'FLAG{race_condition_temp_file_overwrite_bypass}',
  4: 'FLAG{race_condition_oauth_code_reuse_expert}'
};

// Helper logger
function addLog(req, statusCode, details = '') {
  logs.push({
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    statusCode,
    duration: Math.floor(Math.random() * 20) + 'ms',
    details,
    securityMode
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

// Logger middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/settings') || req.originalUrl.startsWith('/api/logs')) {
    return next();
  }
  const originalSend = res.send;
  res.send = function (body) {
    addLog(req, res.statusCode, body.substring(0, 150));
    return originalSend.apply(res, arguments);
  };
  next();
});

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Lock helpers for secure mode
const mutexes = {
  coupon: false,
  transfer: false,
  fileWrite: false,
  oauth: false
};

// ---------------------------------------------------------------------------
// Settings & Logs API
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
// STAGE 1: Coupon Double-Apply (Easy)
// ---------------------------------------------------------------------------
app.post('/api/apply-coupon', async (req, res) => {
  const { coupon } = req.body;

  if (coupon !== 'FREE50') {
    return res.status(400).json({ error: 'Invalid coupon code.' });
  }

  if (securityMode === 'secure') {
    // SECURE: Strict synchronized check
    if (mutexes.coupon) {
      return res.status(429).json({ error: 'System busy. Please try again.' });
    }
    mutexes.coupon = true;
    try {
      if (redeemedCoupons.has(coupon)) {
        return res.status(400).json({ error: 'Coupon already redeemed!' });
      }
      balance += 50;
      redeemedCoupons.add(coupon);
      return res.json({ message: 'Coupon applied successfully!', balance });
    } finally {
      mutexes.coupon = false;
    }
  } else {
    // VULNERABLE: Async delay check-to-use TOCTOU window
    if (redeemedCoupons.has(coupon)) {
      return res.status(400).json({ error: 'Coupon already redeemed!' });
    }

    await delay(100);

    balance += 50;
    redeemedCoupons.add(coupon);
    res.json({ message: 'Coupon applied successfully!', balance });
  }
});

app.post('/api/buy-flag', (req, res) => {
  if (balance >= 100) {
    res.json({ flag: stageFlags[1] });
  } else {
    res.status(400).json({ error: 'Insufficient balance. Cost is 100.' });
  }
});

// ---------------------------------------------------------------------------
// STAGE 2: DB Balance Transfer Double Spend (Medium)
// ---------------------------------------------------------------------------
app.post('/api/stage2/transfer', async (req, res) => {
  const { amount } = req.body;
  const numAmount = parseInt(amount, 10);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer amount.' });
  }

  if (securityMode === 'secure') {
    if (mutexes.transfer) {
      return res.status(429).json({ error: 'Transfer in progress. Please retry.' });
    }
    mutexes.transfer = true;
    try {
      if (accounts.attacker < numAmount) {
        return res.status(400).json({ error: 'Insufficient funds.' });
      }
      accounts.attacker -= numAmount;
      accounts.recipient += numAmount;
      return res.json({ message: 'Transfer successful', accounts });
    } finally {
      mutexes.transfer = false;
    }
  } else {
    if (accounts.attacker < numAmount) {
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    // Vulnerable delay between validation and update
    await delay(100);

    accounts.attacker -= numAmount;
    accounts.recipient += numAmount;
    res.json({ message: 'Transfer successful', accounts });
  }
});

app.post('/api/stage2/buy-flag', (req, res) => {
  if (accounts.recipient >= 200) {
    res.json({ flag: stageFlags[2] });
  } else {
    res.status(400).json({ error: 'Insufficient recipient funds. Required: 200.' });
  }
});

// ---------------------------------------------------------------------------
// STAGE 3: Temporary Shared File Collision (Hard)
// ---------------------------------------------------------------------------
app.post('/api/stage3/authenticate', async (req, res) => {
  const { username, role } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required.' });
  }

  if (securityMode === 'secure') {
    // SECURE: Use session-specific identifiers instead of a static global temp file
    if (role === 'admin') {
      return res.status(403).json({ error: 'Unauthorized role assignment.' });
    }
    return res.json({ success: true, user: username, role: 'user' });
  } else {
    // VULNERABLE: Writes to a single shared file, then reads back after delay
    try {
      fs.writeFileSync(tempSessionFile, JSON.stringify({ username, role: role || 'user' }));
      
      await delay(100);
      
      const fileData = fs.readFileSync(tempSessionFile, 'utf8');
      const session = JSON.parse(fileData);
      
      if (session.role === 'admin') {
        return res.json({ success: true, flag: stageFlags[3], message: 'Authenticated as admin via file collision!' });
      }
      
      res.json({ success: true, user: session.username, role: session.role });
    } catch (e) {
      res.status(500).json({ error: 'Session write error.' });
    }
  }
});

// ---------------------------------------------------------------------------
// STAGE 4: OAuth Authorization Code Exchange Reuse (Expert)
// ---------------------------------------------------------------------------
let points = 0;
app.post('/api/stage4/exchange', async (req, res) => {
  const { code } = req.body;

  if (!code || !oauthCodes[code]) {
    return res.status(400).json({ error: 'Invalid OAuth code.' });
  }

  if (securityMode === 'secure') {
    if (mutexes.oauth) {
      return res.status(429).json({ error: 'Transaction busy.' });
    }
    mutexes.oauth = true;
    try {
      if (oauthCodes[code].used) {
        return res.status(400).json({ error: 'OAuth code has already been redeemed!' });
      }
      oauthCodes[code].used = true;
      points += 100;
      return res.json({ success: true, points });
    } finally {
      mutexes.oauth = false;
    }
  } else {
    if (oauthCodes[code].used) {
      return res.status(400).json({ error: 'OAuth code has already been redeemed!' });
    }

    // TOCTOU race: wait before marking code as used
    await delay(100);

    oauthCodes[code].used = true;
    points += 100;
    res.json({ success: true, points });
  }
});

app.post('/api/stage4/buy-flag', (req, res) => {
  if (points >= 200) {
    res.json({ flag: stageFlags[4] });
  } else {
    res.status(400).json({ error: 'Exchange at least 2 tokens with code active_code_123 concurrently. Required balance: 200.' });
  }
});

// ---------------------------------------------------------------------------
// Reset route
// ---------------------------------------------------------------------------
app.post('/api/reset', (req, res) => {
  balance = 50;
  redeemedCoupons.clear();
  accounts = { attacker: 100, recipient: 0 };
  points = 0;
  oauthCodes = { 'active_code_123': { used: false, user: 'admin' } };
  
  if (fs.existsSync(tempSessionFile)) {
    try { fs.unlinkSync(tempSessionFile); } catch (e) {}
  }
  
  res.json({ message: 'Lab state reset.', balance, accounts, points });
});

app.listen(PORT, () => {
  console.log(`Race Condition Lab running on port ${PORT}`);
});
