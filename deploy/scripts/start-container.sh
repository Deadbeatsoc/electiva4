#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required."
  exit 1
fi

: "${PORT:=8080}"
: "${BACKEND_PORT:=3000}"

export NGINX_PORT="$PORT"
export NGINX_BACKEND_PORT="$BACKEND_PORT"

envsubst '${NGINX_PORT} ${NGINX_BACKEND_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

if [ "${PRISMA_SYNC_SCHEMA:-true}" = "true" ] || [ "${PRISMA_SYNC_SCHEMA:-}" = "1" ]; then
  echo "Syncing schema with prisma db push..."
  node_modules/.bin/prisma db push --schema backend/prisma/schema.prisma
fi

if [ "${PRISMA_SEED:-false}" = "true" ] || [ "${PRISMA_SEED:-}" = "1" ]; then
  echo "Running seed script..."
  node_modules/.bin/tsx backend/prisma/seed.ts
fi

echo "Starting backend on ${BACKEND_PORT}..."
PORT="$BACKEND_PORT" node backend/dist/index.js &
BACKEND_PID=$!

echo "Starting nginx on ${PORT}..."
nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
}

trap cleanup INT TERM

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID" || true
    cleanup
    exit 1
  fi

  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    wait "$NGINX_PID" || true
    cleanup
    exit 1
  fi

  sleep 2
done
