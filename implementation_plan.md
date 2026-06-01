# Implementation Plan - Phase 2 Lab Expansion

This plan outlines the design and implementation for extending the CyberLabs platform with 5 new advanced web security training labs (Labs 16 to 20), covering critical OWASP Top 10 categories. These labs introduce higher-fidelity, multi-step challenge scenarios modeled after modern real-world vulnerabilities and HackMeIfYouCan Training Academy.

---

## Proposed New Labs

| Lab # | Category | Port | Name / Vulnerability Class |
|---|---|---|---|
| **16** | A01: Broken Access Control | `30017` | CORS Misconfiguration with Credentials |
| **17** | A03: Injection | `30018` | Time-Blind SQL Injection |
| **18** | A05: Security Misconfiguration | `30019` | Exposed Git Repository & Info Disclosure |
| **19** | A07: Auth Failures | `30020` | Broken OAuth 2.0 Flow (Account Takeover) |
| **20** | A10: SSRF | `30021` | SSRF with DNS & Blacklist Bypass |

---

## User Review Required

> [!NOTE]
> **Dynamic Port Allocation**: The 5 new labs will map host ports `30017` to `30021` under the `labs` Docker Compose profile.
> 
> **Self-Contained SQLite Time Delay**: Rather than requiring native C/C++ SQLite extensions (like sleep functions), the Time-Blind SQLi lab will implement a deterministic timing side-channel using a recursive 3-way Cartesian join on a seeded delay-helper table inside memory, taking ~1.5 seconds to run.

---

## Proposed Changes

We will modify the core dashboard DB, docker-compose configuration, and create 5 new lab folders.

### Central Platform Core

#### [MODIFY] [docker-compose.yml](file:///home/wick/Documents/HackMeIfYouCan/docker-compose.yml)
Append the definitions of the 5 new services under the `labs` profile:
- `lab_a01_cors` (port `30017:3000`)
- `lab_a03_sqli_time` (port `30018:3000`)
- `lab_a05_git` (port `30019:3000`)
- `lab_a07_oauth` (port `30020:3000`)
- `lab_a10_ssrf_bypass` (port `30021:3000`)

#### [MODIFY] [db.js](file:///home/wick/Documents/HackMeIfYouCan/dashboard/db.js)
Append the database metadata for the 5 new labs to `DEFAULT_STATE.labs` so that they appear on the central portal dashboard.

---

### New Lab Configurations

#### [NEW] [labs/a01-cors/](file:///home/wick/Documents/HackMeIfYouCan/labs/a01-cors/)
- `Dockerfile`: Node.js Alpine base.
- `package.json`: Express server setup.
- `server.js`: Implements `/api/sensitive-profile` reflecting the request `Origin` header dynamically in `Access-Control-Allow-Origin` and setting `Access-Control-Allow-Credentials: true`.
- `flag.txt`: Contains `FLAG{cors_origin_credential_leak}`.

#### [NEW] [labs/a03-sqli-time/](file:///home/wick/Documents/HackMeIfYouCan/labs/a03-sqli-time/)
- `Dockerfile`: Node.js Alpine base containing `sqlite3` package.
- `package.json`: Node dependencies.
- `server.js`: Implements cookie-based blind SQLi. Seeds a `delay_helper` table with 600 rows. Evaluates queries dynamically.
- Database contains admin password: `FLAG{time_sqli_exfiltrated}`.

#### [NEW] [labs/a05-git/](file:///home/wick/Documents/HackMeIfYouCan/labs/a05-git/)
- `Dockerfile`: Alpine image installing `git`. Initializes a git repository, commits a sensitive file `flag.txt` containing `FLAG{git_repo_secrets_dumped}`, and deletes the file in a subsequent commit.
- `server.js`: Serves the static folder containing `.git/` directory.

#### [NEW] [labs/a07-oauth/](file:///home/wick/Documents/HackMeIfYouCan/labs/a07-oauth/)
- `Dockerfile`: Node.js Alpine base.
- `server.js`: Simulates an OAuth authorization server and client portal.
  - Vulnerability: Authorize endpoint `/oauth/authorize` accepts directory-traversal-laden `redirect_uri` parameters (e.g. `http://localhost:30020/oauth/callback/../../api/attacker-receiver`).
  - Attack flow: Hijack the OAuth authorization code, use it to fetch the administrator session cookie, and read `/api/admin/flag` containing `FLAG{oauth_redirect_uri_hijack}`.

#### [NEW] [labs/a10-ssrf-bypass/](file:///home/wick/Documents/HackMeIfYouCan/labs/a10-ssrf-bypass/)
- `Dockerfile`: Python Alpine base installing `flask`.
- `app.py`: Implements an internal administrative listener on port `8000` (accessible only from loopback IP) and a public content retriever on port `3000`.
  - The public retriever filters out loopback strings like `127.0.0.1`, `localhost`, `0.0.0.0`, and `[::1]`.
  - Learners bypass filter using decimal representations (`http://2130706433:8000/flag`) or octal representation (`http://0177.00.00.01:8000/flag`) to capture the flag: `FLAG{ssrf_blacklist_bypass_secret}`.

---

### Verification and Test Scripts

#### [MODIFY] [verify_labs.js](file:///home/wick/Documents/HackMeIfYouCan/verify_labs.js)
Extend the automated verification script with exploit routines for the 5 new challenges:
- `a01-cors`: Queries endpoint with `Origin: http://attacker.com` and verifies headers.
- `a03-sqli-time`: Runs a time-blind boolean solver using Cartesian product delays to extract the flag character-by-character.
- `a05-git`: Downloads `.git/logs/HEAD`, locates the commit that created `flag.txt`, extracts the object hash, retrieves the raw compressed object file, decompresses it (using `zlib`), and parses the flag.
- `a07-oauth`: Invokes authorize flow with hijacked redirect URI, captures authorization code from simulated endpoint log, exchanges code, and retrieves flag.
- `a10-ssrf-bypass`: Submits the decimal bypass payload to the SSRF endpoint and returns the flag.

---

## Verification Plan

### Automated Tests
Run the extended automated verification suite:
```bash
node verify_labs.js
```
We will verify that all 20 labs (15 original + 5 new) successfully boot up, solve, return the correct flags, submit them to the dashboard, and shut down.

### Manual Verification
1. Access `http://localhost:3000` in the browser.
2. Verify the 5 new cards show up in the grid.
3. Start the CORS and SSRF Bypass labs, interact with them, and verify that progress states sync correctly.
