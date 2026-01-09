# HG Hub - Deployment Guide

## Quick Install

```bash
# Automatische Installation (nach erstem Release)
curl -sL https://raw.githubusercontent.com/Lockerflockig/hub/master/deploy/install.sh | sudo bash

# Lokale Installation (Entwicklung)
cargo build --release
cd frontend && npm install && npm run build && cd ..
sudo ./deploy/install.sh --local
```

## Manuelle Installation

### 1. Voraussetzungen

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nginx sqlite3

# Systembenutzer erstellen
sudo useradd --system --no-create-home --shell /bin/false hghub
```

### 2. Verzeichnisstruktur

```bash
sudo mkdir -p /opt/hg_hub/{bin,data,static,logs,deploy/templates}
sudo chown -R hghub:hghub /opt/hg_hub
```

### 3. Dateien kopieren

```bash
# Binary
sudo cp target/release/hg_hub /opt/hg_hub/bin/
sudo chmod +x /opt/hg_hub/bin/hg_hub

# Static files
sudo cp -r static/* /opt/hg_hub/static/

# Templates
sudo cp -r deploy/templates/* /opt/hg_hub/deploy/templates/
```

### 4. Konfiguration erstellen

```bash
sudo nano /opt/hg_hub/.env
```

```env
# Pflichtfelder
DATABASE_URL=sqlite:/opt/hg_hub/data/hub.db
LOG_LEVEL=info
HOST=127.0.0.1
PORT=3000

# Optional: Discord Bot (siehe unten)
# BOT_TOKEN=...
```

```bash
sudo chown hghub:hghub /opt/hg_hub/.env
sudo chmod 600 /opt/hg_hub/.env
```

### 5. Systemd Service

```bash
sudo cp /opt/hg_hub/deploy/templates/hg-hub.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hg-hub
sudo systemctl start hg-hub
```

### 6. Nginx Reverse Proxy

```bash
# Config anpassen
sudo nano /etc/nginx/sites-available/hg-hub
# SERVER_URL und PORT ersetzen

sudo ln -sf /etc/nginx/sites-available/hg-hub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. SSL Zertifikat (optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Discord Bot Einrichtung

### Bot erstellen

1. Gehe zu https://discord.com/developers/applications
2. Klicke "New Application" und gib einen Namen ein
3. Gehe zu "Bot" im linken Menü
4. Klicke "Add Bot"
5. Kopiere den **Bot Token** (nicht OAuth2 Client Secret!)

### Bot einladen

1. Gehe zu "OAuth2" → "URL Generator"
2. Wähle bei **Scopes**: `bot`
3. Kopiere die URL und öffne sie im Browser
4. Wähle deinen Server aus

**Oder direkt** (Application ID ersetzen):
```
https://discord.com/api/oauth2/authorize?client_id=DEINE_APP_ID&scope=bot
```

Nach dem Einladen: Gib dem Bot einfach eine Rolle auf deinem Server mit den nötigen Berechtigungen (Nachrichten senden, etc.).

### Bot Konfiguration in .env

```env
# Discord Bot Token (vom Developer Portal, NICHT Client Secret)
BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXX

# Pr0game Allianz-ID
ALLY_ID=12345

# Discord Role IDs für Zugriffskontrolle
# (Rechtsklick auf Rolle → "ID kopieren", Developer Mode muss an sein)
ADMIN_ROLE_IDS=123456789012345678
USER_ROLE_IDS=234567890123456789,345678901234567890

# Channel IDs für Bot-Nachrichten
SPY_CHANNEL_ID=456789012345678901
BOT_CHANNEL_ID=567890123456789012
```

### Discord Developer Mode aktivieren

Um Role/Channel IDs zu kopieren:
1. Discord Einstellungen → Erweitert → Entwicklermodus aktivieren
2. Rechtsklick auf Rolle/Channel → "ID kopieren"

---

## Tampermonkey Script

Nach der Installation findest du das Script unter:
```
https://your-domain.com/static/hg-hub.user.js
```

1. Installiere [Tampermonkey](https://www.tampermonkey.net/)
2. Öffne die URL im Browser
3. Klicke "Installieren"
4. Öffne Tampermonkey Dashboard
5. Bearbeite das Script und füge deinen API-Key hinzu:
   ```javascript
   // Im Script nach GM_setValue suchen oder:
   // Tampermonkey → Script → Storage → api_key setzen
   ```

---

## Admin User erstellen (manuell)

Falls der Installer den Admin-User nicht erstellt hat:

```bash
# UUID generieren
API_KEY=$(cat /proc/sys/kernel/random/uuid)

# User in DB einfügen
sqlite3 /opt/hg_hub/data/hub.db << EOF
INSERT INTO users (api_key, player_id, alliance_id, role, language)
VALUES ('$API_KEY', DEINE_PLAYER_ID, DEINE_ALLIANCE_ID, 'admin', 'de');
EOF

echo "Dein API-Key: $API_KEY"
```

---

## Häufige Probleme

### Service startet nicht

```bash
# Logs prüfen
sudo journalctl -u hg-hub -f

# Häufige Ursachen:
# - Port bereits belegt
# - DATABASE_URL falsch
# - Berechtigungsprobleme
```

### Bot antwortet nicht

1. Prüfe ob Token korrekt ist (Bot Token, nicht Client Secret)
2. Prüfe ob Bot dem Server beigetreten ist
3. Prüfe Channel-Berechtigungen
4. Prüfe ob Role IDs korrekt sind

### Certbot schlägt fehl

```bash
# Domain muss auf Server zeigen
dig +short your-domain.com

# Port 80 muss erreichbar sein
sudo ufw allow 80
sudo ufw allow 443
```

---

## Nützliche Befehle

```bash
# Service Status
sudo systemctl status hg-hub

# Logs anzeigen
sudo journalctl -u hg-hub -f

# Neustarten
sudo systemctl restart hg-hub

# Konfiguration bearbeiten
sudo nano /opt/hg_hub/.env
sudo systemctl restart hg-hub

# Update durchführen
sudo /opt/hg_hub/deploy/update.sh

# Rollback nach fehlgeschlagenem Update
sudo /opt/hg_hub/deploy/update.sh --rollback
```

---

## Dateistruktur

```
/opt/hg_hub/
├── bin/
│   └── hg_hub              # Server Binary
├── data/
│   └── hub.db              # SQLite Datenbank
├── static/
│   ├── js/
│   │   └── hg-hub.js       # Frontend Bundle
│   └── hg-hub.user.js      # Tampermonkey Script
├── logs/                   # Log-Dateien
├── deploy/
│   ├── templates/
│   │   ├── hg-hub.service
│   │   ├── nginx.conf
│   │   └── hg-hub.user.js.template
│   └── update.sh
├── backups/                # Update-Backups
├── .env                    # Konfiguration
└── version.txt             # Aktuelle Version
```
