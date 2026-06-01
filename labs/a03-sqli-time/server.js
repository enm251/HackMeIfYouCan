const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Database Seeding & Setup
// ---------------------------------------------------------------------------
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  // Setup tables
  db.run("CREATE TABLE users (username TEXT, password TEXT)");
  db.run("INSERT INTO users VALUES ('admin', 'FLAG{time_sqli_exfiltrated}')");

  db.run("CREATE TABLE visitors (tracking_id TEXT)");
  db.run("INSERT INTO visitors VALUES ('visitor_id_x99')");

  // Create delay helper table with 700 rows
  db.run("CREATE TABLE delay_helper (id INTEGER)");
  const stmt = db.prepare("INSERT INTO delay_helper VALUES (?)");
  for (let i = 0; i < 700; i++) {
    stmt.run(i);
  }
  stmt.finalize();

  // Stage 2 setup
  db.run("CREATE TABLE stage2_users (username TEXT, password TEXT)");
  db.run("INSERT INTO stage2_users VALUES ('admin', 'FLAG{sqli_time_waf_keyword_bypass}')");

  // Stage 3 setup
  db.run("CREATE TABLE stage3_data (key TEXT, value TEXT)");
  db.run("INSERT INTO stage3_data VALUES ('secret', 'FLAG{sqli_time_stacked_query_blind}')");

  // Stage 4 setup
  db.run("CREATE TABLE stage4_secrets (id INTEGER, secret TEXT)");
  db.run("INSERT INTO stage4_secrets VALUES (1, 'FLAG{sqli_time_quote_escape_bypass}')");
});

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
app.use(cookieParser());
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
// API Settings & Logs
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
    res.status(400).json({ error: "Invalid security mode." });
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
// SQL Injection Endpoints
// ---------------------------------------------------------------------------

// Stage 1 Root Route (TrackingId Cookie)
app.get('/', (req, res) => {
  // If no tracking cookie and no files requested, serve frontend
  const trackingId = req.cookies.TrackingId;
  
  if (!trackingId) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  if (securityMode === 'secure') {
    // SECURE: Parameterized Query
    db.all("SELECT tracking_id FROM visitors WHERE tracking_id = ?", [trackingId], (err, rows) => {
      res.send(`<html><body>welcomeBack = true</body></html>`);
    });
  } else {
    // VULNERABLE: Direct SQL Concatenation
    const sql = `SELECT tracking_id FROM visitors WHERE tracking_id = '${trackingId}'`;
    db.all(sql, (err, rows) => {
      res.send(`<html><body>welcomeBack = true</body></html>`);
    });
  }
});

// Stage 2: Keyword WAF Filter (SearchId Cookie)
app.get('/api/stage2', (req, res) => {
  const searchId = req.cookies.SearchId || '';

  if (securityMode === 'secure') {
    db.all("SELECT username FROM stage2_users WHERE username = ?", [searchId], (err, rows) => {
      res.json({ success: true });
    });
  } else {
    // Check WAF restrictions case-insensitively
    const blockedKeywords = ['sleep', 'benchmark', 'waitfor', 'delay'];
    const lowered = searchId.toLowerCase();
    for (const kw of blockedKeywords) {
      if (lowered.includes(kw)) {
        return res.status(403).json({ error: "Intrusion Prevention System Triggered: Dangerous SQL keyword detected." });
      }
    }

    // Vulnerable path (CROSS JOIN remains unblocked)
    const sql = `SELECT username FROM stage2_users WHERE username = '${searchId}'`;
    db.all(sql, (err, rows) => {
      res.json({ success: true });
    });
  }
});

// Stage 3: Stacked Queries (SessionTracker Cookie)
app.get('/api/stage3', (req, res) => {
  const sessionTracker = req.cookies.SessionTracker || '';

  if (securityMode === 'secure') {
    db.all("SELECT key FROM stage3_data WHERE key = ?", [sessionTracker], (err, rows) => {
      res.json({ status: "processed" });
    });
  } else {
    // SQLite3 node-sqlite3 driver does not support stacked queries natively (multiple queries separated by semicolon),
    // but we can simulate stacked queries or parse the input to execute it separately to emulate stacked SQL injection.
    if (sessionTracker.includes(';')) {
      const queries = sessionTracker.split(';');
      // Execute each query sequentially
      db.serialize(() => {
        queries.forEach(query => {
          if (query.trim()) {
            db.all(query, (err, rows) => {
              // Execute query
            });
          }
        });
      });
      res.json({ status: "processed" });
    } else {
      const sql = `SELECT key FROM stage3_data WHERE key = '${sessionTracker}'`;
      db.all(sql, (err, rows) => {
        res.json({ status: "processed" });
      });
    }
  }
});

// Stage 4: Quote Escape Bypass (VisitorId Cookie)
app.get('/api/stage4', (req, res) => {
  let visitorId = req.cookies.VisitorId || '';

  if (securityMode === 'secure') {
    db.all("SELECT id FROM stage4_secrets WHERE id = ?", [visitorId], (err, rows) => {
      res.json({ status: "active" });
    });
  } else {
    // WAF escapes single and double quotes
    const escapedVisitorId = visitorId.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    // Attack vector uses numeric context injection so quotes are unnecessary!
    // Example: visitorId = "1 AND (SELECT CASE WHEN (SUBSTR((SELECT secret FROM stage4_secrets WHERE id=1),1,1)=CHAR(70)) THEN (SELECT COUNT(*) FROM delay_helper t1 CROSS JOIN delay_helper t2 CROSS JOIN delay_helper t3) ELSE 0 END) = 0"
    const sql = `SELECT id FROM stage4_secrets WHERE id = ${escapedVisitorId}`;
    db.all(sql, (err, rows) => {
      res.json({ status: "active" });
    });
  }
});

app.listen(PORT, () => {
  console.log(`Time-Blind SQLi Lab listening on port ${PORT}`);
});
