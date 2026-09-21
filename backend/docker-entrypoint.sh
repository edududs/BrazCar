#!/bin/sh
# Migrations run here only where RUN_MIGRATIONS=1, which is the API service alone (D-061).
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi

exec "$@"
