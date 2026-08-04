# Multi-stage: compile the Vite app, then serve the static output with a
# tiny server. VITE_API_URL must be a build ARG, not a runtime env var —
# Vite inlines import.meta.env.VITE_API_URL into the bundle at build time,
# so setting it only in the final container's environment would be too late.
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM node:20-alpine
RUN npm install -g serve
COPY --from=build /app/apps/frontend/dist /app/dist
EXPOSE 5173
# -s (SPA mode): unmatched paths fall back to index.html, so client-side
# routes (React Router) work on a hard refresh/direct link, not just on
# navigation within the app.
CMD ["serve", "-s", "/app/dist", "-l", "5173"]
