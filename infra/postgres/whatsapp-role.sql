-- The session of the WhatsApp worker in a role and schema of its own (D-040). Run once per
-- server as the application's superuser, replacing the password:
--   docker compose exec -T postgres psql -U brazcar -d brazcar -v password='...' -f - < infra/postgres/whatsapp-role.sql
-- neonize's Go code creates and upgrades its whatsmeow_* tables by itself, outside Django's
-- migrations; the search_path keeps them in the `whatsapp` schema, never in `public`.
CREATE ROLE brazcar_wa LOGIN PASSWORD :'password';
CREATE SCHEMA whatsapp AUTHORIZATION brazcar_wa;
ALTER ROLE brazcar_wa SET search_path = whatsapp;
GRANT CONNECT ON DATABASE brazcar TO brazcar_wa;
