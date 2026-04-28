FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci
COPY src/ ./src/

FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 5001

CMD ["node", "src/server.js"]