FROM node:20-bookworm-slim

# Install system dependencies (Python, PHP, Nginx, curl for healthchecks)
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    php-cli php-sqlite3 php-xml php-mbstring \
    nginx curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pm2

WORKDIR /app

# Copy all code
COPY . .

# Build/Install dependencies for dashboard and node labs
RUN cd dashboard && npm install --production

# Install node dependencies for labs that have package.json
RUN for d in labs/*/; do \
      if [ -f "$d/package.json" ]; then \
        echo "Installing dependencies for $d" && cd "$d" && npm install --production && cd /app; \
      fi; \
    done

# Install Python dependencies for labs that have requirements.txt OR app.py
# This handles labs with empty/missing requirements.txt that still need Flask
RUN for d in labs/*/; do \
      if [ -f "$d/app.py" ]; then \
        echo "Setting up Python venv for $d" && \
        python3 -m venv "$d/venv" && \
        "$d/venv/bin/pip" install --no-cache-dir flask && \
        if [ -f "$d/requirements.txt" ] && [ -s "$d/requirements.txt" ]; then \
          "$d/venv/bin/pip" install --no-cache-dir -r "$d/requirements.txt"; \
        fi; \
      fi; \
    done

# Ensure the PHP log-injection lab has its logs directory
RUN mkdir -p /app/labs/a09-log-injection/logs && chmod 777 /app/labs/a09-log-injection/logs

# Create necessary directories for nginx
RUN mkdir -p /var/log/nginx /var/run

# Copy custom nginx conf
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Expose Render's expected port
EXPOSE 10000

# Start Nginx in background, then PM2 as process manager
CMD ["sh", "-c", "nginx && pm2-runtime start deploy/ecosystem.config.js"]
