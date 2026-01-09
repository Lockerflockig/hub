#!/bin/bash
set -e

# ============================================================================
# HG Hub Installer
# ============================================================================

# Get script directory (for local installs)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/hg_hub"
SERVICE_NAME="hg-hub"
GITHUB_REPO="Lockerflockig/hg_hub"

# Track installation progress for cleanup
INSTALL_STARTED=false
USER_CREATED=false
FILES_INSTALLED=false
SERVICE_CREATED=false
NGINX_CONFIGURED=false

# ============================================================================
# Cleanup on error/abort
# ============================================================================

cleanup() {
    local exit_code=$?

    if [ "$INSTALL_STARTED" = false ]; then
        exit $exit_code
    fi

    echo ""
    echo -e "${RED}============================================================================${NC}"
    echo -e "${RED}  Installation failed or was interrupted${NC}"
    echo -e "${RED}============================================================================${NC}"
    echo ""

    echo -e "${YELLOW}[>]${NC} Cleaning up partial installation..."

    # Stop service if running
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true

    # Ask user what to do
    echo ""
    echo "Options:"
    echo "  1) Remove all installed files (clean slate)"
    echo "  2) Keep files for debugging"
    echo "  3) Retry installation"
    echo ""
    echo -n "Choose [1-3]: "
    read cleanup_choice < /dev/tty 2>/dev/null || cleanup_choice="2"

    case "$cleanup_choice" in
        1)
            echo -e "${YELLOW}[>]${NC} Removing installed files..."

            # Remove service
            if [ "$SERVICE_CREATED" = true ]; then
                systemctl disable "$SERVICE_NAME" 2>/dev/null || true
                rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
                systemctl daemon-reload 2>/dev/null || true
            fi

            # Remove nginx config
            if [ "$NGINX_CONFIGURED" = true ]; then
                rm -f "/etc/nginx/sites-enabled/hg-hub"
                rm -f "/etc/nginx/sites-available/hg-hub"
                systemctl reload nginx 2>/dev/null || true
            fi

            # Remove install directory
            if [ "$FILES_INSTALLED" = true ]; then
                rm -rf "$INSTALL_DIR"
            fi

            # Remove user
            if [ "$USER_CREATED" = true ]; then
                userdel hghub 2>/dev/null || true
            fi

            # Remove temp files
            rm -f /tmp/hg_hub.tar.gz

            echo -e "${GREEN}[OK]${NC} Cleanup complete"
            ;;
        2)
            echo -e "${YELLOW}[>]${NC} Files kept at: $INSTALL_DIR"
            echo -e "${YELLOW}[>]${NC} Check logs and re-run installer when ready"
            ;;
        3)
            echo -e "${YELLOW}[>]${NC} Re-running installer..."
            exec "$0" "$@"
            ;;
    esac

    exit $exit_code
}

# Set trap for errors and interrupts
trap cleanup ERR INT TERM

# Parse arguments
LOCAL_INSTALL=false
for arg in "$@"; do
    case $arg in
        --local|-l)
            LOCAL_INSTALL=true
            ;;
    esac
done

# ============================================================================
# Helper functions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[>]${NC} $1"
}

ask_yes_no() {
    local prompt="$1"
    local default="$2"
    local answer

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    # Read from /dev/tty to support curl | bash
    echo -n "$prompt"
    read answer < /dev/tty
    answer=${answer:-$default}

    case "$answer" in
        [Yy]* ) return 0 ;;
        * ) return 1 ;;
    esac
}

# Read input (works with curl | bash)
read_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    if [ -n "$default" ]; then
        echo -n "$prompt [$default]: "
    else
        echo -n "$prompt: "
    fi

    read value < /dev/tty
    value=${value:-$default}
    eval "$var_name=\"\$value\""
}

generate_uuid() {
    # Generate UUID v4
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        cat /proc/sys/kernel/random/uuid
    fi
}

# Run command as another user (works without sudo)
run_as_user() {
    local user="$1"
    shift
    if command -v sudo &> /dev/null; then
        sudo -u "$user" "$@"
    elif command -v runuser &> /dev/null; then
        runuser -u "$user" -- "$@"
    else
        su -s /bin/sh "$user" -c "$*"
    fi
}

