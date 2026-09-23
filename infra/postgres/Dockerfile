# syntax=docker/dockerfile:1
# The official Postgres plus pg_cron, for the purge inside the database (D-119). Published to GHCR
# next to the API image; the test machine pulls it, nothing is built there (D-067).
#
# Alpine ships pg_cron built for its own Postgres package, which lives under /usr/lib/postgresql18,
# while the official image builds Postgres into /usr/local. Same major version, same extension ABI:
# the shared object and the control files are copied over and the Alpine package stays out of the
# final image.
FROM postgres:18-alpine AS extension
RUN apk add --no-cache postgresql-pg_cron \
    && install -m 755 /usr/lib/postgresql18/pg_cron.so "$(pg_config --pkglibdir)/" \
    && install -m 644 /usr/share/postgresql18/extension/pg_cron* "$(pg_config --sharedir)/extension/"

FROM postgres:18-alpine
COPY --from=extension /usr/local/lib/postgresql/pg_cron.so /usr/local/lib/postgresql/
COPY --from=extension /usr/local/share/postgresql/extension/pg_cron* /usr/local/share/postgresql/extension/
# pg_cron must be preloaded and told which database holds its jobs: the application's, named by the
# same POSTGRES_DB the compose passes. The wrapper adds both flags and hands over to the official
# entrypoint, so initdb, the env file and the volume behave exactly as before.
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint-with-pg-cron.sh
ENTRYPOINT ["entrypoint-with-pg-cron.sh"]
CMD ["postgres"]
