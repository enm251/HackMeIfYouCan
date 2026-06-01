const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Dynamic public dir
const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Ensure flag.txt exists
fs.writeFileSync(path.join(__dirname, 'flag.txt'), 'FLAG{argument_injection_rce_parameter}\n', 'utf8');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;

const stageFlags = {
  1: 'FLAG{argument_injection_rce_parameter}',
  2: 'FLAG{argument_prefix_bypass}',
  3: 'FLAG{argument_inband_exfiltration}',
  4: 'FLAG{argument_git_command_execution_expert}'
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
app.use(express.static(PUBLIC_DIR));

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
// Vulnerability Endpoints
// ---------------------------------------------------------------------------

// Internal flag endpoint
app.get('/flag', (req, res) => {
  const stage = parseInt(req.query.stage) || 1;
  const flag = stageFlags[stage] || stageFlags[1];
  res.send(flag);
});

app.post('/api/fetch', (req, res) => {
  let { url } = req.body;
  const stage = parseInt(req.query.stage) || 1;
  
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  // Clean url and redirect port if host port mapped
  const sanitizeUrl = (item) => {
    let cleaned = String(item).trim();
    if (cleaned.includes('localhost:')) {
      cleaned = cleaned.replace(/localhost:\d+/, 'localhost:3000');
    }
    if (cleaned.includes('127.0.0.1:')) {
      cleaned = cleaned.replace(/127\.0\.0\.1:\d+/, '127.0.0.1:3000');
    }
    return cleaned;
  };

  if (Array.isArray(url)) {
    url = url.map(sanitizeUrl);
  } else {
    url = sanitizeUrl(url);
  }

  // WAF check per stage
  if (securityMode === 'secure') {
    // SECURE MODE: Strict array sanitation, reject any options starting with - or --
    const safeUrl = [];
    const checkArray = Array.isArray(url) ? url : [url];
    for (const item of checkArray) {
      const cleaned = String(item).trim();
      if (cleaned.startsWith('-')) {
        return res.status(403).json({ success: false, error: "Security Shield Blocked: CLI flags are forbidden." });
      }
      safeUrl.push(cleaned);
    }
    url = safeUrl;
  } else {
    if (stage === 2) {
      // WAF blocks standard dashes
      const checkArray = Array.isArray(url) ? url : [url];
      for (const item of checkArray) {
        if (String(item).startsWith('-') || String(item).startsWith('--')) {
          return res.status(403).json({ success: false, error: "WAF BLOCK: Option prefixes are restricted." });
        }
      }
    }
  }

  const args = ['-sL'];
  if (Array.isArray(url)) {
    args.push(...url);
  } else {
    args.push(String(url));
  }

  console.log(`[EXECUTE] curl ${args.join(' ')}`);

  execFile('curl', args, { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, error: `Execution error: ${error.message}`, stderr });
    }
    
    res.json({
      success: true,
      message: "Resource fetched successfully!",
      output: stdout.substring(0, 1000)
    });
  });
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Argument injection lab running on port ${PORT}`);
});
