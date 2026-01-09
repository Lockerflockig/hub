#!/bin/bash
set -e

# ============================================================================
# HG Hub Update Script
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/hg_hub"
SERVICE_NAME="hg-hub"
GITHUB_REPO="Lockerflockig/hg_hub"
BACKUP_DIR="$INSTALL_DIR/backups"

print_header() {
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================================${NC}\n"
}

print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_info() { echo -e "${BLUE}[>]${NC} $1"; }

# ============================================================================
# Check version
# ============================================================================

check_version() {
    print_header "Checking for Updates"

    # Current version
    if [ -f "$INSTALL_DIR/version.txt" ]; then
        CURRENT_VERSION=$(cat "$INSTALL_DIR/version.txt")
    else
        CURRENT_VERSION="unknown"
    fi
    print_info "Current version: $CURRENT_VERSION"

    # Setup auth header for private repos
    AUTH_HEADER=""
    if [ -n "$GH_TOKEN" ]; then
        AUTH_HEADER="Authorization: token $GH_TOKEN"
        print_info "Using GitHub token for authentication"
    fi

    # Latest version
    if [ -n "$AUTH_HEADER" ]; then
        LATEST_RELEASE=$(curl -sfH "$AUTH_HEADER" "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null || echo '{}')
    else
        LATEST_RELEASE=$(curl -sf "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null || echo '{}')
    fi

    # Parse response (use || true to prevent set -e from exiting)
    LATEST_VERSION=$(echo "$LATEST_RELEASE" | grep -Po '"tag_name": "\K[^"]*' || true)
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -Po '"browser_download_url": "\K[^"]*linux-x64\.tar\.gz' || true)

    if [ -z "$LATEST_VERSION" ]; then
        print_error "Could not fetch latest version from GitHub"
        if echo "$LATEST_RELEASE" | grep -q "Not Found"; then
            print_info "No releases found. Create a release first by pushing a tag:"
            echo "    git tag v1.6.0 && git push origin v1.6.0"
            print_info "Or repository is private. Set GH_TOKEN for private repos:"
            echo "    export GH_TOKEN=ghp_xxxx"
        else
            print_info "API Response: $LATEST_RELEASE"
        fi
        exit 1
    fi

    print_info "Latest version: $LATEST_VERSION"

    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
        print_success "Already running latest version!"
        exit 0
    fi

    echo ""
    echo -n "Update from $CURRENT_VERSION to $LATEST_VERSION? [Y/n]: "
    read answer < /dev/tty
    answer=${answer:-y}
    case "$answer" in
        [Yy]* ) ;;
        * ) echo "Update cancelled."; exit 0 ;;
    esac
}

# ============================================================================
# Backup
# ============================================================================

create_backup() {
    print_header "Creating Backup"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

    mkdir -p "$BACKUP_PATH"

    # Backup database
    cp "$INSTALL_DIR/data/hub.db" "$BACKUP_PATH/"
    print_success "Database backed up"

    # Backup .env
    cp "$INSTALL_DIR/.env" "$BACKUP_PATH/"
    print_success ".env backed up"

    # Backup current binary
    cp "$INSTALL_DIR/bin/hg_hub" "$BACKUP_PATH/"
    print_success "Binary backed up"

    # Store current version
    echo "$CURRENT_VERSION" > "$BACKUP_PATH/version.txt"

    print_success "Backup created at: $BACKUP_PATH"

    # Cleanup old backups (keep last 5)
    ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
}

# ============================================================================
# Download and update
# ============================================================================

download_and_update() {
    print_header "Downloading Update"

    # Download (with auth for private repos)
    print_info "Downloading $LATEST_VERSION..."

    # For private repos, use the asset API
    ASSET_ID=$(echo "$LATEST_RELEASE" | grep -B5 'linux-x64\.tar\.gz' | grep -Po '"id": \K[0-9]+' | head -1 || true)

    if [ -n "$ASSET_ID" ] && [ -n "$AUTH_HEADER" ]; then
        ASSET_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${ASSET_ID}"
        curl -LH "$AUTH_HEADER" -H "Accept: application/octet-stream" "$ASSET_URL" -o /tmp/hg_hub_update.tar.gz
    elif [ -n "$AUTH_HEADER" ]; then
        curl -LH "$AUTH_HEADER" -H "Accept: application/octet-stream" "$DOWNLOAD_URL" -o /tmp/hg_hub_update.tar.gz
    else
        curl -L "$DOWNLOAD_URL" -o /tmp/hg_hub_update.tar.gz
    fi

    # Stop service
    print_info "Stopping service..."
    systemctl stop "$SERVICE_NAME"

    # Extract to temp
    print_info "Extracting..."
    mkdir -p /tmp/hg_hub_update
    tar -xzf /tmp/hg_hub_update.tar.gz -C /tmp/hg_hub_update

    # Update main binary (includes integrated Discord bot)
    mv /tmp/hg_hub_update/hg_hub "$INSTALL_DIR/bin/"
    chmod +x "$INSTALL_DIR/bin/hg_hub"
    chown hghub:hghub "$INSTALL_DIR/bin/hg_hub"
    print_success "Binary updated"

    # Update static files
    cp -r /tmp/hg_hub_update/static/* "$INSTALL_DIR/static/"
    chown -R hghub:hghub "$INSTALL_DIR/static"
    print_success "Static files updated"

    # Update version
    echo "$LATEST_VERSION" > "$INSTALL_DIR/version.txt"

    # Cleanup
    rm -rf /tmp/hg_hub_update /tmp/hg_hub_update.tar.gz

    print_success "Files updated"
}

# ============================================================================
# Start service
# ============================================================================

start_service() {
    print_header "Starting Service"

    systemctl start "$SERVICE_NAME"
    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service started successfully"
    else
        print_error "Service failed to start!"
        print_warning "Rolling back..."
        rollback
        exit 1
    fi
}

# ============================================================================
# Rollback
# ============================================================================

rollback() {
    print_header "Rolling Back"

    # Get latest backup
    LATEST_BACKUP=$(ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        print_error "No backup found to rollback!"
        exit 1
    fi

    print_info "Restoring from: $LATEST_BACKUP"

    # Stop service
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true

    # Restore files
    cp "$LATEST_BACKUP/hg_hub" "$INSTALL_DIR/bin/"
    cp "$LATEST_BACKUP/hub.db" "$INSTALL_DIR/data/"
    cp "$LATEST_BACKUP/version.txt" "$INSTALL_DIR/"

    chown hghub:hghub "$INSTALL_DIR/bin/hg_hub"
    chown hghub:hghub "$INSTALL_DIR/data/hub.db"

    # Start service
    systemctl start "$SERVICE_NAME"

    print_success "Rollback complete"
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Check root
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (sudo)"
        exit 1
    fi

    # Check if installed
    if [ ! -f "$INSTALL_DIR/bin/hg_hub" ]; then
        print_error "HG Hub is not installed. Run install.sh first."
        exit 1
    fi

    case "${1:-}" in
        --rollback)
            rollback
            ;;
        --check)
            check_version
            ;;
        *)
            check_version
            create_backup
            download_and_update
            start_service
            print_header "Update Complete!"
            echo "Updated to version: $LATEST_VERSION"
            echo ""
            echo "If something is wrong, run: $0 --rollback"
            ;;
    esac
}

main "$@"
