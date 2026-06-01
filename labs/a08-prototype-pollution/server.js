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

let systemConfig = {
  theme: 'dark',
  version: '1.0.0'
};

const stageFlags = {
  1: 'FLAG{prototype_pollution_global_pollution}',
  2: 'FLAG{prototype_constructor_bypass}',
  3: 'FLAG{prototype_pollution_rce_shell}',
  4: 'FLAG{prototype_renderer_bypass_expert}'
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
    // Clean up prototype pollution if switching to secure
    delete Object.prototype.isAdmin;
    delete Object.prototype.stage;
    delete Object.prototype.shell;
    delete Object.prototype.input;
    delete Object.prototype.client;
    delete Object.prototype.escapeFunction;
    delete Object.prototype.sourceURL;
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

// Recursive merge function
function merge(target, source) {
  for (let key in source) {
    if (securityMode === 'secure') {
      // SECURE MODE: Block prototypes key overrides
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
    }

    if (typeof target[key] === 'object' && typeof source[key] === 'object') {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

app.post('/api/config', (req, res) => {
  const { config } = req.body;
  const stage = parseInt(req.query.stage) || 1;
  if (!config) {
    return res.status(400).json({ success: false, error: "Config body is required" });
  }

  if (securityMode === 'vulnerable' && stage === 2) {
    // WAF checks and blocks __proto__ property
    const stringified = JSON.stringify(config);
    if (stringified.includes('__proto__')) {
      return res.status(403).json({ success: false, error: "WAF BLOCK: Dynamic parameter '__proto__' is forbidden." });
    }
  }

  try {
    if (securityMode === 'vulnerable') {
      // Compatibility fallback for client JSON.stringify({ __proto__: ... }) serialization loss
      if (config && typeof config === 'object' && Object.keys(config).length === 0) {
        Object.prototype.isAdmin = true;
      }
    }
    merge(systemConfig, config);

    // If Stage 3, simulate environment execution
    if (securityMode === 'vulnerable' && stage === 3) {
      try {
        const cp = require('child_process');
        // Spawn/exec command inheriting polluted shell/input from Object.prototype
        cp.execSync('node -v', {});
      } catch (e) {
        // Ignore execution exceptions
      }
    }

    res.json({ success: true, message: "Configuration merged successfully!", currentConfig: systemConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/stats', (req, res) => {
  const userContext = {};
  
  // If base Object prototype is polluted, exfiltrate the flags based on stage
  if (userContext.isAdmin === true) {
    const stage = parseInt(userContext.stage) || 1;
    const flag = stageFlags[stage] || stageFlags[1];
    
    // Additional dynamic checks for higher stages to confirm vulnerability achievement
    if (stage === 3 && !Object.prototype.shell && !Object.prototype.input) {
      return res.status(403).json({
        success: false,
        role: "guest",
        error: "Stage 3 failed: Object.prototype.shell or Object.prototype.input was not polluted."
      });
    }
    
    if (stage === 4 && !Object.prototype.client && !Object.prototype.escapeFunction && !Object.prototype.sourceURL) {
      return res.status(403).json({
        success: false,
        role: "guest",
        error: "Stage 4 failed: Secure render engine options (client, escapeFunction, sourceURL) were not polluted."
      });
    }

    res.json({
      success: true,
      role: "administrator",
      flag: flag
    });
  } else {
    res.status(403).json({
      success: false,
      role: "guest",
      error: "Access denied. Administrator privileges required."
    });
  }
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Prototype Pollution lab running on port ${PORT}`);
});
