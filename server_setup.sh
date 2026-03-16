#!/bin/bash
# ═══════════════════════════════════════════════════════
# server_setup.sh — DigitalOcean Droplet Setup
# ═══════════════════════════════════════════════════════
# This script turns a fresh Ubuntu 24.04 droplet into a
# production Node.js server. Run it once as root.
#
# It installs and configures:
#   - Node.js 22 LTS  (runs our application)
#   - PostgreSQL 16   (our database)
#   - nginx           (sits in front of Node, handles SSL)
#   - PM2             (keeps the app running after reboots)
#   - Certbot         (free SSL certificate from Let's Encrypt)
# ═══════════════════════════════════════════════════════

set -e  # Stop immediately if any command fails

echo ""
echo "══════════════════════════════════════════"
echo "  The Epstein Index — Server Setup"
echo "══════════════════════════════════════════"
echo ""

# ── 1. SYSTEM UPDATE ──
echo "[1/7] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. NODE.JS 22 LTS ──
# We use NodeSource's official setup script which adds their
# package repository, then install Node.js from it.
echo "[2/7] Installing Node.js 22 LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
apt-get install -y nodejs -qq

# PM2 is a process manager — it keeps Node.js running in the
# background and restarts it automatically if it crashes or
# if the server reboots.
echo "      Installing PM2..."
npm install -g pm2 --silent

node --version
npm --version

# ── 3. POSTGRESQL ──
echo "[3/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib -qq

# Start PostgreSQL and enable it on boot
systemctl start postgresql
systemctl enable postgresql

# Create our database and user.
# We run these as the postgres system user (the default admin).
echo "      Creating database and user..."
sudo -u postgres psql << 'PSQL'
  -- Create the database
  CREATE DATABASE dblchlogfpphbb;

  -- Create the user with the password from our .env
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'uediod4tibjcn') THEN
      CREATE USER uediod4tibjcn WITH PASSWORD '@*21i_o11b1v';
    END IF;
  END
  $$;

  -- Grant full access to the database
  GRANT ALL PRIVILEGES ON DATABASE dblchlogfpphbb TO uediod4tibjcn;

  -- Grant schema permissions (required in PostgreSQL 15+)
  \c dblchlogfpphbb
  GRANT ALL ON SCHEMA public TO uediod4tibjcn;
PSQL

echo "      PostgreSQL ready."

# ── 4. APP DIRECTORY ──
echo "[4/7] Creating app directory..."
mkdir -p /var/www/theepsteinindex
# We'll deploy the app files here via SFTP from the local machine

# ── 5. NGINX ──
# nginx is a high-performance web server. We use it as a
# "reverse proxy" — it receives all web traffic on ports 80/443
# and forwards it to our Node.js app on port 3000. This lets
# us run multiple apps on one server and handle SSL cleanly.
echo "[5/7] Installing and configuring nginx..."
apt-get install -y nginx -qq

# Write the nginx config for our site
cat > /etc/nginx/sites-available/theepsteinindex.com << 'NGINX'
server {
    listen 80;
    server_name theepsteinindex.com www.theepsteinindex.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Increase max upload size (for any future file handling)
    client_max_body_size 10M;

    # Forward all requests to our Node.js app
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Enable our site and disable the default nginx placeholder
ln -sf /etc/nginx/sites-available/theepsteinindex.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx
echo "      nginx configured."

# ── 6. FIREWALL ──
# Only allow SSH (so we can log in), HTTP and HTTPS traffic.
# Block everything else.
echo "[6/7] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "      Firewall enabled."

# ── 7. CERTBOT (SSL) ──
# Certbot gets a free SSL certificate from Let's Encrypt.
# This enables HTTPS so the site loads as https://theepsteinindex.com
# NOTE: DNS must be pointed at this server before this works.
echo "[7/7] Installing Certbot for SSL..."
apt-get install -y certbot python3-certbot-nginx -qq
echo "      Certbot installed. SSL will be configured after deploy."

echo ""
echo "══════════════════════════════════════════"
echo "  Server setup complete!"
echo "  Next: deploy the app files"
echo "══════════════════════════════════════════"
echo ""
