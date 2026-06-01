const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// High-Fidelity Active Patch / Secure Mode toggle state
let securityMode = 'vulnerable';

// Static flags setup
const FLAG1 = "FLAG{local_file_inclusion_secret}";
const FLAG2 = "FLAG{path_traversal_stripped_sequences_medium}";
const FLAG3 = "FLAG{path_traversal_null_byte_bypass_hard}";
const FLAG4 = "FLAG{path_traversal_directory_lock_bypass_expert}";

fs.writeFileSync(path.join(__dirname, 'flag.txt'), FLAG1, 'utf8');
fs.writeFileSync(path.join(__dirname, 'flag2.txt'), FLAG2, 'utf8');
fs.writeFileSync(path.join(__dirname, 'flag3.txt'), FLAG3, 'utf8');
fs.writeFileSync(path.join(__dirname, 'flag4.txt'), FLAG4, 'utf8');

// Stage 1 API (Kept intact for verifier.js compatibility)
app.get('/api/view', (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: "Missing parameter 'file'." });

  if (securityMode === 'secure') {
    // Strictly prevent directory traversal
    if (file.includes('..')) {
      return res.status(403).json({ error: "Access denied. Directory traversal attempted." });
    }
  }

  const targetPath = path.join(__dirname, 'public', file);

  fs.readFile(targetPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: "File not found or access denied." });
    }
    res.send(data);
  });
});

// Stage 2: Traversal sequences stripped non-recursively
app.get('/api/stage2/view', (req, res) => {
  let { file } = req.query;
  if (!file) return res.status(400).json({ error: "Missing parameter 'file'." });

  if (securityMode === 'secure') {
    // Properly resolve canonical path and verify parent bounds
    const resolvedPath = path.resolve(__dirname, 'public', file);
    if (!resolvedPath.startsWith(path.join(__dirname, 'public'))) {
      return res.status(403).json({ error: "Access denied. Target resides outside authorized folder." });
    }
  } else {
    // Strips "../" non-recursively once to simulate basic sanitization filter
    file = file.replace(/\.\.\//g, '');
  }

  const targetPath = path.join(__dirname, 'public', file);

  fs.readFile(targetPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: "File not found or access denied." });
    }
    res.send(data);
  });
});

// Stage 3: Null byte injection & file extension validation
app.get('/api/stage3/view', (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: "Missing parameter 'file'." });

  if (securityMode === 'secure') {
    // Reject null bytes and validate extension rigidly
    if (file.includes('\0') || !file.endsWith('.pdf')) {
      return res.status(403).json({ error: "Access denied. Invalid file extension or format." });
    }
  } else {
    // Suffix validation check (demands ending in .pdf)
    if (!file.endsWith('.pdf')) {
      return res.status(400).json({ error: "Only PDF archives (.pdf) are allowed." });
    }
  }

  // Simulate C-level null byte termination at file read time:
  // "file.pdf\0" string cuts off everything after the null byte when handled by native system calls
  const cleanFile = file.split('\0')[0];
  const targetPath = path.join(__dirname, 'public', cleanFile);

  fs.readFile(targetPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: "File not found or access denied." });
    }
    res.send(data);
  });
});

// Stage 4: Starts with expected directory check
app.get('/api/stage4/view', (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: "Missing parameter 'file'." });

  if (securityMode === 'secure') {
    const resolvedPath = path.resolve(__dirname, 'public', file);
    if (!resolvedPath.startsWith(path.join(__dirname, 'public', 'assets'))) {
      return res.status(403).json({ error: "Access denied. Resource must reside in assets directory." });
    }
  } else {
    // Sourced from HackMeIfYouCan: Validate that path starts with the expected subfolder
    if (!file.startsWith('assets/')) {
      return res.status(400).json({ error: "Access denied. File query must start with assets/ folder." });
    }
  }

  const targetPath = path.join(__dirname, 'public', file);

  fs.readFile(targetPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: "File not found or access denied." });
    }
    res.send(data);
  });
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
  console.log(`Upgraded Multi-Stage Path Traversal Lab running on port ${PORT}`);
});
