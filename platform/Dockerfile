FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN YOUTUBE_DL_SKIP_DOWNLOAD=true npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node . .
RUN mkdir -p /data /app/sessions /app/downloads /app/tmp /app/logs && chown -R node:node /app /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/automation/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
