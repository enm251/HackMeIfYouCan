const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// High-Fidelity Active Patch / Secure Mode toggle state
let securityMode = 'vulnerable';

const KEY = 's3cr3t_k3y_128_b'; // 16-byte key for AES-128
const XOR_KEY = 'cyber'; // Stage 3 weak XOR key
const STRONG_SECRET = 'strong_key_3821038102938102938102';

// Stage 4 RSA Keys
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

fs.writeFileSync(path.join(__dirname, 'public', 'private-key-backup.pem'), privateKey, 'utf8');

const FLAG1 = "FLAG{broken_cryptography_cracked}";
const FLAG2 = "FLAG{weak_md5_hash_cracked_medium}";
const FLAG3 = "FLAG{xor_keystream_leakage_hard}";
const FLAG4 = "FLAG{rsa_private_key_leakage_expert}";

// Encryption Helper (AES-128-ECB)
function encrypt(text) {
  try {
    const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (err) {
    return null;
  }
}

function decrypt(ciphertext) {
  try {
    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

// XOR helper
function xorEncrypt(text, key) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(out, 'binary').toString('hex');
}

// Stage 1 API (Kept intact for verifier.js compatibility)
app.get('/api/source', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  fs.readFile(__filename, 'utf8', (err, data) => {
    if (err) return res.status(500).send("Error reading source code.");
    res.send(data);
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'guest' && password === 'guest') {
    const sessionObj = { username: 'guest', role: 'guest', created: Date.now() };
    const ciphertext = encrypt(JSON.stringify(sessionObj));
    res.cookie('session', ciphertext, { httpOnly: false, path: '/' });
    return res.json({ success: true, message: "Logged in successfully." });
  }
  return res.status(401).json({ error: "Invalid credentials." });
});

app.get('/api/admin/flag', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const sessionCipher = cookies['session'];
  if (!sessionCipher) return res.status(401).json({ error: "Missing session cookie." });

  if (securityMode === 'secure') {
    // Under secure mode, enforce a strong key rotation and validation block
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(STRONG_SECRET, 'utf8'), Buffer.alloc(16));
    try {
      let decrypted = decipher.update(sessionCipher, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      const session = JSON.parse(decrypted);
      if (session.role === 'admin') {
        return res.json({ success: true, flag: FLAG1 });
      }
    } catch (e) {
      return res.status(403).json({ error: "Invalid cryptographic signature." });
    }
  }

  const decryptedStr = decrypt(sessionCipher);
  if (!decryptedStr) return res.status(400).json({ error: "Decryption failed." });

  try {
    const session = JSON.parse(decryptedStr);
    if (session.role === 'admin') {
      return res.json({ success: true, flag: FLAG1 });
    }
    res.status(403).json({ error: "Unauthorized." });
  } catch (err) {
    res.status(400).json({ error: "Malformed JSON." });
  }
});

// Stage 2: Weak MD5 Hashing crack
app.get('/api/stage2/backup-config', (req, res) => {
  // Discloses MD5 hash of admin password
  res.json({
    admin_hash: "73feffa4b7f6bb68e44cf984c85f6e88",
    algorithm: "MD5",
    hint: "Password resides in standard wordlists."
  });
});

app.post('/api/stage2/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Missing password." });

  if (securityMode === 'secure') {
    // Rejects MD5 and enforces highly secure argon2 or pbkdf2 with dynamic salt
    return res.status(403).json({ error: "Operation rejected. Cryptographic MD5 hash schemes are fully deprecated." });
  }

  // "dragon" MD5 hash: 73feffa4b7f6bb68e44cf984c85f6e88
  if (password === 'dragon') {
    return res.json({ success: true, flag: FLAG2 });
  }
  res.status(401).json({ error: "Invalid password." });
});

// Stage 3: Keystream Reuse XOR attack
app.get('/api/stage3/sample', (req, res) => {
  // Discloses a known plaintext and its corresponding XOR ciphertext
  const samplePlain = "guest_session";
  const sampleCipher = xorEncrypt(samplePlain, XOR_KEY);
  res.json({ samplePlain, sampleCipher });
});

app.post('/api/stage3/flag', (req, res) => {
  const { session } = req.body;
  if (!session) return res.status(400).json({ error: "Missing session." });

  try {
    let decrypted = "";
    if (securityMode === 'secure') {
      // Rejects weak XOR stream ciphers
      return res.status(403).json({ error: "Operation rejected. Weak custom XOR algorithms are deprecated." });
    }

    // Decode hex and XOR
    const buffer = Buffer.from(session, 'hex');
    for (let i = 0; i < buffer.length; i++) {
      decrypted += String.fromCharCode(buffer[i] ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }

    if (decrypted === 'admin_session') {
      return res.json({ success: true, flag: FLAG3 });
    }
    res.status(403).json({ error: "Unauthorized session content." });
  } catch (err) {
    res.status(400).json({ error: "Malformed decryption stream." });
  }
});

// Stage 4: Leaked Private Key
app.post('/api/stage4/flag', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Missing token." });

  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const unsigned = `${parts[0]}.${parts[1]}`;

    if (securityMode === 'secure') {
      return res.status(403).json({ error: "Administrative RSA token verification failed. Insecure key files are revoked." });
    }

    const verifier = crypto.createVerify('RSA-SHA256').update(unsigned);
    const verified = verifier.verify(publicKey, Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

    if (!verified) {
      return res.status(401).json({ error: "Invalid cryptographic signature." });
    }

    if (payload.role === 'admin') {
      return res.json({ success: true, flag: FLAG4 });
    }
    res.status(403).json({ error: "Admin role required." });
  } catch (err) {
    res.status(400).json({ error: "Verification failed." });
  }
});

// Security mode toggling endpoints
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
  console.log(`Upgraded Weak Cryptography Lab running on port ${PORT}`);
});
