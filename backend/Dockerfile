FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate

# Local development (docker-compose.yml): source is bind-mounted, reloads on save.
FROM base AS dev
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "watch", "src/index.ts"]

# Production (docker-compose.prod.yml): compiled once, run with plain node.
# Dev dependencies stay so admin scripts (npx tsx prisma/set-admin.ts ...) work.
FROM base AS prod
ENV NODE_ENV=production
RUN npx tsc -p tsconfig.json
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
