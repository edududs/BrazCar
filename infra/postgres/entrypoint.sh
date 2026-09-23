#!/bin/sh
# Preload pg_cron and point it at the application's database, then behave as the official image.
set -e
if [ "$1" = "postgres" ]; then
  shift
  set -- postgres -c shared_preload_libraries=pg_cron -c "cron.database_name=${POSTGRES_DB:-postgres}" "$@"
fi
exec docker-entrypoint.sh "$@"
