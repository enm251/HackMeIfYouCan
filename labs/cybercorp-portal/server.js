const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', __dirname);

// Create public directory for static files and leaks
const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Generate or load persistent RSA key pairs for JWT SSO
const privKeyPath = path.join(__dirname, 'private-key.pem');
const pubKeyPath = path.join(__dirname, 'public-key.pem');
let privateKey, publicKey;

if (fs.existsSync(privKeyPath) && fs.existsSync(pubKeyPath)) {
  privateKey = fs.readFileSync(privKeyPath, 'utf8');
  publicKey = fs.readFileSync(pubKeyPath, 'utf8');
} else {
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
  fs.writeFileSync(privKeyPath, privateKey, 'utf8');
  fs.writeFileSync(pubKeyPath, publicKey, 'utf8');
}

// The ultimate flagship flags
const SYSTEM_FLAG = "FLAG{cybercorp_multi_stage_flagship_rce}";
fs.writeFileSync(path.join(__dirname, 'flag.txt'), SYSTEM_FLAG, 'utf8');

// High-Fidelity Active Patch / Secure Mode toggle state
let securityMode = 'vulnerable';

// In-memory Database tables representation
const DB = {
  users: [
    { username: 'guest_researcher', role: 'guest', tenantId: 'tenant_b_827f83a0', balance: 50 },
    { username: 'executive_admin', role: 'admin', tenantId: 'tenant_a_19df94c2', balance: 99999 }
  ],
  documents: {
    'tenant_b_827f83a0': [
      { docId: 'doc_guest_902f831e', name: 'Guest Welcome Kit.pdf', content: 'Welcome to CyberCorp!' }
    ],
    'tenant_a_19df94c2': [
      { docId: 'doc_admin_f8c12a84', name: 'Executive Master Invoice.pdf', content: `ADMIN SECRET NOTEPAD:\nSSO Access verified. System flagship flag is located locally in '/app/flag.txt'.\nUse administrative profile capabilities to audit system parameters.` }
    ]
  },
  announcements: [
    { id: 1, title: "System Maintained", content: "All virtual nodes refreshed. System is operating normally." },
    { id: 2, title: "Audit Verification Complete", content: "Executive administrative audit logs registered under reference ID doc_admin_f8c12a84." }
  ],
  redeemedCoupons: new Set(),
  systemConfig: {
    theme: 'glassmorphism',
    maintenance: false,
    version: '2.4.1'
  }
};

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

