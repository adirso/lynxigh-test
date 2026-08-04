# Built from the monorepo root (see docker-compose.yml's `context: .`) so
# pnpm can see the full workspace lockfile — a workspace install needs every
# member's package.json present to match pnpm-lock.yaml, even though only
# this service's actual source gets copied in below.
FROM node:20-alpine
WORKDIR /app
RUN corepack enable
# Alpine ships no OpenSSL by default; Prisma's query/schema engines need it
# both to generate (build time) and to run migrations (container start).
RUN apk add --no-cache openssl

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN pnpm build

EXPOSE 4000
# migrate deploy only applies pending migrations — safe to run on every
# container start, including restarts against an already-current schema.
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm start"]
