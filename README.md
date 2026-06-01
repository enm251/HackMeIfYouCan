# HackMeIfYouCan

A self-hosted web application security assessment lab platform featuring 33 vulnerable environments mapped to the OWASP Top 10 (2021). Each lab presents a realistic, exploitable web application with four progressive difficulty stages — from guided beginner exercises to expert-level challenges requiring chained exploits.

Built for security students, penetration testers, and CTF enthusiasts who want hands-on practice without the risk of testing against production systems.

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Architecture](#architecture)
- [Lab Catalog](#lab-catalog)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A: Docker Compose (Recommended for Local Use)](#option-a-docker-compose-recommended-for-local-use)
  - [Option B: Single Container (For Cloud Deployment)](#option-b-single-container-for-cloud-deployment)
  - [Option C: Deploy to Render](#option-c-deploy-to-render)
- [How to Use](#how-to-use)
- [Dashboard Features](#dashboard-features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## What This Project Does

HackMeIfYouCan provides a controlled environment where you can legally practice exploiting real web vulnerabilities. Each lab is an isolated web application intentionally built with a specific security flaw. Your objective is to discover the vulnerability, exploit it, and capture a flag token (`FLAG{...}`) as proof.

Key capabilities:

- **33 vulnerability labs** covering every category in the OWASP Top 10 (2021)
- **4 difficulty stages per lab** (Easy, Medium, Hard, Expert) with independent flags
- **Central dashboard** for managing labs, tracking progress, and submitting flags
- **Built-in request repeater** (Mini-Burp) for crafting and sending custom HTTP requests
- **Hint system** with three tiers of progressive guidance per lab (Recon, Vector, Exploit)
- **Security mode toggle** on each lab to switch between vulnerable and patched states for learning

---

## Architecture

The platform supports two deployment models:

**Multi-Container (Docker Compose)** — Each lab runs in its own isolated Docker container. The dashboard manages container lifecycle (start/stop) through the Docker socket. Best for local development and testing.

**Single-Container (Render / Cloud)** — All labs run as PM2-managed processes inside one container, with Nginx reverse-proxying requests to each lab by URL path. Best for cloud hosting where only one port is exposed.

```
                         +------------------+
    Internet / Browser --| Nginx (port 10000)|
                         +--------+---------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
        /lab/a01-idor/     /lab/a03-sqli/       /api/labs
              |                   |                   |
        Lab on :30001      Lab on :30005       Dashboard :3000
```

---

## Lab Catalog

### A01:2021 — Broken Access Control

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a01-idor | Insecure Direct Object References (IDOR) | Easy | 30001 |
| a01-privesc | Vertical and Horizontal Privilege Escalation | Medium | 30002 |
| a01-path-traversal | Path Traversal / Local File Inclusion (LFI) | Easy | 30003 |
| a01-cors | CORS Misconfiguration with Credentials | Easy | 30017 |

### A02:2021 — Cryptographic Failures

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a02-weak-crypto | AES-128-ECB Token Forgery | Medium | 30004 |
| a02-jwt-confusion | JWT Key Confusion Attack (HMAC vs RSA) | Hard | 30031 |

### A03:2021 — Injection

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a03-sqli-union | Union-Based SQL Injection | Easy | 30005 |
| a03-sqli-blind | Blind SQL Injection (Boolean and Time) | Medium | 30006 |
| a03-sqli-time | Time-Blind SQL Injection | Hard | 30018 |
| a03-cmd-injection | OS Command Injection | Hard | 30007 |
| a03-ssti | Server-Side Template Injection (Jinja2) | Hard | 30008 |
| a03-nosql | NoSQL Operator Injection (NeDB) | Easy | 30025 |
| a03-ldap | LDAP Filter Wildcard Injection | Medium | 30026 |
| a03-second-order | Second-Order SQL Injection | Hard | 30027 |
| a03-xpath | XPath Injection for XML Data Disclosure | Medium | 30028 |
| a03-argument-injection | Parameter and Argument Injection RCE | Hard | 30029 |

### A04:2021 — Insecure Design

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a04-insecure-design | Broken Password Reset Logic Flaw | Easy | 30009 |
| a04-race-condition | Concurrency Race Condition (TOCTOU) | Medium | 30033 |

### A05:2021 — Security Misconfiguration

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a05-xxe | XML External Entity (XXE) Injection | Medium | 30010 |
| a05-git | Exposed Git Repository and Secrets Disclosure | Easy | 30019 |

### A06:2021 — Vulnerable and Outdated Components

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a06-outdated-components | EJS CVE-2022-29078 (Prototype Pollution RCE) | Hard | 30012 |
| a06-request-smuggling | HTTP Request Smuggling (CL.TE Mismatch) | Expert | 30032 |

### A07:2021 — Identification and Authentication Failures

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a07-jwt-bypass | JWT None Algorithm Signature Bypass | Easy | 30013 |
| a07-oauth | Broken OAuth 2.0 Redirect URI Hijacking | Hard | 30020 |
| a07-brute-force | Username Enumeration and Password Brute Force | Easy | 30022 |

### A08:2021 — Software and Data Integrity Failures

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a08-deserialization-python | Python Pickle Insecure Deserialization | Hard | 30014 |
| a08-node-serialize | Node-Serialize RCE via IIFE Injection | Hard | 30023 |
| a08-prototype-pollution | Server-Side Prototype Pollution | Hard | 30030 |

### A09:2021 — Security Logging and Monitoring Failures

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a09-log-injection | PHP Log Poisoning with LFI to RCE | Hard | 30015 |
| a09-log-xss | Stored XSS via Audit Log Poisoning | Medium | 30024 |

### A10:2021 — Server-Side Request Forgery (SSRF)

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| a10-ssrf | Loopback SSRF with Internal Metadata Leak | Easy | 30016 |
| a10-ssrf-bypass | SSRF with DNS Rebinding and Blacklist Bypass | Medium | 30021 |

### Flagship Challenge

| Lab | Vulnerability | Difficulty | Port |
|-----|---------------|------------|------|
| cybercorp-portal | Multi-Stage: SQLi, JWT Confusion, Prototype Pollution, EJS RCE | Expert | 30040 |

---

## Getting Started

### Prerequisites

- **Git** — to clone the repository
- **Docker** and **Docker Compose** — for containerized deployment
- A modern web browser (Chrome, Firefox, or Edge)

### Option A: Docker Compose (Recommended for Local Use)

This mode runs each lab as a separate Docker container. You can start and stop individual labs from the dashboard.

```bash
# 1. Clone the repository
git clone https://github.com/enm251/HackMeIfYouCan.git
cd HackMeIfYouCan

# 2. Build and start the dashboard
docker compose up --build -d dashboard

# 3. (Optional) Pre-build all lab containers
docker compose --profile labs create

# 4. Open the dashboard
# Navigate to http://localhost:3000
```

From the dashboard, click "Start Lab" on any challenge card. The dashboard will spin up the corresponding container automatically.

To start all labs at once:

```bash
docker compose --profile labs up -d
```

To shut everything down:

```bash
docker compose down
```

### Option B: Single Container (For Cloud Deployment)

This mode packages everything — dashboard, all 33 labs, Nginx, and PM2 — into a single Docker image. Useful when your hosting platform only exposes one port.

```bash
# 1. Clone the repository
git clone https://github.com/enm251/HackMeIfYouCan.git
cd HackMeIfYouCan

# 2. Build the single container image
docker build -f deploy/Dockerfile -t hackmeifyoucan .

# 3. Run it
docker run -p 10000:10000 hackmeifyoucan

# 4. Open the dashboard
# Navigate to http://localhost:10000
```

All 33 labs start automatically. Access any lab through its path: `http://localhost:10000/lab/a01-idor/`

### Option C: Deploy to Render

1. Push this repository to your GitHub account
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repository
4. Set the following configuration:
   - **Root Directory**: (leave blank, use repo root)
   - **Dockerfile Path**: `deploy/Dockerfile`
   - **Port**: `10000`
5. Click **Deploy**

Render will build the image, install all dependencies, and expose the platform on your Render URL. All labs are accessible through path-based routing (e.g., `https://your-app.onrender.com/lab/a03-sqli-union/`).

---

## How to Use

1. **Open the dashboard** at the root URL of your deployment
2. **Browse the lab catalog** — filter by OWASP category, difficulty level, or search by name
3. **Start a lab** — click "Start Lab" (Docker Compose mode) or labs are pre-started (single container mode)
4. **Access the lab** — click "Access Lab" to open the vulnerable application in a new tab
5. **Exploit the vulnerability** — analyze the application, find the flaw, and extract the flag
6. **Submit the flag** — paste the `FLAG{...}` token into the submission field on the dashboard
7. **Use hints if stuck** — each lab has three tiers of hints (Recon, Vector, Exploit)
8. **Try all four stages** — after capturing the first flag, attempt the Medium, Hard, and Expert stages which introduce WAFs, filters, and more complex exploitation chains

---

## Dashboard Features

**Lab Management** — Start, stop, and monitor the status of each lab container. View port assignments and running state in real time.

**Progress Tracking** — A global progress bar and per-lab solved indicators track your completion across all 33 challenges.

**Mini-Burp Repeater** — A built-in HTTP request crafting tool. Set the method, URL, headers, and body, then send custom requests directly from the dashboard. View response status, headers, timing, and body. Useful for labs that require header manipulation or cookie injection.

**Hint System** — Three progressive hint tiers per lab:
- Tier 1 (Recon): Where to look and what to observe
- Tier 2 (Vector): The vulnerability class and attack approach
- Tier 3 (Exploit): A working payload or step-by-step exploitation guide

**Security Mode Toggle** — Each lab supports switching between "vulnerable" and "secure" modes. Use this to compare vulnerable vs patched implementations and understand the fix for each vulnerability.

---

## Project Structure

```
HackMeIfYouCan/
├── dashboard/                  # Central dashboard application
│   ├── server.js               # Express backend (API + WebSocket shell)
│   ├── db.js                   # Lab registry and progress storage
│   ├── package.json            # Dashboard dependencies
│   └── public/                 # Frontend (HTML, CSS, JS)
│
├── labs/                       # All 33 vulnerability labs
│   ├── a01-idor/               # Each lab is self-contained
│   │   ├── server.js           # Lab server (Node.js)
│   │   ├── package.json        # Lab dependencies
│   │   ├── Dockerfile          # Lab container definition
│   │   ├── flag.txt            # Flag files for each stage
│   │   └── public/             # Lab frontend
│   ├── a03-ssti/               # Python-based lab example
│   │   ├── app.py              # Lab server (Flask)
│   │   ├── requirements.txt    # Python dependencies
│   │   └── Dockerfile
│   ├── a09-log-injection/      # PHP-based lab
│   │   ├── index.php           # Lab server (PHP built-in)
│   │   └── Dockerfile
│   └── ...                     # 30 more labs
│
├── deploy/                     # Single-container deployment config
│   ├── Dockerfile              # Multi-stage build for all services
│   ├── ecosystem.config.js     # PM2 process manager configuration
│   └── nginx.conf              # Nginx reverse proxy routing
│
├── docker-compose.yml          # Multi-container orchestration
└── verify_labs.js              # Automated lab verification script
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Dashboard Backend | Node.js, Express |
| Dashboard Frontend | Vanilla HTML, CSS, JavaScript |
| Node.js Labs (26) | Express, SQLite3, EJS, cookie-parser |
| Python Labs (6) | Flask, Jinja2, lxml |
| PHP Lab (1) | PHP built-in server |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
| Containerization | Docker, Docker Compose |
| Request Repeater | Custom fetch-based proxy relay |

---

## Disclaimer

This platform is designed exclusively for educational purposes and authorized security testing. Every lab contains intentionally vulnerable code meant to teach exploitation techniques in a safe, isolated environment.

**Do not deploy this platform on a public network without access controls.** The labs contain real, exploitable vulnerabilities including remote code execution, SQL injection, and deserialization attacks. Exposing them to the internet without authentication puts your server at risk.

**Do not use the techniques learned here against systems you do not own or have explicit written authorization to test.** Unauthorized access to computer systems is illegal in most jurisdictions.

The authors assume no responsibility for misuse of this software.

---

## License

This project is open source and available for educational use. See the repository for license details.
