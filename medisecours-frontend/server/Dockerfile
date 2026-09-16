# ============================================================================
# MediSecours+ WebSocket server — production Dockerfile
# ============================================================================
FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY websocket-server.js ./

RUN chown -R node:node /app

USER node

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8081/health >/dev/null 2>&1 || exit 1

CMD ["node", "websocket-server.js"]
