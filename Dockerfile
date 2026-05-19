FROM node:22-bookworm AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Fetch the browser
RUN npx camoufox-js fetch

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=3000 \
    MCP_PATH=/mcp \
    MCP_HEALTH_PATH=/health \
    MCP_ENABLE_JSON_RESPONSE=true \
    MCP_HTTP_SESSION_MODE=stateless

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    xauth \
    tini \
    libgtk-3-0 \
    libx11-xcb1 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    libx11-6 \
    libxcomposite1 \
    libasound2 \
    libdbus-glib-1-2 \
    libpci3 \
    libxss1 \
    libgconf-2-4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 myappuser
USER myappuser
WORKDIR /home/myappuser/app

COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder --chown=myappuser:myappuser /app/dist ./dist
COPY --from=builder --chown=myappuser:myappuser /root/.cache/camoufox /home/myappuser/.cache/camoufox

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "const http=require('http'); const port=Number(process.env.MCP_PORT||3000); const path=process.env.MCP_HEALTH_PATH||'/health'; const req=http.get({host:'127.0.0.1',port,path}, res => process.exit(res.statusCode===200?0:1)); req.on('error', () => process.exit(1));"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1280x1024x24", "node", "dist/index.js"]
