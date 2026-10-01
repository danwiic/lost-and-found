# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — install node_modules once, reused by the build stage
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# build — generate Prisma Client, bake the CLIP model, compile Next.js
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# prisma.config.ts resolves DATABASE_URL when the CLI starts. `prisma generate`
# and `next build` never connect, so a placeholder is enough here.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

# Image embedding lives in the embedder sidecar (embedder/, compose service
# `embedder`), which bakes its own clip-ViT-L/14 model at build time. Nothing
# model-related is baked or downloaded here.
RUN npm run build

# ---------------------------------------------------------------------------
# run — production image
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MODEL_CACHE_DIR=/app/.model-cache
ENV UPLOAD_DIR=/app/uploads

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./

# The entrypoint is executed by /bin/sh, so strip any CRLF that a Windows
# checkout may have introduced.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
    && chmod +x docker-entrypoint.sh \
    && mkdir -p /app/uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