// Insecure recursive merge function vulnerable to Prototype Pollution
function merge(target, source) {
  for (let key in source) {
    if (key === '__proto__' || key === 'constructor') {
      continue; // Basic key check, but can be bypassed using nesting or direct object pollution if not robust
    }
    if (typeof target[key] === 'object' && typeof source[key] === 'object') {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Deep merge allowing __proto__ bypass (to simulate real library flaws like lodash/extend merge)
function vulnerableMerge(target, source) {
  for (let key in source) {
    if (typeof target[key] === 'object' && typeof source[key] === 'object') {
      vulnerableMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// In-Memory Database SQL parser emulator supporting Blind SQLi & Union injection
function simulateSQLSearch(queryStr) {
  // Safe default: return standard products
  const products = [
    { id: 1, name: "Secure Firewall", price: "$150", category: "Hardware" },
    { id: 2, name: "Vulnerability Scanner Lite", price: "$300", category: "SaaS" },
    { id: 3, name: "Corporate Audit Log Ledger", price: "$450", category: "Audit" }
  ];

  if (!queryStr) return products;

  // Simple SQL parsing emulation
  const normalized = queryStr.trim();
  console.log(`[SQL EMULATOR] Executing: ${normalized}`);

  // Time-Blind SQL injection handling (e.g. sleep/delay triggering checks)
  if (normalized.toLowerCase().includes("sleep") || normalized.toLowerCase().includes("benchmark")) {
    const sleepMatch = normalized.match(/sleep\((\d+)\)/i);
    const delayTime = sleepMatch ? parseInt(sleepMatch[1]) * 1000 : 2000;
    
    // Blocking synchronous sleep execution to simulate SQL heavy database calculation
    const start = Date.now();
    while (Date.now() - start < delayTime) {}
  }

  // Boolean-Blind SQL injection handling (e.g. ' AND SUBSTR(...) = 'a')
  if (normalized.toLowerCase().includes("select") && normalized.toLowerCase().includes("users")) {
    // Brute forcing characters check
    if (normalized.toLowerCase().includes("substr")) {
      // Find the character we are testing
      const charMatch = normalized.match(/=\s*'([a-zA-Z0-9_\{\}\$]+)'/);
      const indexMatch = normalized.match(/substr\(\(?[^,]+,\s*(\d+),\s*1\)/i);
      
      if (charMatch && indexMatch) {
        const index = parseInt(indexMatch[1]) - 1;
        const char = charMatch[1];
        const secret = "tenant_a_19df94c2"; // Admin Tenant ID containing flag documents
        
        if (secret[index] === char) {
          // If the blind check succeeds, return all products (positive boolean feedback)
          return products;
        } else {
          // If failed, return empty (negative boolean feedback)
          return [];
        }
      }
    }
  }

  // Union-based SQL injection handling
  if (normalized.toLowerCase().includes("union") && normalized.toLowerCase().includes("select")) {
    return [
      { id: 99, name: "admin_user_credentials", price: "tenant_a_19df94c2", category: "LEAKED_DATABASE_KEYS" }
    ];
  }

  // Standard simple filter
  return products.filter(p => p.name.toLowerCase().includes(normalized.toLowerCase()));
}

// REST JWT SSO Auth Verification Middleware (Vulnerable to Key Confusion)
function verifyJWT(req, res, next) {
  let token = null;

  // 1. Check Authorization Header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }

  // 2. Check Cookie Header (auth_token)
  if (!token) {
    const cookieHeader = req.headers.cookie || req.headers.Cookie;
    if (cookieHeader && cookieHeader.includes('auth_token=')) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    // Generate automatic guest token if none provided
    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const payload = JSON.stringify({ username: "guest_researcher", role: "guest", tenantId: "tenant_b_827f83a0", iat: Math.floor(Date.now() / 1000) });
    const unsigned = `${base64urlEncode(header)}.${base64urlEncode(payload)}`;
    const signer = crypto.createSign('RSA-SHA256').update(unsigned);
    const signature = signer.sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    req.user = { username: "guest_researcher", role: "guest", tenantId: "tenant_b_827f83a0" };
    res.setHeader('Set-Cookie', `auth_token=${unsigned}.${signature}; Path=/`);
    return next();
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return res.status(400).json({ error: "Invalid JWT token structure." });
  }

  try {
    const header = JSON.parse(base64urlDecode(parts[0]));
    const payload = JSON.parse(base64urlDecode(parts[1]));
    const signature = parts[2];
    const unsigned = `${parts[0]}.${parts[1]}`;

    // Cryptographic Key Confusion check:
    if (header.alg === 'HS256') {
      if (securityMode === 'secure') {
        return res.status(401).json({ error: "JWT Signature verification failed. Symmetric HS256 algorithm is strictly rejected in Secure Mode (asymmetric RS256 enforced)." });
      }
      // Vulnerability: Verifies token signature using HMAC-SHA256, but uses asymmetric RSA Public Key as the symmetric HMAC key!
      const normalizedPublicKey = publicKey.toString().replace(/\r\n/g, '\n').trim();
      const expected = crypto.createHmac('sha256', normalizedPublicKey)
        .update(unsigned)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      console.log(`[JWT DEBUG] Alg: ${header.alg}, Unsigned: ${unsigned}`);
      console.log(`[JWT DEBUG] Received Signature: ${signature}`);
      console.log(`[JWT DEBUG] Expected Signature: ${expected}`);
      console.log(`[JWT DEBUG] Keys match: ${signature === expected}`);

      if (signature !== expected) {
        return res.status(401).json({ error: "JWT Signature verification failed (HMAC mismatch)." });
      }
    } else if (header.alg === 'RS256') {
      const verifier = crypto.createVerify('RSA-SHA256').update(unsigned);
      const verified = verifier.verify(publicKey, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      if (!verified) {
        if (req.method === 'GET' && req.path === '/') {
          res.clearCookie('auth_token');
          return res.redirect('/');
        }
        return res.status(401).json({ error: "JWT Signature verification failed (RSA mismatch)." });
      }
    } else {
      return res.status(400).json({ error: `Unsupported signature algorithm: ${header.alg}` });
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error("[JWT ERROR] Parsing failed:", err.message);
    return res.status(400).json({ error: `JWT Parsing Error: ${err.message}` });
  }
}

// Render dynamic homepage dashboard view using EJS
app.get('/', verifyJWT, (req, res) => {
  res.render('index', { user: req.user });
});

// Dynamic public key retriever route
app.get('/public-key.pem', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(publicKey);
});

// Dynamic announcements list
app.get('/api/announcements', (req, res) => {
  res.json({ announcements: DB.announcements });
});

// JWKS Endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  // Convert public key to simple JWKS format representation
  res.json({
    keys: [{
      kty: "RSA",
      use: "sig",
      alg: "RS256",
      n: "base64_encoded_modulus_string",
      e: "AQAB",
      pem: publicKey
    }]
  });
});

// Endpoint: Search catalog with SQL Emulator (Vulnerable to SQLi)
app.get('/api/catalog', (req, res) => {
  const { q } = req.query;
  const results = simulateSQLSearch(q);
  res.json({ success: true, results });
});

// Endpoint: Fetch dynamic profile balance details
app.get('/api/profile/balance', verifyJWT, (req, res) => {
  const userRecord = DB.users.find(u => u.username === req.user.username) || { balance: 50 };
  res.json({ balance: userRecord.balance });
});

// Endpoint: Coupon code verification (Vulnerable to Race Condition)
app.post('/api/apply-coupon', verifyJWT, async (req, res) => {
  const { coupon } = req.body;
  const username = req.user.username;

  if (coupon !== 'WELCOME50') {
    return res.status(400).json({ error: "Invalid promotional code." });
  }

  const trackingKey = `${username}_${coupon}`;

  // SECURE MODE: Atomic check-and-write operation bypasses the async timing window
  if (securityMode === 'secure') {
    if (DB.redeemedCoupons.has(trackingKey)) {
      return res.status(400).json({ error: "This coupon code has already been redeemed." });
    }
    DB.redeemedCoupons.add(trackingKey);
    const userRecord = DB.users.find(u => u.username === username);
    if (userRecord) {
      userRecord.balance += 50;
    }
    return res.json({ success: true, message: "Promotional credit added successfully!", balance: userRecord ? userRecord.balance : 0 });
  }

  // TOCTOU Race Condition: Check before async delay, then apply coupon
  if (DB.redeemedCoupons.has(trackingKey)) {
    return res.status(400).json({ error: "This coupon code has already been redeemed." });
  }

  // 100ms async timing window to allow parallel requests to both pass the check
  await new Promise(resolve => setTimeout(resolve, 100));

  // Add tracking key & increment balance
  DB.redeemedCoupons.add(trackingKey);
  const userRecord = DB.users.find(u => u.username === username);
  if (userRecord) {
    userRecord.balance += 50;
  }

  res.json({ success: true, message: "Promotional credit added successfully!", balance: userRecord ? userRecord.balance : 0 });
});

// Endpoint: Invoices download (Vulnerable to BOLA / IDOR)
app.get('/api/tenants/:tenantId/documents/:docId', verifyJWT, (req, res) => {
  const { tenantId, docId } = req.params;
  
  // SECURE MODE: Verify horizontal authorization bounds
  if (securityMode === 'secure') {
    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied. Cross-tenant authorization mismatch." });
    }
  }

  // Vulnerability logic flaw (BOLA): 
  // It checks if the document exists in the provided tenantId database key,
  // but fails to verify if req.user.tenantId matches the requested tenantId!
  const tenantDocs = DB.documents[tenantId];
  if (!tenantDocs) {
    return res.status(404).json({ error: "Tenant node not found." });
  }

  const document = tenantDocs.find(d => d.docId === docId);
  if (!document) {
    return res.status(404).json({ error: "Document identifier not found." });
  }

  res.json({
    success: true,
    document: {
      id: document.docId,
      name: document.name,
      content: document.content
    }
  });
});

// Endpoint: Update corporate configurations (Vulnerable to Prototype Pollution)
app.post('/api/settings', verifyJWT, (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: "Settings payload body is required." });
  }

  try {
    if (securityMode === 'secure') {
      // Safe merge: Blocks constructor and __proto__ properties
      merge(DB.systemConfig, config);
    } else {
      // Vulnerable merge: Recursively merges configuration properties allowing __proto__ pollution!
      vulnerableMerge(DB.systemConfig, config);
    }
    res.json({ success: true, message: "System settings synchronized successfully.", config: DB.systemConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Administrative view (Vulnerable to EJS dynamic template compilation execution RCE)
app.get('/admin/render', verifyJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send("Forbidden. Corporate Administrator authentication context required.");
  }

  // Dynamic template rendering. 
  // If Object.prototype has been polluted (e.g. Object.prototype.client === true and escapeFunction !== null)
  // then EJS compilation options will run arbitrary shell code!
  
  // Custom Prototype-Pollution RCE Evaluator (High fidelity education simulator)
  const renderOptions = {};
  if (renderOptions.client === true && renderOptions.escapeFunction) {
    console.log("[PROTOTYPE POLLUTION] Global prototype options contaminated! Triggering template RCE execution.");
    try {
      // Execute the polluted command string securely using child process
      exec(renderOptions.escapeFunction);
    } catch (e) {
      console.error("[PROTOTYPE POLLUTION] RCE execution error:", e.message);
    }
  }

  const templateStr = `
    <div style="font-family: sans-serif; padding: 20px; color: #fff;">
      <h2>Corporate Console Management Engine</h2>
      <p>Operational Status: Online</p>
      <p>Theme Applied: <%= theme %></p>
      <p>System Version: <%= version %></p>
    </div>
  `;

  try {
    const rendered = ejs.render(templateStr, {
      theme: DB.systemConfig.theme,
      version: DB.systemConfig.version
    });
    res.send(rendered);
  } catch (err) {
    res.status(500).send(`System Rendering Exception: ${err.message}`);
  }
});

// Direct token authentication bypass (Simulates standard JWT exchange for the solver)
app.post('/api/auth/token', (req, res) => {
  const { username, role, tenantId } = req.body;
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const payload = JSON.stringify({ username, role, tenantId, iat: Math.floor(Date.now() / 1000) });
  
  const unsigned = `${base64urlEncode(header)}.${base64urlEncode(payload)}`;
  const signer = crypto.createSign('RSA-SHA256').update(unsigned);
  const signature = signer.sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  res.json({ token: `${unsigned}.${signature}` });
});

// Endpoint: Get current security mode
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

// Endpoint: Toggle security mode
app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, message: `Security mode toggled to ${mode}.`, securityMode });
  } else {
    res.status(400).json({ error: "Invalid security mode. Choose 'secure' or 'vulnerable'." });
  }
});

// Reset endpoint to clear platform states
app.post('/api/reset', (req, res) => {
  DB.users = [
    { username: 'guest_researcher', role: 'guest', tenantId: 'tenant_b_827f83a0', balance: 50 },
    { username: 'executive_admin', role: 'admin', tenantId: 'tenant_a_19df94c2', balance: 99999 }
  ];
  DB.redeemedCoupons.clear();
  DB.systemConfig = {
    theme: 'glassmorphism',
    maintenance: false,
    version: '2.4.1'
  };
  
  // Clear any leaked flags in public folder
  const leakPath = path.join(__dirname, 'public', 'flag.txt');
  if (fs.existsSync(leakPath)) {
    fs.unlinkSync(leakPath);
  }

  // Clear polluted prototype properties to prevent server crash/pollution leak across sessions
  for (let key in Object.prototype) {
    delete Object.prototype[key];
  }

  res.json({ success: true, message: "Platform state successfully reset." });
});

app.listen(PORT, () => {
  console.log(`Unified flagship CyberCorp Portal listening on port ${PORT}`);
});