# ============================================================================
# Check prerequisites
# ============================================================================

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (sudo)"
        exit 1
    fi
    print_success "Running as root"

    # Check what's running on port 80
    PORT_80_PROCESS=$(ss -tlnp '( sport = :80 )' 2>/dev/null | grep -oP '(?<=users:\(\(")[^"]+' | head -1 || true)

    if [ -n "$PORT_80_PROCESS" ]; then
        print_info "Port 80 is in use by: $PORT_80_PROCESS"

        if [ "$PORT_80_PROCESS" = "nginx" ]; then
            print_success "nginx is already running - will add site config"
            NGINX_INSTALLED=true
            NGINX_RUNNING=true
        elif [ "$PORT_80_PROCESS" = "apache2" ] || [ "$PORT_80_PROCESS" = "httpd" ]; then
            print_warning "Apache is running on port 80"
            echo ""
            echo "Options:"
            echo "  1) Stop Apache and use nginx instead"
            echo "  2) Skip reverse proxy setup (manual config needed)"
            echo "  3) Cancel installation"
            echo ""
            echo -n "Choose [1-3]: "
            read choice < /dev/tty
            case "$choice" in
                1)
                    systemctl stop apache2 2>/dev/null || systemctl stop httpd 2>/dev/null || true
                    systemctl disable apache2 2>/dev/null || systemctl disable httpd 2>/dev/null || true
                    print_success "Apache stopped"
                    NGINX_INSTALLED=false
                    ;;
                2)
                    print_warning "Skipping nginx setup - you'll need to configure reverse proxy manually"
                    NGINX_INSTALLED=false
                    SKIP_REVERSE_PROXY=true
                    ;;
                *)
                    echo "Installation cancelled."
                    exit 0
                    ;;
            esac
        else
            print_warning "Unknown service '$PORT_80_PROCESS' is using port 80"
            if ! ask_yes_no "Continue without reverse proxy setup?" "n"; then
                exit 0
            fi
            SKIP_REVERSE_PROXY=true
            NGINX_INSTALLED=false
        fi
    fi

    # Check/install nginx if needed
    if [ "$SKIP_REVERSE_PROXY" != "true" ]; then
        if command -v nginx &> /dev/null; then
            print_success "nginx is installed"
            NGINX_INSTALLED=true
        else
            print_warning "nginx is not installed"
            if ask_yes_no "Install nginx?" "y"; then
                apt-get update && apt-get install -y nginx
                print_success "nginx installed"
                NGINX_INSTALLED=true
            else
                NGINX_INSTALLED=false
            fi
        fi
    fi

    # Check sqlite3
    if command -v sqlite3 &> /dev/null; then
        print_success "sqlite3 is installed"
    else
        print_warning "sqlite3 is not installed"
        apt-get update && apt-get install -y sqlite3
        print_success "sqlite3 installed"
    fi
}

# ============================================================================
# Download latest release (or use local files in dev mode)
# ============================================================================

