const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let securityMode = 'vulnerable';

// Initialize In-Memory SQLite Database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error("Failed to connect to sqlite database:", err.message);
  } else {
    console.log("Connected to in-memory SQLite database.");
    seedDatabase();
  }
});

// Seed tables and data
function seedDatabase() {
  db.serialize(() => {
    // Create Products table
    db.run(`CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price TEXT
    )`);

    // Create Users table
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL
    )`);

    // Insert Products
    const products = [
      ["Cyber Shield V1", "Standard firewall security gateway appliance", "$299.00"],
      ["Quantum Crypto Token", "Hardware security key for MFA verification", "$49.99"],
      ["Secure Router Pro", "Encrypted wifi hub with local VPN tunneling", "$159.00"],
      ["Biometric Padlock", "Fingerprint lock with secondary passcode panel", "$79.95"]
    ];
    const stmtProd = db.prepare("INSERT INTO products (name, description, price) VALUES (?, ?, ?)");
    products.forEach(p => stmtProd.run(p));
    stmtProd.finalize();

    // Insert Users (containing the FLAGS for stages)
    db.run("INSERT INTO users (username, password) VALUES ('admin', 'FLAG{sqli_union_data_extracted}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage2_admin', 'FLAG{sqli_union_waf_bypass_successful}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage3_admin', 'FLAG{sqli_union_hex_encoding_bypass}')");
    db.run("INSERT INTO users (username, password) VALUES ('stage4_admin', 'FLAG{sqli_union_recursive_bypass_expert}')");
    
    console.log("Database seeded successfully.");
  });
}

// Security mode settings API
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

// Stage 1: Vulnerable Search Endpoint
app.get('/api/search', (req, res) => {
  const { q } = req.query;

  if (!q) {
    return db.all("SELECT name, description, price FROM products", (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }

  if (securityMode === 'secure') {
    const sql = "SELECT name, description, price FROM products WHERE name LIKE ? OR description LIKE ?";
    const term = `%${q}%`;
    db.all(sql, [term, term], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  } else {
    const sql = `SELECT name, description, price FROM products WHERE name LIKE '%${q}%' OR description LIKE '%${q}%'`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  }
});

// Stage 2: Character Filter (No Spaces Allowed)
app.get('/api/stage2/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  if (securityMode === 'secure') {
    const sql = "SELECT name, description, price FROM products WHERE name LIKE ? OR description LIKE ?";
    const term = `%${q}%`;
    db.all(sql, [term, term], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  } else {
    if (q.includes(' ')) {
      return res.status(403).json({ 
        error: "WAF BLOCK: Space characters are strictly prohibited in search query inputs",
        sql: `SELECT name, description, price FROM products WHERE name LIKE '%${q}%' OR description LIKE '%${q}%'`
      });
    }
    const sql = `SELECT name, description, price FROM products WHERE name LIKE '%${q}%' OR description LIKE '%${q}%'`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  }
});

// Stage 3: Numeric Column Injection (Quotes Blocked)
app.get('/api/stage3/products', (req, res) => {
  const { category_id } = req.query;
  if (!category_id) return res.json([]);

  if (securityMode === 'secure') {
    const sql = "SELECT name, description, price FROM products WHERE id = ?";
    db.all(sql, [parseInt(category_id) || 0], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  } else {
    if (category_id.includes("'") || category_id.includes('"')) {
      return res.status(403).json({ 
        error: "WAF BLOCK: Direct string boundaries (single/double quotes) are prohibited in numeric category inputs",
        sql: `SELECT name, description, price FROM products WHERE id = ${category_id}`
      });
    }
    const sql = `SELECT name, description, price FROM products WHERE id = ${category_id}`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  }
});

// Stage 4: Non-recursive Filter Bypass
app.get('/api/stage4/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  if (securityMode === 'secure') {
    const sql = "SELECT name, description, price FROM products WHERE name LIKE ?";
    const term = `%${q}%`;
    db.all(sql, [term], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  } else {
    // Non-recursively strip UNION and SELECT
    let cleaned = q.replace(/UNION/gi, '').replace(/SELECT/gi, '');
    const sql = `SELECT name, description, price FROM products WHERE name LIKE '%${cleaned}%'`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message, sql });
      res.json(rows);
    });
  }
});

app.listen(PORT, () => {
  console.log(`Union-SQLi Lab running on port ${PORT}`);
});
