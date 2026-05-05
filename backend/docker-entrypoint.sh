#!/bin/sh
set -e

echo "Running Prisma db push..."
npx prisma db push --schema=./src/prisma/schema.prisma --accept-data-loss 2>/dev/null || true

echo "Running Prisma seed..."
npx tsx src/prisma/seed.ts 2>/dev/null || true

echo "Starting backend server..."
exec node dist/index.js
