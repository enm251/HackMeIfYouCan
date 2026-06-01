const net = require('net');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Express application for handling standard frontend views
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let securityMode = 'vulnerable';
const logs = [];
const MAX_LOGS = 100;
let smuggledCache = null;

const stageFlags = {
  1: 'FLAG{request_smuggling_cl_te_poisoning}',
  2: 'FLAG{request_smuggling_te_cl_bypass}',
  3: 'FLAG{request_smuggling_cl_cl_header}',
  4: 'FLAG{request_smuggling_cache_poison_expert}'
};

function addLog(entry) {
  logs.push({
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

// Settings & Logs Endpoints inside Express
app.get('/api/settings/security-mode', (req, res) => {
  res.json({ securityMode });
});

app.post('/api/settings/security-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'secure' || mode === 'vulnerable') {
    securityMode = mode;
    res.json({ success: true, securityMode });
  } else {
    res.status(400).json({ error: "Invalid mode." });
  }
});

app.get('/api/logs', (req, res) => {
  res.json({ logs });
});

app.post('/api/logs/clear', (req, res) => {
  logs.length = 0;
  res.json({ success: true });
});

app.listen(3001, () => {
  console.log("Express asset delivery running on port 3001");
});

// A raw TCP proxy server simulating Smuggling mismatch vulnerabilities
const PORT = 3000;

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const rawRequest = data.toString();
    const start = Date.now();

    // Standard frontend static request redirection to Express port 3001
    const isSettingsOrLogs = rawRequest.includes("/api/settings") || rawRequest.includes("/api/logs");
    if (rawRequest.includes("GET / ") || rawRequest.includes("GET /index.html") || isSettingsOrLogs) {
      const client = net.connect(3001, 'localhost', () => {
        client.write(data);
      });
      client.on('data', (res) => socket.write(res));
      return;
    }

    let responseHeaders = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n";
    
    // Check for smuggling headers
    const hasCL = rawRequest.toLowerCase().includes("content-length:");
    const hasTE = rawRequest.toLowerCase().includes("transfer-encoding: chunked");

    // Logger
    addLog({
      method: "POST",
      path: "/api/smuggle",
      statusCode: 200,
      duration: Date.now() - start + 'ms',
      ip: socket.remoteAddress,
      securityMode: securityMode
    });

    if (securityMode === 'secure') {
      // SECURE MODE: Standardized parser rejects pipeline mismatches
      if (hasCL && hasTE) {
        socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n" + JSON.stringify({ error: "Pipeline Mismatch Blocked" }));
        socket.end();
        return;
      }
    } else {
      if (hasCL && hasTE) {
        const chunks = rawRequest.split("\r\n\r\n");
        const body = chunks.slice(1).join("\r\n\r\n");
        
        const smuggledMatch = body.match(/(GET|POST) \/api\/[a-zA-Z0-9_-]+/);
        if (smuggledMatch) {
          const smuggledPath = smuggledMatch[0];
          
          let stage = 1;
          if (rawRequest.includes("stage=2")) stage = 2;
          if (rawRequest.includes("stage=3")) stage = 3;
          if (rawRequest.includes("stage=4")) stage = 4;

          if (smuggledPath.includes("/api/capture")) {
            smuggledCache = stageFlags[stage] || stageFlags[1];
          }
          
          socket.write(responseHeaders + JSON.stringify({
            success: true,
            message: "Front-end processed request using Content-Length. Back-end parsed chunked boundary, queueing smuggled request segment.",
            smuggled: true
          }));
          socket.end();
          return;
        }
      }
    }

    if (rawRequest.includes("GET /api/flag")) {
      socket.write(responseHeaders + JSON.stringify({
        success: true,
        flag: smuggledCache || "No request has been smuggled to the pipeline queue yet."
      }));
      socket.end();
      return;
    }

    socket.write(responseHeaders + JSON.stringify({ success: false, error: "Invalid pipeline query." }));
    socket.end();
  });
});

server.listen(PORT, () => {
  console.log(`Raw Smuggling simulator server listening on port ${PORT}`);
});
