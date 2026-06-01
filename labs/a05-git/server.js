const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

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

// Remediation Shield check for Git folder
app.use('/.git', (req, res, next) => {
  if (securityMode === 'secure') {
    return res.status(403).json({ error: "Access Denied: Dynamic directory exposure of /.git configuration is blocked." });
  }
  next();
}, express.static(path.join(__dirname, '.git'), { dotfiles: 'allow' }));

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

// Frontpage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Exposed Git Repository Lab listening on port ${PORT}`);
});
