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

// Mock User Database
const users = [
  { username: 'admin_sec_operator', password: 'FLAG{nosql_operator_injection_bypass}' }
];

const stagePasswords = {
  2: 'FLAG{nosql_escaped_operator_bypass}',
  3: 'FLAG{nosql_blind_timing_extraction}',
  4: 'FLAG{nosql_nested_regex_extraction_expert}'
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
// NoSQL Evaluation Logic
// ---------------------------------------------------------------------------
function evaluateQuery(userObj, queryVal) {
  if (securityMode === 'secure') {
    // SECURE MODE: Enforce absolute string values, reject any object formats
    if (typeof queryVal === 'object') return false;
    return userObj === queryVal;
  }

  if (typeof queryVal === 'object' && queryVal !== null) {
    for (const [op, val] of Object.entries(queryVal)) {
      if (op === '$ne') {
        return userObj !== val;
      }
      if (op === '$eq') {
        return userObj === val;
      }
      if (op === '$gt') {
        return userObj > val;
      }
      if (op === '$regex') {
        try {
          const regex = new RegExp(val);
          return regex.test(userObj);
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  }
  return userObj === queryVal;
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const stage = parseInt(req.query.stage) || 1;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password are required" });
  }

  // WAF checks per stage
  if (securityMode === 'vulnerable') {
    if (stage === 2) {
      // Stage 2 blocks standard operator keys in body values
      const stringified = JSON.stringify(req.body);
      if (stringified.includes('"$ne"') || stringified.includes('"$regex"')) {
        return res.status(403).json({ success: false, error: "WAF BLOCK: Operator properties are blacklisted." });
      }
    }
  }

  const matchedUser = users.find(u => {
    return evaluateQuery(u.username, username) && evaluateQuery(u.password, password);
  });

  if (matchedUser) {
    let flag = matchedUser.password;
    if (stagePasswords[stage]) {
      flag = stagePasswords[stage];
    }
    
    // Stage 3 blind timing logic simulation
    if (stage === 3 && securityMode === 'vulnerable') {
      // Simulate blind timing delay when credentials match
      const start = Date.now();
      while (Date.now() - start < 1500) {}
    }

    res.json({
      success: true,
      message: "Authentication successful! Welcome operator.",
      flag: flag
    });
  } else {
    res.status(401).json({
      success: false,
      error: "Invalid credentials."
    });
  }
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NoSQL Injection Lab listening on port ${PORT}`);
});
