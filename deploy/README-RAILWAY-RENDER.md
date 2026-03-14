# Deploy (Single Docker Container)

This setup serves frontend + backend in one container:
- `nginx` serves frontend and proxies `/api/*` to backend
- `node` runs backend API
- PostgreSQL stays external (Railway/Render DB service)

## Required environment variables

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

Optional:
- `JWT_ACCESS_EXPIRY` (default `15m`)
- `JWT_REFRESH_EXPIRY` (default `7d`)
- `PRISMA_SYNC_SCHEMA` (`true` by default)
- `PRISMA_SEED` (`false` by default)
- `BACKEND_PORT` (`3001` by default)
- `TRUST_PROXY` (`1` in production is recommended)

`PORT` is assigned automatically by Railway/Render.

---

## Railway

1. Create a Postgres service.
2. Create one app service from this repo root.
3. Railway will detect `Dockerfile` and build automatically.
4. Set env vars in the app service:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `JWT_ACCESS_SECRET=...`
   - `JWT_REFRESH_SECRET=...`
   - `CORS_ORIGIN=https://<your-public-domain>`
5. Deploy and verify:
   - `https://<your-public-domain>/api/v1/health`

`railway.json` is included for Dockerfile build + healthcheck path.

---

## Render

Option A (recommended): create a Web Service and choose Docker.
- Root: repository root
- Dockerfile: `Dockerfile`

Option B: use included blueprint `render.yaml`.

Set env vars:
- `DATABASE_URL` (from your external Postgres)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN=https://<your-render-domain>`

Healthcheck path:
- `/api/v1/health`
