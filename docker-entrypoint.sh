#!/bin/sh
set -eu

if [ "${RUN_PRISMA_MIGRATIONS:-false}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  pnpm prisma migrate deploy
fi

exec "$@"
