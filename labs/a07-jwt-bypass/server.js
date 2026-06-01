const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

// Configurable security mode ('vulnerable' or 'secure')
let securityMode = 'vulnerable';

// HS256 secret keys
const STAGE1_SECRET = 's3cr3t_s1gn1ng_k3y_99';
const STAGE3_WEAK_SECRET = 'secret123';
const STAGE3_SECURE_SECRET = crypto.randomBytes(32).toString('hex');

// In-memory HTTP transaction logs for the terminal widget
let logs = [];
function addLog(method, url, headers, body, responseStatus, responseBody) {
  logs.push({
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString(),
    method,
    url,
    headers: { ...headers },
    body: typeof body === 'object' ? JSON.stringify(body) : String(body || ''),
    responseStatus,
    responseBody: typeof responseBody === 'object' ? JSON.stringify(responseBody) : String(responseBody || '')
  });
  if (logs.length > 50) logs.shift();
}

app.use(express.json());

// Log interceptor middleware
app.use((req, res, next) => {
  // Capture response
  const oldSend = res.send;
  res.send = function (data) {
    res.send = oldSend;
    let parsedBody = '';
    try {
      parsedBody = JSON.parse(data);
    } catch (e) {
      parsedBody = data;
    }
    // Don't log system settings requests to keep console clean
    if (!req.url.startsWith('/api/settings') && !req.url.startsWith('/api/logs')) {
      addLog(req.method, req.url, req.headers, req.body, res.statusCode, parsedBody);
    }
    return res.send(data);
  };
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple helpers to decode/encode base64url
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

// Generate HS256 Signature
function generateSignature(header, payload, secret) {
  const data = `${header}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Security Mode API
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, securityMode });
  } else {
    res.status(400).json({ error: "Invalid mode" });
  }
});

// Logs API
app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/logs/clear', (req, res) => {
  logs = [];
  res.json({ success: true });
});

// API: Login for guest
app.post('/api/login', (req, res) => {
  const { username, password, stage } = req.body;
  
  if (username === 'guest' && password === 'guest') {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { username: "guest", role: "guest", exp: Math.floor(Date.now() / 1000) + 3600 };
    
    // Choose appropriate signing secret based on stage
    let secret = STAGE1_SECRET;
    if (stage === 3) {
      secret = securityMode === 'secure' ? STAGE3_SECURE_SECRET : STAGE3_WEAK_SECRET;
    }
    
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const signature = generateSignature(encodedHeader, encodedPayload, secret);
    
    const token = `${encodedHeader}.${encodedPayload}.${signature}`;
    res.cookie('auth_token', token, { path: '/' });
    return res.json({ success: true, token, message: "Login successful as guest" });
  }

  res.status(401).json({ error: "Invalid username or password." });
});

// Verification Endpoint for all stages
app.get('/api/admin/flag', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts[0]) cookies[parts[0].trim()] = (parts[1] || '').trim();
  });

  // Check auth_token cookie or Authorization header
  let token = cookies['auth_token'];
  if (!token && req.headers.authorization) {
    const authParts = req.headers.authorization.split(' ');
    if (authParts[1]) token = authParts[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Access Denied: auth_token cookie or Authorization header not found." });
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return res.status(400).json({ error: "Malformed token structure." });
  }

  try {
    const headerStr = base64urlDecode(parts[0]);
    const payloadStr = base64urlDecode(parts[1]);
    
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);

    const originalAlg = header.alg || '';
    const algorithm = originalAlg.toLowerCase();

    // Stage query param can be passed to differentiate difficulty levels
    const stageQuery = parseInt(req.query.stage || '1', 10);

    // SECURE MODE: Strict defenses across all stages
    if (securityMode === 'secure') {
      if (algorithm === 'none') {
        return res.status(401).json({ error: "Security Policy: Algorithm 'none' is strictly prohibited." });
      }
      
      // Enforce HS256 signature verification with robust key
      if (algorithm === 'hs256') {
        const secret = stageQuery === 3 ? STAGE3_SECURE_SECRET : STAGE1_SECRET;
        const expectedSig = generateSignature(parts[0], parts[1], secret);
        const actualSig = parts[2] || '';
        if (crypto.timingSafeEqual(Buffer.from(actualSig), Buffer.from(expectedSig))) {
          if (payload.role === 'admin') {
            return res.json({
              success: true,
              flag: `FLAG{jwt_remediation_shield_active}`,
              message: "Secure Access granted."
            });
          }
        }
        return res.status(401).json({ error: "Access Denied: Invalid signature." });
      }

      // Stage 4 Secure RS256 JWK check: Do not trust JWK in the header directly
      if (algorithm === 'rs256') {
        return res.status(401).json({ error: "Security Policy: Direct JWK injection in headers is disabled." });
      }

      return res.status(400).json({ error: "Unsupported algorithm." });
    }

    // VULNERABLE MODE: Progression of difficulty stages
    if (stageQuery === 1) {
      // Stage 1: Standard none algorithm bypass (header.payload. with empty sig)
      if (algorithm === 'none') {
        if (payload.role === 'admin' || payload.username === 'admin') {
          return res.json({
            success: true,
            flag: "FLAG{jwt_none_signature_bypass}",
            message: "Access granted! Administrative session validated via None Alg."
          });
        }
        return res.status(403).json({ error: `Access Denied: Role '${payload.role}' unauthorized.` });
      } else if (algorithm === 'hs256') {
        const expectedSig = generateSignature(parts[0], parts[1], STAGE1_SECRET);
        const actualSig = parts[2] || '';
        if (actualSig !== expectedSig) {
          return res.status(401).json({ error: "Access Denied: Invalid signature." });
        }
        if (payload.role === 'admin') {
          return res.json({
            success: true,
            flag: "FLAG{jwt_none_signature_bypass}",
            message: "Access granted."
          });
        }
        return res.status(403).json({ error: `Access Denied: Role '${payload.role}' unauthorized.` });
      }
    } else if (stageQuery === 2) {
      // Stage 2: Case-insensitive / mixed-case `NoNe` bypass
      // The server blocks lowercase "none" strictly, but fails to check mixed-case "nOnE".
      if (originalAlg === 'none') {
        return res.status(403).json({ error: "WAF BLOCK: Alg 'none' is blacklisted." });
      }
      if (algorithm === 'none') {
        if (payload.role === 'admin' || payload.username === 'admin') {
          return res.json({
            success: true,
            flag: "FLAG{jwt_mixed_case_none_bypass}",
            message: "Access granted! Mixed-case None validation bypass successful."
          });
        }
      }
    } else if (stageQuery === 3) {
      // Stage 3: Weak HS256 key brute force ('secret123')
      if (algorithm === 'none') {
        return res.status(403).json({ error: "WAF BLOCK: Alg 'none' is blacklisted." });
      }
      if (algorithm === 'hs256') {
        const expectedSig = generateSignature(parts[0], parts[1], STAGE3_WEAK_SECRET);
        const actualSig = parts[2] || '';
        if (actualSig === expectedSig) {
          if (payload.role === 'admin' || payload.username === 'admin') {
            return res.json({
              success: true,
              flag: "FLAG{jwt_weak_key_brute_force}",
              message: "Access granted! Weak secret key cracked successfully."
            });
          }
        } else {
          return res.status(401).json({ error: "Access Denied: Cryptographic token signature is invalid." });
        }
      }
    } else if (stageQuery === 4) {
      // Stage 4: JWK Injection (RS256)
      // The server accepts RS256 and verifies the signature using the JWK supplied directly in the header!
      if (algorithm === 'none') {
        return res.status(403).json({ error: "WAF BLOCK: Alg 'none' is blacklisted." });
      }
      if (algorithm === 'rs256') {
        if (!header.jwk) {
          return res.status(400).json({ error: "Header parameter 'jwk' missing for RS256 algorithm." });
        }
        
        try {
          const publicKey = crypto.createPublicKey({
            key: header.jwk,
            format: 'jwk'
          });
          
          const verifier = crypto.createVerify('SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const isVerified = verifier.verify(publicKey, Buffer.from(parts[2], 'base64'));

          if (isVerified) {
            if (payload.role === 'admin' || payload.username === 'admin') {
              return res.json({
                success: true,
                flag: "FLAG{jwt_dynamic_jwk_injection_rs256}",
                message: "Access granted! Embedded JWK cryptographic signature validated."
              });
            }
          } else {
            return res.status(401).json({ error: "Access Denied: Cryptographic RS256 signature mismatch." });
          }
        } catch (jwkErr) {
          return res.status(400).json({ error: "Failed to verify signature with provided JWK: " + jwkErr.message });
        }
      }
    }

    return res.status(400).json({ error: "Unsupported algorithm or parameters for this difficulty stage." });

  } catch (err) {
    return res.status(400).json({ error: "Error parsing token: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`JWT Signature Bypass Lab running on port ${PORT}`);
});
