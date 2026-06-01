const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

app.use(express.json());

let securityMode = 'vulnerable';

// Initialize database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error("DB connection error:", err.message);
  } else {
    seedDatabase();
  }
});

function seedDatabase() {
  db.serialize(() => {
    db.run("CREATE TABLE visitors (tracking_id TEXT PRIMARY KEY)");
    db.run("CREATE TABLE users (username TEXT PRIMARY KEY, password TEXT)");
    
    // Seed data
    db.run("INSERT INTO visitors (tracking_id) VALUES ('visitor_id_x99')");
    db.run("INSERT INTO users (username, password) VALUES ('admin', 'FLAG{blind_sqli_exfiltrated}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage2_admin', 'FLAG{blind_sqli_time_exfiltration_success}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage3_admin', 'FLAG{blind_sqli_error_based_exfiltration}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage4_admin', 'FLAG{blind_sqli_operator_bypass_expert}')");
    
    console.log("Blind SQLi DB seeded.");
  });
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

// Helper: sleep
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Serve static directory except for root file, which we render dynamically to inject welcome status
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Helper to parse cookies manually
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts[0]) {
      try {
        cookies[parts[0].trim()] = decodeURIComponent((parts[1] || '').trim());
      } catch (e) {
        cookies[parts[0].trim()] = (parts[1] || '').trim();
      }
    }
  });
  return cookies;
}

// Stage 1 Root Route (with dynamic status injection)
app.get('/', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  let trackingId = cookies['TrackingId'];
  
  if (!trackingId) {
    trackingId = 'visitor_id_x99';
    res.cookie('TrackingId', trackingId, { path: '/' });
  }

  if (securityMode === 'secure') {
    const sql = "SELECT tracking_id FROM visitors WHERE tracking_id = ?";
    db.get(sql, [trackingId], (err, row) => {
      let welcomeBack = !err && !!row;
      sendHtmlResponse(res, welcomeBack);
    });
  } else {
    // VULNERABLE: Direct concatenation
    const sql = `SELECT tracking_id FROM visitors WHERE tracking_id = '${trackingId}'`;
    db.get(sql, (err, row) => {
      let welcomeBack = !err && !!row;
      sendHtmlResponse(res, welcomeBack);
    });
  }
});

function sendHtmlResponse(res, welcomeBack) {
  fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (readErr, html) => {
    if (readErr) {
      return res.status(500).send("Error reading page template.");
    }
    const modifiedHtml = html.replace(
      '/*STATUS_PLACEHOLDER*/',
      `const welcomeBack = ${welcomeBack};`
    );
    res.send(modifiedHtml);
  });
}

// Stage 2: Time-Based SQL Injection
app.get('/api/stage2/check', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const trackingId = cookies['TrackingId'] || '';

  if (securityMode === 'secure') {
    const sql = "SELECT tracking_id FROM visitors WHERE tracking_id = ?";
    db.get(sql, [trackingId], (err, row) => {
      res.json({ status: "processed", exists: !err && !!row });
    });
  } else {
    // VULNERABLE: Detect if query contains sleep or heavy payload triggers
    // SQLite heavy math simulation or dynamic JS sleep to prevent hanging the SQLite process
    const isSleepTrigger = trackingId.toLowerCase().includes('randomblob') || 
                           trackingId.toLowerCase().includes('zeroblob') ||
                           trackingId.toLowerCase().includes('like');

    if (isSleepTrigger) {
      // Simulate database execution latency of 2000ms
      await sleep(2000);
    }

    const sql = `SELECT tracking_id FROM visitors WHERE tracking_id = '${trackingId}'`;
    db.get(sql, (err, row) => {
      res.json({ status: "processed", exists: !err && !!row });
    });
  }
});

// Stage 3: Error-Based SQL Injection
app.get('/api/stage3/check', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const trackingId = cookies['TrackingId'] || '';

  if (securityMode === 'secure') {
    const sql = "SELECT tracking_id FROM visitors WHERE tracking_id = ?";
    db.get(sql, [trackingId], (err, row) => {
      if (err) return res.status(500).json({ error: "Secure Database Error" });
      res.json({ exists: !!row });
    });
  } else {
    const sql = `SELECT tracking_id FROM visitors WHERE tracking_id = '${trackingId}'`;
    db.get(sql, (err, row) => {
      if (err) {
        // Return raw SQL engine error so the attacker can extract data from error states
        return res.status(500).json({ error: err.message });
      }
      res.json({ exists: !!row });
    });
  }
});

// Stage 4: WAF Filter Bypass (Strips AND / OR, Quotes Allowed but filtered)
app.get('/api/stage4/check', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const trackingId = cookies['TrackingId'] || '';

  if (securityMode === 'secure') {
    const sql = "SELECT tracking_id FROM visitors WHERE tracking_id = ?";
    db.get(sql, [trackingId], (err, row) => {
      res.json({ exists: !err && !!row });
    });
  } else {
    // WAF filter: strip out 'AND' and 'OR' case insensitively
    let cleaned = trackingId.replace(/AND/gi, '').replace(/OR/gi, '');
    const sql = `SELECT tracking_id FROM visitors WHERE tracking_id = '${cleaned}'`;
    db.get(sql, (err, row) => {
      res.json({ exists: !err && !!row });
    });
  }
});

app.listen(PORT, () => {
  console.log(`Blind-SQLi Lab running on port ${PORT}`);
});