download_release() {
    # Check for local/dev mode
    if [ "$LOCAL_INSTALL" = "true" ] || [ -f "$SCRIPT_DIR/../target/release/hg_hub" ]; then
        print_header "Local Installation Mode"

        if [ ! -f "$SCRIPT_DIR/../target/release/hg_hub" ]; then
            print_error "Binary not found. Build first with: cargo build --release"
            exit 1
        fi

        VERSION="dev-local"
        USE_LOCAL=true
        print_success "Using local build"
        return
    fi

    print_header "Downloading HG Hub"

    # Setup auth header for private repos
    AUTH_HEADER=""
    if [ -n "$GH_TOKEN" ]; then
        AUTH_HEADER="Authorization: token $GH_TOKEN"
        print_info "Using GitHub token for authentication"
    fi

    # Get latest release info
    print_info "Fetching latest release from GitHub..."

    if [ -n "$AUTH_HEADER" ]; then
        LATEST_RELEASE=$(curl -sH "$AUTH_HEADER" "https://api.github.com/repos/${GITHUB_REPO}/releases/latest")
    else
        LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest")
    fi

    VERSION=$(echo "$LATEST_RELEASE" | grep -Po '"tag_name": "\K[^"]*')
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -Po '"browser_download_url": "\K[^"]*linux-x64\.tar\.gz')

    if [ -z "$VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
        print_error "Could not find latest release with binary asset."
        echo ""
        if echo "$LATEST_RELEASE" | grep -q "Not Found"; then
            print_info "Repository not found or private. Set GH_TOKEN for private repos:"
            echo "    export GH_TOKEN=ghp_xxxx"
        else
            print_info "Release found but no binary asset. Make sure GitHub Actions completed."
            print_info "Current release only has: $(echo "$LATEST_RELEASE" | grep -Po '"name": "\K[^"]*' | head -3 | tr '\n' ' ')"
        fi
        echo ""
        print_info "For local development, build first and run:"
        echo "    cargo build --release"
        echo "    ./deploy/install.sh --local"
        exit 1
    fi

    print_info "Latest version: $VERSION"
    print_info "Downloading..."

    # For private repos, we need to use the asset API with Accept header
    ASSET_ID=$(echo "$LATEST_RELEASE" | grep -B5 'linux-x64\.tar\.gz' | grep -Po '"id": \K[0-9]+' | head -1)

    if [ -n "$ASSET_ID" ] && [ -n "$AUTH_HEADER" ]; then
        # Use asset API for private repos
        ASSET_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${ASSET_ID}"
        curl -LH "$AUTH_HEADER" -H "Accept: application/octet-stream" "$ASSET_URL" -o /tmp/hg_hub.tar.gz
    elif [ -n "$AUTH_HEADER" ]; then
        # Fallback: try browser URL with auth
        curl -LH "$AUTH_HEADER" -H "Accept: application/octet-stream" "$DOWNLOAD_URL" -o /tmp/hg_hub.tar.gz
    else
        # Public repo - direct download
        curl -L "$DOWNLOAD_URL" -o /tmp/hg_hub.tar.gz
    fi

    # Validate the download
    if [ ! -f /tmp/hg_hub.tar.gz ]; then
        print_error "Download failed - file not created"
        exit 1
    fi

    FILE_SIZE=$(stat -c%s /tmp/hg_hub.tar.gz 2>/dev/null || stat -f%z /tmp/hg_hub.tar.gz 2>/dev/null)
    if [ "$FILE_SIZE" -lt 1000 ]; then
        print_error "Download failed - file too small (${FILE_SIZE} bytes)"
        print_info "This usually means the release asset doesn't exist yet."
        print_info "Check if GitHub Actions completed successfully for version $VERSION"
        cat /tmp/hg_hub.tar.gz 2>/dev/null  # Show error response
        rm -f /tmp/hg_hub.tar.gz
        exit 1
    fi

    # Verify it's actually a gzip file
    if ! gzip -t /tmp/hg_hub.tar.gz 2>/dev/null; then
        print_error "Downloaded file is not a valid gzip archive"
        print_info "Content received:"
        head -c 200 /tmp/hg_hub.tar.gz
        rm -f /tmp/hg_hub.tar.gz
        exit 1
    fi

    print_success "Download complete"
}

# ============================================================================
# Install files
# ============================================================================

install_files() {
    print_header "Installing Files"

    # Create system user if not exists
    if ! id "hghub" &>/dev/null; then
        useradd --system --no-create-home --shell /bin/false hghub
        USER_CREATED=true
        print_success "Created system user 'hghub'"
    fi

    # Create directory structure
    mkdir -p "$INSTALL_DIR"/{bin,data,static,logs,deploy/templates}
    print_success "Created directory structure"

    if [ "$USE_LOCAL" = "true" ]; then
        # Local installation - copy from source directory
        print_info "Copying local files..."

        # Main binary (includes integrated Discord bot)
        cp "$SCRIPT_DIR/../target/release/hg_hub" "$INSTALL_DIR/bin/"

        # Static files
        cp -r "$SCRIPT_DIR/../static/"* "$INSTALL_DIR/static/"

        # Deploy templates
        cp -r "$SCRIPT_DIR/templates/"* "$INSTALL_DIR/deploy/templates/"
        cp "$SCRIPT_DIR/update.sh" "$INSTALL_DIR/deploy/"
    else
        # Extract from downloaded tarball
        print_info "Extracting files..."
        tar -xzf /tmp/hg_hub.tar.gz -C "$INSTALL_DIR"

        # Move binary to correct location
        if [ -f "$INSTALL_DIR/hg_hub" ]; then
            mv "$INSTALL_DIR/hg_hub" "$INSTALL_DIR/bin/"
        fi
    fi

    chmod +x "$INSTALL_DIR/bin/hg_hub"
    chmod +x "$INSTALL_DIR/deploy/update.sh" 2>/dev/null || true

    # Set ownership
    chown -R hghub:hghub "$INSTALL_DIR"
    chmod 750 "$INSTALL_DIR"

    FILES_INSTALLED=true
    print_success "Files installed to $INSTALL_DIR"
}

# ============================================================================
# Configure application
# ============================================================================

configure_application() {
    print_header "Configuration"

    # Server URL
    echo ""
    echo -n "Enter your server domain (e.g., hg-hub.example.com): "
    read SERVER_URL < /dev/tty
    while [ -z "$SERVER_URL" ]; do
        print_error "Server URL cannot be empty"
        echo -n "Enter your server domain: "
        read SERVER_URL < /dev/tty
    done
    # Strip protocol if user included it
    SERVER_URL=$(echo "$SERVER_URL" | sed -e 's|^https://||' -e 's|^http://||' -e 's|/$||')

    # Game URL (for Tampermonkey @match)
    echo ""
    print_info "Enter the pr0game URL you want to use (e.g., pr0game.com/uni6)"
    echo -n "Game URL [pr0game.com/uni6]: "
    read GAME_URL < /dev/tty
    GAME_URL=${GAME_URL:-"pr0game.com/uni6"}
    # Strip protocol if user included it
    GAME_URL=$(echo "$GAME_URL" | sed -e 's|^https://||' -e 's|^http://||')

    # Port - check if already in use
    DEFAULT_PORT=3000
    while true; do
        echo -n "Backend port [$DEFAULT_PORT]: "
        read PORT < /dev/tty
        PORT=${PORT:-$DEFAULT_PORT}

        # Check if port is in use
        if ss -tlnp "( sport = :$PORT )" 2>/dev/null | grep -q ":$PORT"; then
            PORT_USER=$(ss -tlnp "( sport = :$PORT )" 2>/dev/null | grep -oP '(?<=users:\(\(")[^"]+' | head -1)
            print_warning "Port $PORT is already in use by: $PORT_USER"
            DEFAULT_PORT=$((PORT + 1))
            print_info "Suggested alternative: $DEFAULT_PORT"
        else
            print_success "Port $PORT is available"
            break
        fi
    done

    # Create .env file
    print_info "Creating .env configuration..."
    cat > "$INSTALL_DIR/.env" << EOF
# HG Hub Configuration
# Generated by installer on $(date)

DATABASE_URL=sqlite:data/hub.db?mode=rwc
LOG_LEVEL=info
HOST=127.0.0.1
PORT=$PORT
EOF

    # Discord bot configuration
    echo ""
    if ask_yes_no "Configure Discord bot?" "n"; then
        configure_discord_bot
    fi

    chown hghub:hghub "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"

    print_success "Configuration saved"
}

configure_discord_bot() {
    echo ""
    print_header "Discord Bot Configuration"

    echo -n "Discord Bot Token: "
    read BOT_TOKEN < /dev/tty
    echo -n "Alliance ID (pr0game): "
    read ALLY_ID < /dev/tty
    echo -n "Admin Role IDs (comma-separated): "
    read ADMIN_ROLE_IDS < /dev/tty
    echo -n "User Role IDs (comma-separated): "
    read USER_ROLE_IDS < /dev/tty
    echo -n "Spy Channel ID: "
    read SPY_CHANNEL_ID < /dev/tty
    echo -n "Bot Channel ID: "
    read BOT_CHANNEL_ID < /dev/tty

    cat >> "$INSTALL_DIR/.env" << EOF

# Discord Bot Configuration
BOT_TOKEN=$BOT_TOKEN
ALLY_ID=$ALLY_ID
ADMIN_ROLE_IDS=$ADMIN_ROLE_IDS
USER_ROLE_IDS=$USER_ROLE_IDS
SPY_CHANNEL_ID=$SPY_CHANNEL_ID
BOT_CHANNEL_ID=$BOT_CHANNEL_ID
EOF

    print_success "Discord bot configured"
}

# ============================================================================
# Initialize database
# ============================================================================

init_database() {
    print_header "Initializing Database"

    # Ensure data directory exists and is writable
    mkdir -p "$INSTALL_DIR/data"
    chown hghub:hghub "$INSTALL_DIR/data"
    chmod 750 "$INSTALL_DIR/data"

    # Start server briefly to run migrations
    print_info "Running database migrations..."

    # Run the binary in the install directory with proper environment
    cd "$INSTALL_DIR"

    # Create a small runner script to ensure correct working directory
    cat > /tmp/hg_hub_init.sh << 'INITEOF'
#!/bin/bash
cd "$1"
timeout 10 "$1/bin/hg_hub" || true
INITEOF
    chmod +x /tmp/hg_hub_init.sh

    run_as_user hghub /tmp/hg_hub_init.sh "$INSTALL_DIR" &
    SERVER_PID=$!
    sleep 3

    # Kill the server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    rm -f /tmp/hg_hub_init.sh

    if [ -f "$INSTALL_DIR/data/hub.db" ]; then
        print_success "Database initialized"
    else
        print_error "Database initialization failed"
        print_info "Check permissions on $INSTALL_DIR/data"
        print_info "Try running manually: cd $INSTALL_DIR && ./bin/hg_hub"
        exit 1
    fi
}

# ============================================================================
# Create admin user
# ============================================================================

create_admin_user() {
    print_header "Create Admin User"

    echo ""
    print_info "The admin user needs your in-game IDs to link your account."
    echo ""

    echo -n "Your Player Name (from pr0game): "
    read PLAYER_NAME < /dev/tty
    while [ -z "$PLAYER_NAME" ]; do
        print_error "Player name cannot be empty"
        echo -n "Your Player Name: "
        read PLAYER_NAME < /dev/tty
    done

    echo -n "Your Player ID (from pr0game): "
    read PLAYER_ID < /dev/tty
    while ! [[ "$PLAYER_ID" =~ ^[0-9]+$ ]]; do
        print_error "Player ID must be a number"
        echo -n "Your Player ID: "
        read PLAYER_ID < /dev/tty
    done

    # Use Alliance ID from Discord bot config if already set
    if [ -n "$ALLY_ID" ] && [[ "$ALLY_ID" =~ ^[0-9]+$ ]]; then
        ALLIANCE_ID="$ALLY_ID"
        print_info "Using Alliance ID from Discord bot config: $ALLIANCE_ID"
    else
        echo -n "Your Alliance ID (from pr0game): "
        read ALLIANCE_ID < /dev/tty
        while ! [[ "$ALLIANCE_ID" =~ ^[0-9]+$ ]]; do
            print_error "Alliance ID must be a number"
            echo -n "Your Alliance ID: "
            read ALLIANCE_ID < /dev/tty
        done
    fi

    # Generate API key
    API_KEY=$(generate_uuid)

    # Insert into database - alliance (placeholder name/tag), player, and user
    sqlite3 "$INSTALL_DIR/data/hub.db" << EOF
INSERT OR IGNORE INTO alliances (id, name, tag) VALUES ($ALLIANCE_ID, 'Alliance $ALLIANCE_ID', '???');
INSERT OR IGNORE INTO players (id, name, alliance_id) VALUES ($PLAYER_ID, '$PLAYER_NAME', $ALLIANCE_ID);
INSERT INTO users (api_key, player_id, alliance_id, role, language)
VALUES ('$API_KEY', $PLAYER_ID, $ALLIANCE_ID, 'admin', 'de');
EOF

    print_success "Admin user created"

    # Store API key to display later
    ADMIN_API_KEY="$API_KEY"
}

# ============================================================================
# Setup systemd service
# ============================================================================

setup_service() {
    print_header "Setting up Systemd Service"

    # Copy service file
    cp "$INSTALL_DIR/deploy/templates/hg-hub.service" "/etc/systemd/system/${SERVICE_NAME}.service"
    SERVICE_CREATED=true

    # Reload systemd
    systemctl daemon-reload

    # Enable and start service
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"

    # Check status
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service started successfully"
    else
        print_error "Service failed to start. Check: journalctl -u $SERVICE_NAME"
        exit 1
    fi
}

# ============================================================================
# Setup nginx
# ============================================================================

setup_nginx() {
    if [ "$SKIP_REVERSE_PROXY" = "true" ]; then
        print_warning "Skipping nginx setup (manual configuration required)"
        echo ""
        print_info "To configure your reverse proxy manually, proxy requests to:"
        echo "    http://127.0.0.1:$PORT"
        echo ""
        return
    fi

    if [ "$NGINX_INSTALLED" != "true" ]; then
        print_warning "Skipping nginx setup (not installed)"
        return
    fi

    print_header "Setting up Nginx"

    NGINX_CONF="/etc/nginx/sites-available/hg-hub"
    NGINX_ENABLED="/etc/nginx/sites-enabled/hg-hub"
    BACKUP_DIR="/etc/nginx/backup-$(date +%Y%m%d-%H%M%S)"

    # Check if config already exists
    if [ -f "$NGINX_CONF" ]; then
        print_warning "nginx config for hg-hub already exists!"
        echo ""
        echo "Options:"
        echo "  1) Backup and overwrite"
        echo "  2) Skip nginx setup (keep existing)"
        echo "  3) View existing config"
        echo ""
        echo -n "Choose [1-3]: "
        read nginx_choice < /dev/tty
        case "$nginx_choice" in
            1)
                mkdir -p "$BACKUP_DIR"
                cp "$NGINX_CONF" "$BACKUP_DIR/hg-hub.conf.bak"
                print_info "Backup saved to: $BACKUP_DIR/hg-hub.conf.bak"
                ;;
            2)
                print_info "Keeping existing nginx config"
                NGINX_CONFIGURED=true
                return
                ;;
            3)
                cat "$NGINX_CONF"
                echo ""
                if ! ask_yes_no "Overwrite this config?" "n"; then
                    return
                fi
                mkdir -p "$BACKUP_DIR"
                cp "$NGINX_CONF" "$BACKUP_DIR/hg-hub.conf.bak"
                ;;
            *)
                return
                ;;
        esac
    fi

    # Create backup of entire nginx sites config before any changes
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        cp -r /etc/nginx/sites-available "$BACKUP_DIR/" 2>/dev/null || true
        cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/" 2>/dev/null || true
        print_info "nginx backup created at: $BACKUP_DIR"
    fi

    # Generate nginx config from template
    print_info "Generating nginx config for: $SERVER_URL"

    sed -e "s|{{SERVER_URL}}|$SERVER_URL|g" \
        -e "s|{{PORT}}|$PORT|g" \
        "$INSTALL_DIR/deploy/templates/nginx.conf" > "$NGINX_CONF"

    # Enable site (only hg-hub, don't touch other sites)
    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

    # Test config BEFORE reload
    print_info "Testing nginx configuration..."
    if nginx -t 2>&1; then
        systemctl reload nginx
        NGINX_CONFIGURED=true
        print_success "Nginx configured successfully"
    else
        print_error "Nginx config test failed!"
        echo ""
        print_info "Restoring from backup..."
        rm -f "$NGINX_CONF" "$NGINX_ENABLED"
        if [ -d "$BACKUP_DIR/sites-available" ]; then
            cp -r "$BACKUP_DIR/sites-available/"* /etc/nginx/sites-available/ 2>/dev/null || true
        fi
        if [ -d "$BACKUP_DIR/sites-enabled" ]; then
            cp -r "$BACKUP_DIR/sites-enabled/"* /etc/nginx/sites-enabled/ 2>/dev/null || true
        fi
        systemctl reload nginx 2>/dev/null || true
        print_warning "Original config restored. Please configure nginx manually."
        return
    fi

    # Certbot
    echo ""
    if ask_yes_no "Setup SSL with Let's Encrypt (certbot)?" "y"; then
        setup_ssl
    fi
}

