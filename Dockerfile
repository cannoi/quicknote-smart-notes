FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json ./
RUN npm install --omit=dev --no-optional --no-audit --no-fund && npm cache clean --force

COPY . .

RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]
