# CyberLabs Platform

A premium hybrid web application security training platform modeled after HackMeIfYouCan Training Academy and DVWA. Built with a modular containerized architecture using Docker, a custom Vanilla CSS dark cyber dashboard, and dynamic lab instantiation.

## Features
- **Dynamic Container Control**: Spawns and terminates individual vulnerable Docker containers on-demand via the dashboard.
- **OWASP Top 10 Coverage**: 15 distinct, high-fidelity security assessment labs of varying difficulties.
- **Verification System**: Live flag submission forms with progress indicators.

---

## Deployment & Setup

### Prerequisites
Ensure the host machine has **Docker** and **Docker Compose** installed and that your current user is added to the `docker` group (to access `/var/run/docker.sock`).

### 1. Launch the Dashboard
From the root of the project workspace, build and run the main portal:
```bash
docker compose up --build -d dashboard
```

### 2. Access the Portal
Open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

### 3. Exploit Labs
1. Locate any challenge card and click **Start Lab**.
2. Click **Access Lab** once the beacon status shifts to `RUNNING`.
3. Discover the flag token (`FLAG{...}`), paste it into the flag text input field on the dashboard card, and click **Submit**.

---

## Lab Challenge Map

| Lab # | Category | Port | Vulnerability Class |
|---|---|---|---|
| **01** | A01: Broken Access Control | `30001` | Insecure Direct Object References (IDOR) |
| **02** | A01: Broken Access Control | `30003` | Path Traversal / LFI |
| **03** | A01: Broken Access Control | `30002` | vertical & Horizontal Privilege Escalation |
| **04** | A02: Cryptographic Failures | `30004` | AES-128-ECB Token Forgery |
| **05** | A03: Injection | `30005` | Union-Based SQL Injection |
| **06** | A03: Injection | `30006` | Boolean-Blind SQL Injection |
| **07** | A03: Injection | `30007` | OS Command Injection |
| **08** | A03: Injection | `30008` | Server-Side Template Injection (SSTI) |
| **09** | A04: Insecure Design | `30009` | Password Reset Logic Flaw |
| **10** | A05: Security Misconfiguration | `30010` | XML External Entity (XXE) Injection |
| **11** | A06: Outdated Components | `30012` | EJS Prototype Pollution / Options RCE |
| **12** | A07: Auth Failures | `30013` | JWT Algorithm Bypass (None Alg) |
| **13** | A08: Software Integrity Failures | `30014` | Python Pickle Insecure Deserialization |
| **14** | A09: Logging & Monitoring | `30015` | PHP Log Poisoning + LFI RCE |
| **15** | A10: Server-Side Request Forgery | `30016` | Loopback IP SSRF |
| **16** | A01: Broken Access Control | `30017` | CORS Misconfiguration with Credentials |
| **17** | A03: Injection | `30018` | Time-Blind SQL Injection |
| **18** | A05: Security Misconfiguration | `30019` | Exposed Git Repository & Info Disclosure |
| **19** | A07: Auth Failures | `30020` | Broken OAuth 2.0 Flow (Account Takeover) |
| **20** | A10: SSRF | `30021` | SSRF with DNS & Blacklist Bypass |
| **21** | A07: Auth Failures | `30022` | Username Enumeration & Password Brute Force |
| **22** | A08: Software Integrity Failures | `30023` | Node-Serialize Insecure Deserialization RCE |
| **23** | A09: Logging & Monitoring | `30024` | Stored XSS via Audit Log Poisoning |
