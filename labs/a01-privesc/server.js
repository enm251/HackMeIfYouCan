const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// High-Fidelity Active Patch / Secure Mode toggle state
let securityMode = 'vulnerable';

// Static flags setup
const FLAG1 = "FLAG{jwt_privilege_escalation_admin}";
const FLAG2 = "FLAG{jwt_none_algorithm_bypass_medium}";
const FLAG3 = "FLAG{jwt_weak_hmac_secret_cracked_hard}";
const FLAG4 = "FLAG{jwt_jwk_parameter_injection_expert}";

// Helpers to encode/decode base64url
function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function base64urlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Stage 1 API (Kept intact for verifier.js compatibility)
app.get('/api/admin/flag', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const token = cookies['auth_token'];
  if (!token) return res.status(401).json({ error: "Access denied. Auth token not found." });

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(400).json({ error: "Invalid token format." });

    const payload = JSON.parse(base64urlDecode(parts[1]));

    if (securityMode === 'secure') {
      // In secure mode, strictly enforce HMAC-SHA256 signature verification with a strong secret
      const unsigned = `${parts[0]}.${parts[1]}`;
      const expectedSignature = crypto.createHmac('sha256', 'a_strong_production_secret_key_982183')
        .update(unsigned)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

      if (parts[2] !== expectedSignature) {
        return res.status(401).json({ error: "Access denied. Invalid cryptographic signature." });
      }
    }

    if (payload.role === 'admin') {
      return res.json({ success: true, flag: FLAG1, message: "Welcome to the administrator panel!" });
    } else {
      return res.status(403).json({ error: `Access Denied: Role '${payload.role}' is unauthorized.` });
    }
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse token." });
  }
});

// Stage 2: None Algorithm Signature Bypass
app.get('/api/stage2/flag', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!token) return res.status(401).json({ error: "Missing token." });

  try {
    const parts = token.split('.');
    const header = JSON.parse(base64urlDecode(parts[0]));
    const payload = JSON.parse(base64urlDecode(parts[1]));

    if (securityMode === 'secure') {
      // Secure mode: Strictly reject none algorithm in signature validations
      if (header.alg === 'none' || header.alg === 'NONE') {
        return res.status(400).json({ error: "Algorithm 'none' is strictly prohibited." });
      }
    }

    // Vulnerable check: accepts 'none' algorithm
    if (header.alg === 'none' || header.alg === 'NONE') {
      if (payload.role === 'admin') {
        return res.json({ success: true, flag: FLAG2 });
      }
      return res.status(403).json({ error: "Admin role required." });
    }

    // If not none, try validating signature (simulated secret)
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', 'secret_key_stage_2')
      .update(unsigned)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (parts[2] !== expected) {
      return res.status(401).json({ error: "Invalid signature." });
    }

    if (payload.role === 'admin') {
      return res.json({ success: true, flag: FLAG2 });
    }
    res.status(403).json({ error: "Admin role required." });
  } catch (err) {
    res.status(400).json({ error: "Parsing failed." });
  }
});

// Stage 3: Weak HMAC Secret Brute Force
app.get('/api/stage3/flag', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!token) return res.status(401).json({ error: "Missing token." });

  try {
    const parts = token.split('.');
    const payload = JSON.parse(base64urlDecode(parts[1]));
    const unsigned = `${parts[0]}.${parts[1]}`;

    const secretKey = securityMode === 'secure' ? 'high_entropy_strong_unbreakable_secret_2026' : 'supersecret';

    const expected = crypto.createHmac('sha256', secretKey)
      .update(unsigned)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (parts[2] !== expected) {
      return res.status(401).json({ error: "Invalid signature." });
    }

    if (payload.role === 'admin') {
      return res.json({ success: true, flag: FLAG3 });
    }
    res.status(403).json({ error: "Admin role required." });
  } catch (e) {
    res.status(400).json({ error: "Parsing error." });
  }
});

// Stage 4: JWK Parameter Injection (Spoofing)
app.get('/api/stage4/flag', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!token) return res.status(401).json({ error: "Missing token." });

  try {
    const parts = token.split('.');
    const header = JSON.parse(base64urlDecode(parts[0]));
    const payload = JSON.parse(base64urlDecode(parts[1]));
    const signature = parts[2];
    const unsigned = `${parts[0]}.${parts[1]}`;

    if (securityMode === 'secure') {
      // In secure mode, strictly verify keys against a local trusted JWKS catalog (no dynamic parameter keys)
      return res.status(403).json({ error: "JWK parameter injection blocked. Public keys must reside in authorized storage." });
    }

    // Vulnerability: Verifies token signature using the dynamic public key embedded in the header 'jwk' attribute!
    if (!header.jwk) {
      return res.status(400).json({ error: "Missing required 'jwk' header parameter for key validation." });
    }

    // Convert JWK structure directly into a Node PublicKey
    const publicKey = crypto.createPublicKey({
      key: header.jwk,
      format: 'jwk'
    });

    // Verify cryptographic signature against the embedded public key
    const verifier = crypto.createVerify('RSA-SHA256').update(unsigned);
    const verified = verifier.verify(publicKey, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

    if (!verified) {
      return res.status(401).json({ error: "Invalid signature. Public key verification failed." });
    }

    if (payload.role === 'admin') {
      return res.json({ success: true, flag: FLAG4 });
    }
    res.status(403).json({ error: "Admin role required." });
  } catch (err) {
    res.status(400).json({ error: `Verification Exception: ${err.message}` });
  }
});

// Settings & login handlers
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'guest' && password === 'guest') {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { username: "guest", role: "guest", exp: Math.floor(Date.now() / 1000) + 3600 };
    
    const unsigned = `${base64urlEncode(JSON.stringify(header))}.${base64urlEncode(JSON.stringify(payload))}`;
    
    // Signed with weak secret key by default
    const signature = crypto.createHmac('sha256', 'supersecret')
      .update(unsigned)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const token = `${unsigned}.${signature}`;
    res.cookie('auth_token', token, { path: '/' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: "Invalid username or password." });
});

app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, message: `Security mode toggled to ${mode}.`, securityMode });
  } else {
    res.status(400).json({ error: "Invalid security mode." });
  }
});

app.listen(PORT, () => {
  console.log(`Upgraded Privilege Escalation Lab running on port ${PORT}`);
});
