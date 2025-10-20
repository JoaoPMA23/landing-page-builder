#!/bin/sh
# Bootstraps the backend container ensuring database migrations run before the dev server starts.
set -e

printf '%s\n' "[entrypoint] Applying Prisma migrations..."
if npx prisma migrate deploy; then
  printf '%s\n' "[entrypoint] Migrations applied with migrate deploy."
else
  printf '%s\n' "[entrypoint] migrate deploy failed, attempting migrate dev for development setups."
  if npx prisma migrate dev --name init; then
    printf '%s\n' "[entrypoint] Database synced using migrate dev."
  else
    printf '%s\n' "[entrypoint] migrate dev failed, falling back to prisma db push."
    npx prisma db push
  fi
fi

exec "$@"
