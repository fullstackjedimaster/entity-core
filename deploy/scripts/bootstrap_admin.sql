SELECT format(
  'CREATE ROLE %I LOGIN CREATEROLE PASSWORD %L ',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)\gexec

ALTER ROLE :"app_user" WITH LOGIN PASSWORD :'app_password';

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'app_db',
  :'app_user'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\gexec

SELECT format(
  'GRANT ALL PRIVILEGES ON DATABASE %I OWNER %I',
  :'app_db',
  :'app_user'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\gexec