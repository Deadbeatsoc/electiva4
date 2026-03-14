# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
COPY shared/package*.json shared/
COPY tsconfig.base.json ./

RUN npm ci

COPY backend backend
COPY frontend frontend
COPY shared shared

RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend
RUN node_modules/.bin/prisma generate --schema backend/prisma/schema.prisma

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache nginx gettext

ENV NODE_ENV=production
ENV PORT=8080
ENV BACKEND_PORT=3000
ENV PRISMA_SYNC_SCHEMA=true
ENV PRISMA_SEED=false

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/scripts/start-container.sh /usr/local/bin/start-container.sh

RUN chmod +x /usr/local/bin/start-container.sh

EXPOSE 8080

CMD ["/usr/local/bin/start-container.sh"]
