# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
COPY tsconfig.base.json ./
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/prisma backend/prisma

RUN npm ci

COPY backend/src backend/src

RUN node_modules/.bin/prisma generate --schema backend/prisma/schema.prisma
RUN npm run build --workspace=backend

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/package.json ./backend/package.json

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema backend/prisma/schema.prisma && node backend/dist/index.js"]
