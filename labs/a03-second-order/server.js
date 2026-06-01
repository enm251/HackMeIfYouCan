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
const activeSessions = {};

// Mock SQL database tables
const users = [
  { id: 1, username: 'admin', password: 'FLAG{second_order_sqli_takeover}', email: 'admin@corp.local', role: 'admin' }
];

const stageFlags = {
  2: 'FLAG{second_order_sqli_waf_bypass}',
  3: 'FLAG{second_order_sqli_stacked_delay}',
  4: 'FLAG{second_order_numeric_bypass_expert}'
};

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
// SQL Evaluation Simulator
// ---------------------------------------------------------------------------
function executeSelectQuery(sql) {
  const match = sql.match(/username\s*=\s*'([^']*)'/i);
  if (!match) {
    if (sql.includes("' --") || sql.includes("'--")) {
      const parts = sql.split("'");
      const injectedPart = parts[1].trim();
      if (injectedPart.startsWith("admin")) {
        return users.find(u => u.username === 'admin');
      }
    }
    return null;
  }
  const targetUsername = match[1];
  return users.find(u => u.username === targetUsername);
}

// Register API
app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  const stage = parseInt(req.query.stage) || 1;

  if (!username || !password || !email) {
    return res.status(400).json({ success: false, error: "All fields are required" });
  }

  if (users.find(u => u.username === username)) {
    return res.status(409).json({ success: false, error: "Username already taken." });
  }

  let finalUsername = username;
  if (securityMode === 'secure') {
    // SECURE MODE: Strict parameter escaping on register inputs
    finalUsername = username.replace(/'/g, "''");
  }

  users.push({
    id: users.length + 1,
    username: finalUsername,
    password: password,
    email: email,
    role: 'user',
    stage: stage
  });

  res.json({ success: true, message: "User registered successfully!" });
});

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const matched = users.find(u => u.username === username && u.password === password);
  
  if (matched) {
    const token = Math.random().toString(36).substring(2);
    activeSessions[token] = { username: matched.username, stage: matched.stage || 1 };
    res.json({ success: true, token, username: matched.username });
  } else {
    res.status(401).json({ success: false, error: "Invalid username or password" });
  }
});

// Profile API
app.get('/api/profile', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing Authorization header" });
  }

  const token = authHeader.replace('Bearer ', '');
  const session = activeSessions[token];
  if (!session) {
    return res.status(401).json({ success: false, error: "Session expired or invalid" });
  }

  const username = session.username;
  const stage = session.stage;

  if (securityMode === 'secure') {
    // SECURE: Parameterized profile query check
    const matched = users.find(u => u.username === username);
    if (matched) {
      return res.json({
        success: true,
        profile: {
          username: matched.username,
          email: matched.email,
          role: matched.role,
          flag: null
        }
      });
    }
  }

  // VULNERABLE Second-Order execution
  const rawSql = `SELECT * FROM users WHERE username = '${username}'`;
  console.log(`[SQL Execute] ${rawSql}`);

  const userRecord = executeSelectQuery(rawSql);
  if (userRecord) {
    let flag = userRecord.password;
    if (stageFlags[stage]) {
      flag = stageFlags[stage];
    }
    
    res.json({
      success: true,
      profile: {
        username: userRecord.username,
        email: userRecord.email,
        role: userRecord.role,
        flag: userRecord.username === 'admin' ? flag : null
      }
    });
  } else {
    res.status(404).json({ success: false, error: "Profile not found in database." });
  }
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Second-Order SQLi lab running on port ${PORT}`);
});
