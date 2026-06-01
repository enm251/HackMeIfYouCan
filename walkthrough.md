# CyberLabs Project Walkthrough - Phase 1-8 Update

We have successfully set up the foundational architecture and the first eight labs for the OWASP Top 10 Web Vulnerability Assessment training ground in `/home/wick/Documents/HackMeIfYouCan`.

---

## Changes Made

### 1. Root Configurations
- Updated [docker-compose.yml](file:///home/wick/Documents/HackMeIfYouCan/docker-compose.yml): Added services `lab_a01_privesc`, `lab_a02_weak_crypto`, `lab_a03_sqli_union`, `lab_a03_sqli_blind`, `lab_a03_cmd_injection`, and `lab_a03_ssti` under the `labs` profile.

### 2. Central Portal Dashboard
- Created [dashboard/package.json](file:///home/wick/Documents/HackMeIfYouCan/dashboard/package.json) & [dashboard/Dockerfile](file:///home/wick/Documents/HackMeIfYouCan/dashboard/Dockerfile): Dashboard runtime configuration.
- Created [dashboard/db.js](file:///home/wick/Documents/HackMeIfYouCan/dashboard/db.js): Progress tracking and state engine.
- Created [dashboard/server.js](file:///home/wick/Documents/HackMeIfYouCan/dashboard/server.js): Express backend integrating Dockerode for dynamically starting/stopping lab containers using `/var/run/docker.sock`.
- Created [dashboard/public/index.html](file:///home/wick/Documents/HackMeIfYouCan/dashboard/public/index.html), [style.css](file:///home/wick/Documents/HackMeIfYouCan/dashboard/public/style.css), and [app.js](file:///home/wick/Documents/HackMeIfYouCan/dashboard/public/app.js): Custom cyber-glowing dark theme dashboard.

### 3. Lab 1: A01 - Insecure Direct Object References (IDOR)
- Located at [labs/a01-idor/](file:///home/wick/Documents/HackMeIfYouCan/labs/a01-idor/) (Port `30001`)
- Exposes a customer invoice database endpoint `/api/order?id=<ID>` lacking session checks. Changing the parameter ID to `3` retrieves the Administrator's details and the flag: `FLAG{idor_direct_access_success}`.

### 4. Lab 2: A01 - Path Traversal (LFI)
- Located at [labs/a01-path-traversal/](file:///home/wick/Documents/HackMeIfYouCan/labs/a01-path-traversal/) (Port `30003`)
- Exposes a corporate document reader endpoint `/api/view?file=<filename>` without path sanitation. Navigating to `../../flag.txt` reads the flag: `FLAG{local_file_inclusion_secret}`.

### 5. Lab 3: A01 - Privilege Escalation (JWT Bypass)
- Located at [labs/a01-privesc/](file:///home/wick/Documents/HackMeIfYouCan/labs/a01-privesc/) (Port `30002`)
- Exposes an authorization portal that decodes the payload of a JWT cookie (`auth_token`) without validating the cryptographic signature. Tampering with the base64-encoded payload to specify `"role": "admin"` grants access to the administrative endpoint and yields: `FLAG{jwt_privilege_escalation_admin}`.

### 6. Lab 4: A02 - Cryptographic Failures (AES Cookie Forgery)
- Located at [labs/a02-weak-crypto/](file:///home/wick/Documents/HackMeIfYouCan/labs/a02-weak-crypto/) (Port `30004`)
- Employs AES-128-ECB to encrypt session cookies using a hardcoded key. The user can download the system source code from `/api/source`, extract the 16-byte key, encrypt a modified session payload specifying `"role": "admin"`, and submit the forged cookie to get: `FLAG{broken_cryptography_cracked}`.

### 7. Lab 5: A03 - SQL Injection (Union-based)
- Located at [labs/a03-sqli-union/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-sqli-union/) (Port `30005`)
- A product search feature interpolates queries directly into SQL commands. Because query errors and logs are output to the page, the user can verify column counts and run a UNION command to dump the `users` table: `' UNION SELECT username, password, '3' FROM users --`. This returns the admin account credentials and the flag: `FLAG{sqli_union_data_extracted}`.

### 8. Lab 6: A03 - SQL Injection (Boolean-Blind)
- Located at [labs/a03-sqli-blind/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-sqli-blind/) (Port `30006`)
- Exposes a visitor verification database query mapped to the `TrackingId` cookie. No database errors or tables are printed, but the presence of the `Welcome back!` banner indicates a successful query. The user must script boolean checks char by char to extract the administrator password flag: `FLAG{blind_sqli_exfiltrated}`.

### 9. Lab 7: A03 - OS Command Injection
- Located at [labs/a03-cmd-injection/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-cmd-injection/) (Port `30007`)
- A ping diagnostic panel runs shell commands on user input. It enforces WAF filters that block space characters and the keyword "flag". Users must bypass these filters using shell expansion commands (like `$IFS` and quotes/slashes) to execute code and obtain: `FLAG{command_injection_rce_shell}`.

### 10. Lab 8: A03 - Server-Side Template Injection (SSTI)
- Located at [labs/a03-ssti/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-ssti/) (Port `30008`)
- A Flask notification designer renders unsanitized input via Jinja2's `render_template_string`. By traversing python object hierarchies (e.g. `__mro__` or `__globals__`), the user can execute shell commands on the server to read the flag: `FLAG{ssti_template_rce_done}`.

### 11. Lab 9: A04 - Insecure Design (Password Reset Logic Flaw)
- Located at [labs/a04-insecure-design/](file:///home/wick/Documents/HackMeIfYouCan/labs/a04-insecure-design/) (Port `30009`)
- Exposes an API flow where verifying reset codes flags the session session state as verified. However, the final password reset update updates the password parameter submitted in the request body without checking if it matches the verified account. Learners can verify their own `guest` account code and then post `admin` in the reset body to hijack the admin account and capture the flag: `FLAG{broken_reset_flow_hijacked}`.

### 12. Lab 10: A05 - Security Misconfiguration (XXE Injection)
- Located at [labs/a05-xxe/](file:///home/wick/Documents/HackMeIfYouCan/labs/a05-xxe/) (Port `30010`)
- A support ticket portal processes XML inquiries using a python `lxml` parser configured with `resolve_entities=True`. The user can exploit this by defining an XML External Entity targeting `/app/flag.txt` and referencing it in the body to extract: `FLAG{xxe_external_entity_leak}`.

### 13. Lab 11: A06 - Vulnerable and Outdated Components (EJS RCE)
- Located at [labs/a06-outdated-components/](file:///home/wick/Documents/HackMeIfYouCan/labs/a06-outdated-components/) (Port `30012`)
- A diagnostics dashboard uses an outdated version of the `ejs` template engine (v3.1.6) and merges request query properties directly into template rendering parameters. Attackers exploit **CVE-2022-29078** by supplying custom parameters that pollute the EJS option context (specifically `escapeFunction`) to trigger Remote Code Execution (RCE). The target executes commands (e.g., `cat flag.txt > public/flag.txt`) and fetches the flag: `FLAG{vulnerable_dependency_cve_rce}`.

### 14. Lab 12: A07 - Identification & Authentication Failures (JWT Algorithm Bypass)
- Located at [labs/a07-jwt-bypass/](file:///home/wick/Documents/HackMeIfYouCan/labs/a07-jwt-bypass/) (Port `30013`)
- A secure gate portal authenticates operators using JWT cookie authorization. However, the verification logic accepts the `none` algorithm token signatures. Attackers decode the token, modify the header alg parameter to `"none"`, elevate their role payload to `"role": "admin"`, remove the signature block (keeping a trailing dot), and submit the forged token to get: `FLAG{jwt_none_signature_bypass}`.

### 15. Lab 13: A08 - Software & Data Integrity Failures (Python Pickle Deserialization)
- Located at [labs/a08-deserialization-python/](file:///home/wick/Documents/HackMeIfYouCan/labs/a08-deserialization-python/) (Port `30014`)
- Implements a session portal where the `session` cookie stores a base64-encoded, pickled Python object. The server decodes and loads this cookie using `pickle.loads()`. Learners write a script to instantiate a class with a custom `__reduce__` method that copies the flag to the public directory (e.g. `static/flag.txt`) and trigger Remote Code Execution to get: `FLAG{pickle_deserialization_rce}`.

### 16. Lab 14: A09 - Log Poisoning & LFI RCE
- Located at [labs/a09-log-injection/](file:///home/wick/Documents/HackMeIfYouCan/labs/a09-log-injection/) (Port `30015`)
- A PHP gateway monitor writes unescaped HTTP connection variables (User-Agent) straight to a local file (`logs/access.log`). The app also has a Local File Inclusion vulnerability (`?file=`). The user can poison the logs by making a request with `User-Agent: <?php system($_GET['cmd']); ?>`, and then request `?file=logs/access.log&cmd=cat /app/flag.txt` to execute shell commands and capture: `FLAG{log_poisoning_rce_shell}`.

### 17. Lab 15: A10 - Server-Side Request Forgery (SSRF)
- Located at [labs/a10-ssrf/](file:///home/wick/Documents/HackMeIfYouCan/labs/a10-ssrf/) (Port `30016`)
- Exposes a content proxy utility that retrieves url feeds. An administrative panel route (`/admin/secret`) is configured to block requests coming from public networks, only responding to requests originating from `127.0.0.1`. Learners exploit this by supplying `http://127.0.0.1:3000/admin/secret` to the proxy, coaxing the server to fetch its own secret route locally and return the flag: `FLAG{ssrf_internal_metadata_leak}`.

### 18. Lab 16: A01 - CORS Misconfiguration with Credentials
- Located at [labs/a01-cors/](file:///home/wick/Documents/HackMeIfYouCan/labs/a01-cors/) (Port `30017`)
- The server dynamically mirrors the request `Origin` header in its `Access-Control-Allow-Origin` response header and sets `Access-Control-Allow-Credentials: true`. Exploiting this, a malicious script hosted on a third-party domain (e.g. `http://attacker.com`) can make authenticated requests to `/api/sensitive-profile` and leak the sensitive JSON profile containing the flag: `FLAG{cors_origin_credential_leak}`.

### 19. Lab 17: A03 - Time-Blind SQL Injection
- Located at [labs/a03-sqli-time/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-sqli-time/) (Port `30018`)
- The server concatenates the `TrackingId` cookie directly into an SQLite select statement. Because no database errors or boolean visual outputs are returned, learners must utilize a timing side-channel. They execute a multi-way `CROSS JOIN` (Cartesian product) on a 600-row `delay_helper` table, evaluating queries using timing delays. A conditional query like `visitor_id_x99' AND (SELECT CASE WHEN (SUBSTR((SELECT password FROM users WHERE username='admin'),1,1)='F') THEN (SELECT COUNT(*) FROM delay_helper t1 CROSS JOIN delay_helper t2 CROSS JOIN delay_helper t3) ELSE 0 END) = 0 --` takes ~1.5 seconds if true, enabling character-by-character extraction of the flag: `FLAG{time_sqli_exfiltrated}`.

### 20. Lab 18: A05 - Exposed Git Repository & Info Disclosure
- Located at [labs/a05-git/](file:///home/wick/Documents/HackMeIfYouCan/labs/a05-git/) (Port `30019`)
- Exposes the internal hidden `.git/` folder to the public web server. Learners leverage this to rebuild repository history. They fetch `/.git/logs/HEAD` to find commit logs, identify the commit that initially added the secret `flag.txt` before it was deleted in a subsequent cleanup commit, fetch the corresponding commit and tree objects, decompress them using `zlib` (to extract the SHA-1 of the deleted blob), and retrieve the raw object file to reconstruct the flag: `FLAG{git_repo_secrets_dumped}`.

### 21. Lab 19: A07 - Broken OAuth 2.0 Flow (Account Takeover)
- Located at [labs/a07-oauth/](file:///home/wick/Documents/HackMeIfYouCan/labs/a07-oauth/) (Port `30020`)
- The authorization endpoint `/oauth/authorize` has a logical flaw where it checks if the `redirect_uri` matches a prefix, but fails to prevent path traversal components (e.g. `http://localhost:30020/oauth/callback/../../api/attacker-receiver`). Learners leverage this open redirect to bypass client validations. They send the malicious URL to `/api/trigger-login`, provoking the admin bot to authorize the app and leak its code to the attacker's receiver. The learner captures the code, completes the callback loop to hijack the admin session, and fetches the flag at `/api/admin/flag`: `FLAG{oauth_redirect_uri_hijack}`.

### 22. Lab 20: A10 - SSRF with DNS & Blacklist Bypass
- Located at [labs/a10-ssrf-bypass/](file:///home/wick/Documents/HackMeIfYouCan/labs/a10-ssrf-bypass/) (Port `30021`)
- The URL fetcher `/fetch?url=...` enforces a firewall blacklist blocking direct loopback words (`127.0.0.1`, `localhost`, etc.). Learners bypass this filter by supplying alternative IP representation formats like decimal integer format (`http://2130706433:8000/flag`) or octal format (`http://0177.00.00.01:8000/flag`). The resolver processes these formats, bypassing filters to fetch the local administrative flag from port `8000`: `FLAG{ssrf_blacklist_bypass_secret}`.

### 23. Lab 21: A07 - Username Enumeration & Password Brute Force
- Located at [labs/a07-brute-force/](file:///home/wick/Documents/HackMeIfYouCan/labs/a07-brute-force/) (Port `30022`)
- The connection portal `/api/login` discloses detailed database responses for credential validation failure, returning `"Invalid username"` for unknown user identifiers and `"Incorrect password for user"` for valid accounts. Learners leverage this verbose error handling logic to map usernames, identify the administrative account `admin_sec_operator`, and brute-force the passcode `shadow123` to access security ledgers and read: `FLAG{verbose_errors_enable_brute_force}`.

### 24. Lab 22: A08 - Node-Serialize Insecure Deserialization RCE
- Located at [labs/a08-node-serialize/](file:///home/wick/Documents/HackMeIfYouCan/labs/a08-node-serialize/) (Port `30023`)
- Uses a vulnerable old version of the `node-serialize` package (v0.0.4) to parse user session cookies dynamically on page access. Attackers leverage insecure unserialization by passing a base64-encoded serialized payload containing an Immediately Invoked Function Expression (IIFE) wrapped in the `_$$ND_FUNC$$_` designator. When evaluated, the engine runs arbitrary shell operations on the backend (e.g., `require('child_process').execSync('cp flag.txt public/flag.txt')`), allowing learners to capture the flag: `FLAG{node_serialize_rce_shell}`.

### 25. Lab 23: A09 - Stored XSS via Audit Log Poisoning
- Located at [labs/a09-log-xss/](file:///home/wick/Documents/HackMeIfYouCan/labs/a09-log-xss/) (Port `30024`)
- Implements a ledger dashboard `/admin/logs` that records failed connection requests, logging the browser `User-Agent` and rendering it raw on the screen without escaping HTML tags. Learners poison the connection logs by submitting requests with JavaScript payload `User-Agents`. When the simulated administrator opens the logs ledger panel via `/api/trigger-admin-view`, the Stored XSS runs in the browser, steals the administrative flag from `/api/admin/flag`, and leaks it back to the receiver log: `FLAG{log_poisoning_stored_xss}`.

### 27. Lab 33: OWASP Flagship - CyberCorp Audit Portal
- Located at [labs/cybercorp-portal/](file:///home/wick/Documents/HackMeIfYouCan/labs/cybercorp-portal/) (Port `30040`)
- An industry-grade, multi-stage, non-linear vulnerable scenario modeling realistic enterprise portal architectures.
- **Exploit Flow (7 Phases):**
  1. **Announcements Recon:** Retrieve `/api/announcements` to harvest resource tracking IDs, uncovering a secret administrative document identifier.
  2. **BOLA/IDOR Leak:** Access the cross-tenant document repository at `/api/tenants/tenant_a_19df94c2/documents/<doc_id>` to leak sensitive executive notes disclosing key details.
  3. **SSO Cert Extraction:** Retrieve the dynamically generated SSO public key PEM from `/public-key.pem`.
  4. **JWT Algorithm Confusion:** Craft an administrative session token using HS256, signed with the public key certificate as a shared secret (forcing verification confusion).
  5. **Server-Side Prototype Pollution:** Post a deep merge payload to `/api/settings` using JSON-stringified `__proto__` to inject client options globally.
  6. **EJS Template Injection RCE:** Force EJS compilation at `/admin/render` to execute the polluted options and copy the flag.
  7. **Flag Exfiltration:** Fetch the exfiltrated flag: `FLAG{cybercorp_multi_stage_flagship_rce}`.

---

## Validation & Launch Commands

To start the platform and launch all labs:

```bash
# Build the dashboard image and construct all services (run from workspace root)
docker compose --profile labs up --build -d
```

Once running:
1. Open your browser and navigate to **`http://localhost:3000`** to view the unified CyberLabs Dashboard.
2. Select any lab card (including the flagship **CyberCorp Portal**) and click **Start Lab**.
3. Access the corresponding lab URLs (port `30001` - `30040`).
4. Paste the found flag back to the dashboard, or run the master verifier script `node verify_labs.js` to automatically solve and confirm all flags!

