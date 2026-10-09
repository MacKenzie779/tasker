# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
# toolchain for better-sqlite3's native build
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/data/tasker.db \
    MIGRATIONS_DIR=/app/drizzle
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/manifest.webmanifest >/dev/null || exit 1
CMD ["node", "build"]
