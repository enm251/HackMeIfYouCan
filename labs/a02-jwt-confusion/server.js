const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Generate RSA Key Pair at startup dynamically
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

const PUBLIC_KEY_PATH = path.join(__dirname, 'public-key.pem');
fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;

const stageFlags = {
  1: 'FLAG{jwt_key_confusion_signature_bypass}',
  2: 'FLAG{jwt_confusion_alg_waf_bypass}',
  3: 'FLAG{jwt_confusion_symmetric_bruteforce}',
  4: 'FLAG{jwt_confusion_jwks_public_key_expert}'
};

function addLog(entry) {
  logs.push({
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

// Helper: base64url encode/decode
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logger interceptor
app.use((req, res, next) => {
  const skip = req.path.startsWith('/api/settings') || req.path.startsWith('/api/logs') || req.path === '/public-key.pem';
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

// Serve public-key
app.get('/public-key.pem', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(publicKey);
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
// JWT Confusion Endpoints
// ---------------------------------------------------------------------------

// Create initial guest token
app.get('/api/token', (req, res) => {
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const payload = JSON.stringify({ username: "guest_user", role: "guest", iat: Math.floor(Date.now() / 1000) });
  
  const unsignedToken = `${base64urlEncode(header)}.${base64urlEncode(payload)}`;
  
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  res.json({ token: `${unsignedToken}.${signature}` });
});

app.post('/api/admin/flag', (req, res) => {
  const { token } = req.body;
  const stage = parseInt(req.query.stage) || 1;

  if (!token) {
    return res.status(401).json({ success: false, error: "Token is required" });
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return res.status(400).json({ success: false, error: "Invalid JWT format" });
  }

  try {
    const header = JSON.parse(base64urlDecode(parts[0]));
    const payload = JSON.parse(base64urlDecode(parts[1]));
    const signature = parts[2];
    const unsignedToken = `${parts[0]}.${parts[1]}`;

    if (securityMode === 'secure') {
      // SECURE MODE: Restrict verification algorithm strictly, reject HS256 if public key is RS256
      if (header.alg !== 'RS256') {
        return res.status(401).json({ success: false, error: "Security Shield Blocked: Algorithm mismatch." });
      }
    } else {
      // WAF blocks standard HS256 for Stage 2
      if (stage === 2) {
        if (header.alg === 'HS256') {
          return res.status(403).json({ success: false, error: "WAF BLOCK: Algorithm 'HS256' is restricted." });
        }
      }
    }

    const targetAlg = (header.alg || '').toUpperCase();
    if (targetAlg === 'HS256') {
      // Verify signature using public key PEM string as HMAC secret key
      const expectedSignature = crypto.createHmac('sha256', publicKey)
        .update(unsignedToken)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      if (signature !== expectedSignature) {
        return res.status(401).json({ success: false, error: "Invalid signature (HS256 verification failed)" });
      }
    } else if (targetAlg === 'RS256') {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(unsignedToken);
      const sigBuffer = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      const verified = verifier.verify(publicKey, sigBuffer);
      if (!verified) {
        return res.status(401).json({ success: false, error: "Invalid signature (RS256 verification failed)" });
      }
    } else {
      return res.status(400).json({ success: false, error: `Unsupported algorithm: ${header.alg}` });
    }

    if (payload.role === 'admin') {
      const flag = stageFlags[stage] || stageFlags[1];
      res.json({
        success: true,
        message: "Signature verified! Access granted.",
        flag: flag
      });
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
        role: payload.role
      });
    }

  } catch (err) {
    res.status(400).json({ success: false, error: `Token parsing error: ${err.message}` });
  }
});

// Front page served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`JWT Confusion lab running on port ${PORT}`);
});
