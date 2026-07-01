#!/usr/bin/env bash
#
# start-all.sh — bring up the whole feature-flag stack for local development.
#
# What it does:
#   1. Starts a PostgreSQL 16 database (Docker Compose, with a Podman fallback).
#   2. Runs the backend migrations (create tables + seed roles).
#   3. Launches the backend and the single role-based Next.js frontend.
#
# Service URLs:
#   backend   -> http://localhost:4000
#   frontend  -> http://localhost:3000
#
# Database (host port 5544 -> container 5432):
#   postgres://ffuser:ffpass@localhost:5544/featureflags
#
# Stop everything later with: kill the printed PIDs (or Ctrl-C this script),
# and stop the db with `docker compose down` / `podman rm -f ff-db`.

set -u

# Resolve the project root (the directory this script lives in).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Collect background PIDs so we can report (and optionally clean up) them.
PIDS=()

# ---------------------------------------------------------------------------
# 1. Start the database
# ---------------------------------------------------------------------------
echo "==> Starting PostgreSQL (featureflags) on host port 5544 ..."

if docker compose up -d db >/dev/null 2>&1; then
  echo "    Database started via 'docker compose'."
else
  echo "    'docker compose up -d db' failed; falling back to Podman."

  # Reuse an already-running container if present; skip starting a new one.
  if podman ps --format '{{.Names}}' 2>/dev/null | grep -qx ff-db; then
    echo "    Podman container 'ff-db' is already running; skipping."
  elif podman ps -a --format '{{.Names}}' 2>/dev/null | grep -qx ff-db; then
    echo "    Podman container 'ff-db' exists but is stopped; starting it."
    podman start ff-db >/dev/null
  else
    echo "    Launching a new Podman 'ff-db' container."
    podman run -d \
      --name ff-db \
      -e POSTGRES_USER=ffuser \
      -e POSTGRES_PASSWORD=ffpass \
      -e POSTGRES_DB=featureflags \
      -p 5544:5432 \
      postgres:16 >/dev/null
  fi
fi

# Give Postgres a moment to accept connections before migrating.
echo "==> Waiting for the database to become ready ..."
sleep 5

# ---------------------------------------------------------------------------
# 2. Run backend migrations (create tables + seed roles)
# ---------------------------------------------------------------------------
echo "==> Running backend migrations ..."
( cd "$ROOT/backend" && npm run migrate )

# ---------------------------------------------------------------------------
# 3. Launch backend + frontends in the background
# ---------------------------------------------------------------------------
echo "==> Starting backend (http://localhost:4000) ..."
( cd "$ROOT/backend" && npm run dev ) &
PIDS+=("$!")

echo "==> Starting frontend (http://localhost:3000) ..."
( cd "$ROOT/frontend" && npm run dev ) &
PIDS+=("$!")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "All services launched."
echo "  backend   -> http://localhost:4000"
echo "  frontend  -> http://localhost:3000"
echo ""
echo "Background PIDs: ${PIDS[*]}"
echo "Press Ctrl-C to stop the foreground processes (run 'kill ${PIDS[*]}' to stop them otherwise)."

# Wait on the background jobs so the script stays in the foreground.
wait
