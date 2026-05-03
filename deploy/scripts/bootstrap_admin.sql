SELECT format('CREATE ROLE %I NOLOGIN CREATEROLE', :'app_owner')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_owner'
)\gexec


SELECT format(
  'GRANT %I TO postgres',
  :'app_owner'
)\gexec


SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L INHERIT',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)\gexec


ALTER ROLE :"app_owner" SET search_path = :"app_owner", public;
ALTER ROLE :"app_user" SET search_path = :"app_owner", public;

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'app_db',
  :'app_owner'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\gexec

SELECT format(
  'GRANT ALL PRIVILEGES ON DATABASE %I TO %I',
  :'app_db',
  :'app_owner'
)\gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  :'app_db',
  :'app_user'
)\gexec

CREATE EXTENSION IF NOT EXISTS pgcrypto;