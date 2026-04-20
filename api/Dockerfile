# ---- Builder ----
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime

RUN addgroup -g 1001 -S helscoop && \
    adduser -S helscoop -u 1001 -G helscoop

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/templates/*.js ./dist/templates/

# Copy migrations for db:migrate at deploy time
COPY --from=builder /app/node_modules/.package-lock.json ./node_modules/.package-lock.json

USER helscoop

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
