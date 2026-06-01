const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Stage 1 Endpoint: Basic Command Injection with spaces & "flag" blocked
app.get('/api/ping', (req, res) => {
  const { host } = req.query;

  if (!host) {
    return res.status(400).json({ error: "Hostname or IP address is required." });
  }

  if (securityMode === 'secure') {
    // SECURE: Strict validation / IP validation or Parameterized execution without shell shell injection
    const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipPattern.test(host.trim())) {
      return res.status(400).json({ error: "Security Alert: Invalid IP Address format." });
    }
    const command = `ping -c 3 ${host}`;
    exec(command, (err, stdout, stderr) => {
      res.json({ success: !err, output: stdout });
    });
  } else {
    // VULNERABLE: Direct concatenation, spaces & word "flag" blocked
    if (host.includes(' ')) {
      return res.status(400).json({ 
        error: "Security Alert: Spaces are prohibited in the diagnostic utility to prevent command chaining." 
      });
    }

    if (host.toLowerCase().includes('flag')) {
      return res.status(400).json({ 
        error: "Security Alert: The word 'flag' is restricted on this interface." 
      });
    }

    const command = `ping -c 3 ${host}`;
    console.log(`Running system command: ${command}`);

    exec(command, (err, stdout, stderr) => {
      const output = stdout + (stderr ? "\nSTDERR:\n" + stderr : "");
      res.json({ success: !err, output });
    });
  }
});

// Stage 2 Endpoint: delimeters (; & |) blocked
app.get('/api/stage2/ping', (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: "Host required" });

  if (securityMode === 'secure') {
    const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipPattern.test(host.trim())) {
      return res.status(400).json({ error: "Security Alert: Invalid IP format" });
    }
    exec(`ping -c 3 ${host}`, (err, stdout) => {
      res.json({ success: !err, output: stdout });
    });
  } else {
    // Block chaining delimiters ;, &, |
    if (/[;&|]/.test(host)) {
      return res.status(400).json({ 
        error: "Security Alert: Command delimiters (; & |) are blacklisted by the enterprise gateway." 
      });
    }
    // Block spaces and literal 'flag'
    if (host.includes(' ')) return res.status(400).json({ error: "WAF: Spaces prohibited." });
    if (host.toLowerCase().includes('flag')) return res.status(400).json({ error: "WAF: Restricted keyword 'flag' detected." });

    const command = `ping -c 3 ${host}`;
    exec(command, (err, stdout, stderr) => {
      const output = stdout + (stderr ? "\nSTDERR:\n" + stderr : "");
      res.json({ success: !err, output });
    });
  }
});

// Stage 3 Endpoint: Blind command injection (returns no output)
app.get('/api/stage3/ping', (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: "Host required" });

  if (securityMode === 'secure') {
    res.json({ success: true, message: "Diagnostics initiated silently in background." });
  } else {
    // Spaces and word 'flag' blocked
    if (host.includes(' ')) return res.status(400).json({ error: "WAF: Spaces prohibited." });
    if (host.toLowerCase().includes('flag')) return res.status(400).json({ error: "WAF: Restricted keyword 'flag' detected." });

    const command = `ping -c 3 ${host}`;
    exec(command, (err, stdout, stderr) => {
      // Return NO terminal command outputs to make it blind!
      res.json({ success: true, message: "Diagnostics process started successfully in detached background context." });
    });
  }
});

// Stage 4 Endpoint: Strict Command binary block (cat, sh, bash, less, more, head, tail, grep blocked)
app.get('/api/stage4/ping', (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: "Host required" });

  if (securityMode === 'secure') {
    res.json({ success: true, output: "System check completed." });
  } else {
    // WAF filter: Block spaces and keyword 'flag'
    if (host.includes(' ')) return res.status(400).json({ error: "WAF: Spaces prohibited." });
    if (host.toLowerCase().includes('flag')) return res.status(400).json({ error: "WAF: Restricted keyword 'flag' detected." });

    // WAF filter: Block common file reading / execution binaries
    const blacklistBinaries = ['cat', 'less', 'more', 'sh', 'bash', 'head', 'tail', 'grep', 'strings'];
    for (const bin of blacklistBinaries) {
      if (host.toLowerCase().includes(bin)) {
        return res.status(400).json({ 
          error: `Security Alert: The system utility binary "${bin}" is blacklisted for execution audits.` 
        });
      }
    }

    const command = `ping -c 3 ${host}`;
    exec(command, (err, stdout, stderr) => {
      const output = stdout + (stderr ? "\nSTDERR:\n" + stderr : "");
      res.json({ success: !err, output });
    });
  }
});

app.listen(PORT, () => {
  console.log(`Command Injection Lab running on port ${PORT}`);
});
