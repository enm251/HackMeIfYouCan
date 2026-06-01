const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let securityMode = 'vulnerable';

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

// Helper: merge for Stage 4 Prototype Pollution
function merge(target, source) {
  for (let key in source) {
    if (securityMode === 'secure') {
      // SECURE: Prevent prototype pollution by checking for sensitive keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
    }
    if (target[key] && typeof target[key] === 'object' && source[key] && typeof source[key] === 'object') {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Stage 4 Configuration Endpoint
app.post('/api/stage4/config', (req, res) => {
  const config = req.body.config || {};
  const baseConfig = {};
  merge(baseConfig, config);
  res.json({ success: true, message: "Configuration settings compiled successfully." });
});

// Root / Stage 1 route
app.get('/', (req, res) => {
  // If no query parameters, serve our dynamic progressive UI dashboard
  if (Object.keys(req.query).length === 0) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Otherwise, render EJS template (Stage 1 / CVE-2022-29078)
  if (securityMode === 'secure') {
    // SECURE: Create safe options block, strip prototype and settings keys
    const safeQuery = {};
    for (const key of Object.keys(req.query)) {
      if (key !== 'settings' && key !== '__proto__' && key !== 'constructor') {
        safeQuery[key] = req.query[key];
      }
    }
    return res.render('index', {
      title: "AeroSpace Diagnostic Systems",
      status: "SYSTEMS ONLINE",
      operator: safeQuery.operator || "Guest Operator",
      ...safeQuery
    });
  }

  // VULNERABLE: Direct merge of query parameters
  res.render('index', {
    title: "AeroSpace Diagnostic Systems",
    status: "SYSTEMS ONLINE",
    operator: req.query.operator || "Guest Operator",
    ...req.query
  });
});

// Stage 2: escapeFunction is blocked case-insensitively
app.get('/api/stage2/render', (req, res) => {
  const queryStr = JSON.stringify(req.query).toLowerCase();

  if (securityMode === 'secure') {
    return res.render('index', { title: "Secure System Dashboard", status: "SECURE", operator: "Operator" });
  }

  if (queryStr.includes('escapefunction')) {
    return res.status(403).json({ error: "WAF BLOCK: The EJS compiler option 'escapeFunction' is blacklisted." });
  }

  res.render('index', {
    title: "AeroSpace Diagnostics Stage 2",
    status: "STAGE 2 MONITOR ACTIVE",
    operator: req.query.operator || "Operator",
    ...req.query
  });
});

// Stage 3: Blind options render (No output returned to client)
app.get('/api/stage3/render', (req, res) => {
  const queryStr = JSON.stringify(req.query).toLowerCase();

  if (securityMode === 'secure') {
    return res.json({ success: true, message: "Request rendered safely." });
  }

  if (queryStr.includes('escapefunction') || queryStr.includes('outputfunctionname')) {
    return res.status(403).json({ error: "WAF BLOCK: Restricted EJS compiler options blacklisted." });
  }

  // Render but do not send html back to client
  res.render('index', {
    title: "AeroSpace Diagnostics Stage 3",
    status: "STAGE 3 LOG ACTIVE",
    operator: req.query.operator || "Operator",
    ...req.query
  }, (err, html) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: "Diagnostics compiled and logged to system buffer." });
  });
});

// Stage 4: Trigger render under potentially polluted prototype
app.get('/api/stage4/render', (req, res) => {
  // Empty query parameter merge, relies completely on global Object prototype contamination!
  res.render('index', {
    title: "AeroSpace Diagnostics Hardened Console",
    status: "STAGE 4 SECURE COMPILE",
    operator: "Administrator"
  });
});

// Serve public directory static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Outdated Components Lab running on port ${PORT}`);
});
