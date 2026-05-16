# ================================================================
# RGNC WebMap — Dockerfile Frontend (Next.js production)
# Build multi-stage : image finale ~200 MB grâce à output:standalone
# ================================================================

# ── Étape 1 : dépendances ────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ── Étape 2 : build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables d'environnement injectées au build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=RGNC\ WebMap
ARG NEXT_PUBLIC_BACKEND_HOSTNAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_BACKEND_HOSTNAME=$NEXT_PUBLIC_BACKEND_HOSTNAME
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Étape 3 : image de production (standalone) ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copie uniquement ce que Next.js standalone génère
COPY --from=builder /app/public            ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
