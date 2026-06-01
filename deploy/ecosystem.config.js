module.exports = {
  apps: [
    {
        "name": "dashboard",
        "script": "server.js",
        "cwd": "/app/dashboard",
        "env": {
            "PORT": "3000",
            "NODE_ENV": "production"
        }
    },
    {
        "name": "a01-idor",
        "script": "server.js",
        "cwd": "/app/labs/a01-idor",
        "env": {
            "PORT": "30001",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a01-privesc",
        "script": "server.js",
        "cwd": "/app/labs/a01-privesc",
        "env": {
            "PORT": "30002",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a01-path-traversal",
        "script": "server.js",
        "cwd": "/app/labs/a01-path-traversal",
        "env": {
            "PORT": "30003",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a02-weak-crypto",
        "script": "server.js",
        "cwd": "/app/labs/a02-weak-crypto",
        "env": {
            "PORT": "30004",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-sqli-union",
        "script": "server.js",
        "cwd": "/app/labs/a03-sqli-union",
        "env": {
            "PORT": "30005",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-sqli-blind",
        "script": "server.js",
        "cwd": "/app/labs/a03-sqli-blind",
        "env": {
            "PORT": "30006",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-cmd-injection",
        "script": "server.js",
        "cwd": "/app/labs/a03-cmd-injection",
        "env": {
            "PORT": "30007",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-ssti",
        "script": "server.js",
        "cwd": "/app/labs/a03-ssti",
        "env": {
            "PORT": "30008",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a04-insecure-design",
        "script": "server.js",
        "cwd": "/app/labs/a04-insecure-design",
        "env": {
            "PORT": "30009",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a05-xxe",
        "script": "server.js",
        "cwd": "/app/labs/a05-xxe",
        "env": {
            "PORT": "30010",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a06-outdated-components",
        "script": "server.js",
        "cwd": "/app/labs/a06-outdated-components",
        "env": {
            "PORT": "30012",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a07-jwt-bypass",
        "script": "server.js",
        "cwd": "/app/labs/a07-jwt-bypass",
        "env": {
            "PORT": "30013",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a08-deserialization-python",
        "script": "app.py",
        "cwd": "/app/labs/a08-deserialization-python",
        "env": {
            "PORT": "30014",
            "NODE_ENV": "production"
        },
        "interpreter": "/app/labs/a08-deserialization-python/venv/bin/python3"
    },
    {
        "name": "a09-log-injection",
        "script": "php",
        "cwd": "/app/labs/a09-log-injection",
        "env": {
            "PORT": "30015",
            "NODE_ENV": "production"
        },
        "args": "-S 127.0.0.1:30015"
    },
    {
        "name": "a10-ssrf",
        "script": "server.js",
        "cwd": "/app/labs/a10-ssrf",
        "env": {
            "PORT": "30016",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a01-cors",
        "script": "server.js",
        "cwd": "/app/labs/a01-cors",
        "env": {
            "PORT": "30017",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-sqli-time",
        "script": "server.js",
        "cwd": "/app/labs/a03-sqli-time",
        "env": {
            "PORT": "30018",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a05-git",
        "script": "server.js",
        "cwd": "/app/labs/a05-git",
        "env": {
            "PORT": "30019",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a07-oauth",
        "script": "server.js",
        "cwd": "/app/labs/a07-oauth",
        "env": {
            "PORT": "30020",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a10-ssrf-bypass",
        "script": "app.py",
        "cwd": "/app/labs/a10-ssrf-bypass",
        "env": {
            "PORT": "30021",
            "NODE_ENV": "production"
        },
        "interpreter": "/app/labs/a10-ssrf-bypass/venv/bin/python3"
    },
    {
        "name": "a07-brute-force",
        "script": "server.js",
        "cwd": "/app/labs/a07-brute-force",
        "env": {
            "PORT": "30022",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a08-node-serialize",
        "script": "server.js",
        "cwd": "/app/labs/a08-node-serialize",
        "env": {
            "PORT": "30023",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a09-log-xss",
        "script": "server.js",
        "cwd": "/app/labs/a09-log-xss",
        "env": {
            "PORT": "30024",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-nosql",
        "script": "server.js",
        "cwd": "/app/labs/a03-nosql",
        "env": {
            "PORT": "30025",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-ldap",
        "script": "server.js",
        "cwd": "/app/labs/a03-ldap",
        "env": {
            "PORT": "30026",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-second-order",
        "script": "server.js",
        "cwd": "/app/labs/a03-second-order",
        "env": {
            "PORT": "30027",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a03-xpath",
        "script": "app.py",
        "cwd": "/app/labs/a03-xpath",
        "env": {
            "PORT": "30028",
            "NODE_ENV": "production"
        },
        "interpreter": "/app/labs/a03-xpath/venv/bin/python3"
    },
    {
        "name": "a03-argument-injection",
        "script": "server.js",
        "cwd": "/app/labs/a03-argument-injection",
        "env": {
            "PORT": "30029",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a08-prototype-pollution",
        "script": "server.js",
        "cwd": "/app/labs/a08-prototype-pollution",
        "env": {
            "PORT": "30030",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a02-jwt-confusion",
        "script": "server.js",
        "cwd": "/app/labs/a02-jwt-confusion",
        "env": {
            "PORT": "30031",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a06-request-smuggling",
        "script": "server.js",
        "cwd": "/app/labs/a06-request-smuggling",
        "env": {
            "PORT": "30032",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "a04-race-condition",
        "script": "server.js",
        "cwd": "/app/labs/a04-race-condition",
        "env": {
            "PORT": "30033",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    },
    {
        "name": "cybercorp-portal",
        "script": "server.js",
        "cwd": "/app/labs/cybercorp-portal",
        "env": {
            "PORT": "30040",
            "NODE_ENV": "production"
        },
        "interpreter": "node"
    }
]
};
