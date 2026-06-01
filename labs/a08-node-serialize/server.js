const express = require('express');
const cookieParser = require('cookie-parser');
const serialize = require('node-serialize');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Dynamic public dir
const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

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

// Ensure flag.txt is located at /app/flag.txt
if (!fs.existsSync(path.join(__dirname, 'flag.txt'))) {
  fs.writeFileSync(path.join(__dirname, 'flag.txt'), 'FLAG{node_serialize_rce_shell}\n');
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(cookieParser());
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
// Deserialization Endpoints
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  const sessionCookie = req.cookies['session'];
  const stage = parseInt(req.query.stage) || 1;

  // Serve premium dashboard if no session cookie is supplied
  if (!sessionCookie) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  try {
    const rawSerialized = Buffer.from(sessionCookie, 'base64').toString('utf8');

    if (securityMode === 'secure') {
      // SECURE MODE: Prevent deserialization RCE by using safe JSON parsing only
      const userSession = JSON.parse(rawSerialized);
      return res.json({
        success: true,
        message: "Successfully deserialized session safely via JSON schema parser.",
        session: userSession
      });
    }

    // VULNERABLE behavior per stage
    if (stage === 2) {
      // Stage 2: Block child_process / execSync keyword
      const lowered = rawSerialized.toLowerCase();
      if (lowered.includes('child_process') || lowered.includes('execsync')) {
        return res.status(403).json({ error: "IPS BLOCK: Execution module 'child_process' or function 'execSync' is restricted." });
      }
    }

    if (stage === 3) {
      // Stage 3: Strict length constraint (< 120 chars)
      if (sessionCookie.length > 150) {
        return res.status(400).json({ error: "Malformed request payload: size limit exceeded." });
      }
    }

    // Execute unsafe deserialization
    const userSession = serialize.unserialize(rawSerialized);

    let welcomeMsg = "Guest Operator Portal";
    if (userSession && userSession.username) {
      welcomeMsg = `Operator: ${userSession.username} [Role: ${userSession.role || 'operator'}]`;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Node Serialization Hub</title>
        <style>
          body { background: #000000; color: #38bdf8; font-family: sans-serif; padding: 50px; text-align: center; }
          .container { border: 1px solid rgba(255,255,255,0.08); padding: 30px; display: inline-block; border-radius: 8px; background: rgba(17, 24, 39, 0.7); box-shadow: 0 0 15px rgba(56,189,248,0.2); }
          h2 { margin-bottom: 20px; text-shadow: 0 0 5px #38bdf8; }
          p { color: #f3f4f6; font-size: 1.1rem; }
          .cookie-box { background: rgba(56,189,248,0.1); padding: 10px; margin-top: 20px; font-family: monospace; border: 1px dashed #38bdf8; word-break: break-all; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>SERIALIZATION DATA ENGINE</h2>
          <p>${welcomeMsg}</p>
          <p>Session data dynamically loaded and parsed.</p>
          <div class="cookie-box">
            <strong>Active Session Cookie (Base64):</strong><br>
            ${sessionCookie}
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    res.status(500).json({ error: `Deserialization error: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Node-Serialize Lab listening on port ${PORT}`);
});
