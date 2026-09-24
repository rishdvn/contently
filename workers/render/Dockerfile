# The render worker: Node plus a real Google Chrome.
#
# Chrome rather than Playwright's Chromium because video rendering goes through
# WebCodecs with an H.264 encoder, and the open-source builds ship without the
# proprietary codecs. Everything else here is the usual container tax for a
# browser: fonts, and a process that reaps its zombies.
#
# Build from this directory:
#   docker build -t contently-render workers/render
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    CHROME_PATH=/usr/bin/google-chrome \
    NODE_ENV=production \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg dumb-init \
      fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# Chrome will not run as root without --no-sandbox; it gets that flag anyway,
# but a browser rendering other people's documents should not be root either.
RUN useradd --create-home --shell /bin/bash render && chown -R render:render /app
USER render

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dumb-init reaps the zombie processes Chrome leaves behind, and passes SIGTERM
# through so the worker can finish the job it is holding.
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "src/index.ts"]