setup_ssl() {
    print_header "SSL Certificate Setup (Let's Encrypt)"

    if ! command -v certbot &> /dev/null; then
        print_info "Installing certbot..."
        apt-get install -y certbot python3-certbot-nginx
    fi

    echo ""
    print_info "Certbot will:"
    echo "  1. Verify domain ownership (your server must be reachable on port 80)"
    echo "  2. Obtain SSL certificate from Let's Encrypt"
    echo "  3. Automatically configure nginx for HTTPS"
    echo "  4. Set up auto-renewal (certificates expire after 90 days)"
    echo ""

    # Email for renewal notifications (optional but recommended)
    echo -n "Email for renewal notifications (optional, press Enter to skip): "
    read CERT_EMAIL < /dev/tty

    print_info "Requesting certificate for: $SERVER_URL"

    if [ -n "$CERT_EMAIL" ]; then
        certbot --nginx -d "$SERVER_URL" --non-interactive --agree-tos --email "$CERT_EMAIL" && {
            print_success "SSL certificate installed!"
            print_info "Auto-renewal is enabled. Certificates renew automatically."
        } || {
            print_warning "Certbot failed. Common issues:"
            echo "  - Domain doesn't point to this server"
            echo "  - Port 80 not reachable (firewall?)"
            echo "  - DNS not propagated yet"
            echo ""
            echo "Run manually later: certbot --nginx -d $SERVER_URL"
        }
    else
        certbot --nginx -d "$SERVER_URL" --non-interactive --agree-tos --register-unsafely-without-email && {
            print_success "SSL certificate installed!"
            print_info "Auto-renewal is enabled. Certificates renew automatically."
        } || {
            print_warning "Certbot failed. Run manually: certbot --nginx -d $SERVER_URL"
        }
    fi

    # Verify auto-renewal timer
    if systemctl is-active --quiet certbot.timer; then
        print_success "Auto-renewal timer is active"
    fi
}

