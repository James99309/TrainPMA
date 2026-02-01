#!/bin/bash
set -e

# ============================================================
# TrainPMA NAS Deploy Script
# Target: Synology DS925+ (~/stargirl-reader/)
# Usage:  ssh nas "cd ~/stargirl-reader && bash deploy.sh"
# ============================================================

REPO_URL="https://github.com/James99309/TrainPMA.git"
DEPLOY_DIR="$HOME/stargirl-reader"
BRANCH="main"
DOCKER="sudo /usr/local/bin/docker"

# --- Color output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

step() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN} $*${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# --- Pre-flight checks ---
step "1/6 Pre-flight checks"

cd "$DEPLOY_DIR" || { err "Directory $DEPLOY_DIR does not exist"; exit 1; }

command -v git >/dev/null 2>&1 || { err "git is not installed"; exit 1; }
$DOCKER --version >/dev/null 2>&1 || { err "docker is not available (tried: $DOCKER)"; exit 1; }
ok "git and docker available"

if [ ! -f .env ]; then
    warn ".env file not found - backend may fail to start"
fi

if [ ! -d courses ]; then
    warn "courses/ directory not found"
fi

# Record version before deploy
OLD_COMMIT="(none)"
OLD_APP_VERSION="(none)"
if [ -d .git ]; then
    OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "(unknown)")
fi
VERSION_JSON="frontend/public/version.json"
if [ -f "$VERSION_JSON" ]; then
    OLD_APP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$VERSION_JSON" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
fi

# --- Git setup / pull ---
step "2/6 Pulling latest code"

if [ ! -d .git ]; then
    info "No .git found - initializing from remote..."
    git init
    git remote add origin "$REPO_URL"
    git fetch origin "$BRANCH"
    git checkout -f "origin/$BRANCH" -- .
    git reset "origin/$BRANCH"
    ok "Repository initialized"
else
    info "Fetching latest from origin/$BRANCH..."
    git fetch origin "$BRANCH"
fi
git reset --hard "origin/$BRANCH"
ok "Code updated"

NEW_COMMIT=$(git rev-parse --short HEAD)
NEW_APP_VERSION="(unknown)"
if [ -f "$VERSION_JSON" ]; then
    NEW_APP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$VERSION_JSON" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
fi
info "App:    ${OLD_APP_VERSION} -> ${NEW_APP_VERSION}"
info "Commit: ${OLD_COMMIT} -> ${NEW_COMMIT}"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && [ "$OLD_COMMIT" != "(none)" ]; then
    warn "No new commits. Rebuilding anyway..."
fi

# Show recent changes
echo ""
info "Recent commits:"
git log --oneline -5

# --- Build images ---
step "3/6 Building Docker images"

info "Building frontend image..."
$DOCKER build -t trainpma-frontend:latest ./frontend/
ok "Frontend image built"

info "Building backend image..."
$DOCKER build -t trainpma-backend:latest ./backend/
ok "Backend image built"

# --- Restart services ---
step "4/6 Restarting services"

info "Stopping current containers..."
$DOCKER compose down || true

info "Starting containers..."
$DOCKER compose up -d
ok "Containers started"

# --- Cleanup ---
step "5/6 Cleaning up old images"

$DOCKER image prune -f
ok "Unused images removed"

# --- Health check ---
step "6/6 Verifying deployment"

info "Waiting for services to start..."
sleep 5

# Check container status
info "Container status:"
$DOCKER compose ps

# Health check - backend
BACKEND_PORT=5007
HEALTH_URL="http://localhost:${BACKEND_PORT}/api/health"
info "Checking backend health at $HEALTH_URL ..."

RETRIES=3
HEALTHY=false
for i in $(seq 1 $RETRIES); do
    if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    info "Attempt $i/$RETRIES - waiting..."
    sleep 3
done

if $HEALTHY; then
    ok "Backend health check passed"
else
    warn "Backend health check failed (service may still be starting)"
fi

# Health check - frontend
FRONTEND_PORT=8080
info "Checking frontend at http://localhost:${FRONTEND_PORT} ..."
if curl -sf --max-time 5 "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    ok "Frontend is responding"
else
    warn "Frontend not responding (service may still be starting)"
fi

# --- Summary ---
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} Deployment complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  App:      ${OLD_APP_VERSION} -> ${GREEN}${NEW_APP_VERSION}${NC}"
echo -e "  Commit:   ${OLD_COMMIT} -> ${GREEN}${NEW_COMMIT}${NC}"
echo -e "  Branch:   ${BRANCH}"
echo -e "  Frontend: http://localhost:${FRONTEND_PORT}"
echo -e "  Backend:  http://localhost:${BACKEND_PORT}"
echo ""
