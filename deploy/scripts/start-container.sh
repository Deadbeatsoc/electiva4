#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required."
  exit 1
fi

: "${PORT:=8080}"
: "${BACKEND_PORT:=3001}"

if [ "$BACKEND_PORT" = "$PORT" ]; then
  echo "BACKEND_PORT matches PORT ($PORT). Switching BACKEND_PORT to 3001 to avoid port conflict."
  BACKEND_PORT=3001
fi

export NGINX_PORT="$PORT"
export NGINX_BACKEND_PORT="$BACKEND_PORT"

echo "Container network config: PORT=${PORT}, BACKEND_PORT=${BACKEND_PORT}"

envsubst '${NGINX_PORT} ${NGINX_BACKEND_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

echo "Generated nginx config:"
cat /etc/nginx/http.d/default.conf

echo "Validating nginx config..."
nginx -t

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

echo "Waiting for backend to be ready..."
BACKEND_READY=0
for i in $(seq 1 30); do
  if command -v wget >/dev/null 2>&1; then
    if wget -q -T 2 -O /dev/null "http://127.0.0.1:${BACKEND_PORT}/health" 2>/dev/null; then
      echo "Backend is ready."
      BACKEND_READY=1
      break
    fi
  elif command -v nc >/dev/null 2>&1; then
    if nc -z 127.0.0.1 "$BACKEND_PORT" 2>/dev/null; then
      echo "Backend is ready."
      BACKEND_READY=1
      break
    fi
  fi

  echo "Attempt ${i}/30: Backend not ready yet, waiting..."
  sleep 1
done

if [ "$BACKEND_READY" -ne 1 ]; then
  echo "ERROR: Backend did not become healthy within 30 seconds."
  BACKEND_EXIT=0
  wait "$BACKEND_PID" || BACKEND_EXIT=$?
  echo "Backend process exit code after readiness timeout: ${BACKEND_EXIT}"
  exit 1
fi

echo "Starting nginx on ${PORT}..."
nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
}

trap cleanup INT TERM

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    BACKEND_EXIT=0
    wait "$BACKEND_PID" || BACKEND_EXIT=$?
    echo "Backend process exited (code: ${BACKEND_EXIT})."
    cleanup
    exit 1
  fi

  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    NGINX_EXIT=0
    wait "$NGINX_PID" || NGINX_EXIT=$?
    echo "Nginx process exited (code: ${NGINX_EXIT})."
    cleanup
    exit 1
  fi

  sleep 2
done