# ============================================================================
# Generate Tampermonkey script
# ============================================================================

generate_tampermonkey_script() {
    print_header "Generating Tampermonkey Script"

    # Determine protocol
    if [ -f "/etc/letsencrypt/live/$SERVER_URL/fullchain.pem" ]; then
        API_PROTOCOL="https"
    else
        API_PROTOCOL="http"
    fi

    API_URL="${API_PROTOCOL}://${SERVER_URL}"
    SERVER_HOST=$(echo "$SERVER_URL" | cut -d'/' -f1)

    # Generate script from template
    sed -e "s|{{SERVER_URL}}|$SERVER_URL|g" \
        -e "s|{{GAME_URL}}|$GAME_URL|g" \
        -e "s|{{VERSION}}|$VERSION|g" \
        -e "s|{{API_URL}}|$API_URL|g" \
        -e "s|{{SERVER_HOST}}|$SERVER_HOST|g" \
        "$INSTALL_DIR/deploy/templates/hg-hub.user.js.template" > "$INSTALL_DIR/static/hg-hub.user.js"

    chown hghub:hghub "$INSTALL_DIR/static/hg-hub.user.js"

    print_success "Tampermonkey script generated"
}

# ============================================================================
# Installation complete
# ============================================================================

print_summary() {
    print_header "Installation Complete!"

    echo -e "${GREEN}HG Hub has been installed successfully!${NC}\n"

    echo "Installation directory: $INSTALL_DIR"
    echo "Service name: $SERVICE_NAME"
    echo "Version: $VERSION"
    echo ""

    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  YOUR ADMIN API KEY (SAVE THIS!)${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    echo -e "  ${GREEN}$ADMIN_API_KEY${NC}"
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo ""

    echo "Next steps:"
    echo "  1. Install the Tampermonkey script in your browser:"
    echo "     ${API_URL}/static/hg-hub.user.js"
    echo ""
    echo "  2. Open Tampermonkey settings and add your API key"
    echo ""
    echo "  3. Visit pr0game and the hub should load automatically"
    echo ""

    echo "Useful commands:"
    echo "  - View logs:    journalctl -u $SERVICE_NAME -f"
    echo "  - Restart:      systemctl restart $SERVICE_NAME"
    echo "  - Status:       systemctl status $SERVICE_NAME"
    echo "  - Update:       $INSTALL_DIR/deploy/update.sh"
}

# ============================================================================
# Main
# ============================================================================

main() {
    print_header "HG Hub Installer"
    echo "This script will install HG Hub on your server."
    echo ""

    if ! ask_yes_no "Continue with installation?" "y"; then
        echo "Installation cancelled."
        exit 0
    fi

    INSTALL_STARTED=true
    check_prerequisites
    download_release
    install_files
    configure_application
    init_database
    create_admin_user
    setup_service
    setup_nginx
    generate_tampermonkey_script
    print_summary
}

main "$@"
