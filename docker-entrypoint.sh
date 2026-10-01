#!/bin/sh
# Runs on every container start: migrations first, then an idempotent seed,
# then the Next.js server.
set -e

echo "[entrypoint] applying database migrations"
npx prisma migrate deploy

echo "[entrypoint] seeding the OSAS admin account (idempotent; no demo data)"
npx prisma db seed

echo "[entrypoint] starting Next.js on port ${PORT:-3000}"
exec npm run start
