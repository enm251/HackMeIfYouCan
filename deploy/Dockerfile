FROM node:20-bookworm-slim

# Install system dependencies (Python, PHP, Nginx)
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    php-cli php-sqlite3 php-xml php-mbstring \
    nginx \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pm2

WORKDIR /app

# Copy all code
COPY . .

# Build/Install dependencies for dashboard and node labs
RUN cd dashboard && npm install

# Install node dependencies for labs
RUN for d in labs/*/; do \
      if [ -f "$d/package.json" ]; then \
        echo "Installing dependencies for $d" && cd "$d" && npm install && cd /app; \
      elif [ -f "$d/requirements.txt" ]; then \
        echo "Installing Python dependencies for $d" && python3 -m venv "$d/venv" && "$d/venv/bin/pip" install -r "$d/requirements.txt"; \
      fi; \
    done

# Copy custom nginx conf
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Start both Nginx and PM2
EXPOSE 10000
CMD ["sh", "-c", "nginx && pm2-runtime start deploy/ecosystem.config.js"]
