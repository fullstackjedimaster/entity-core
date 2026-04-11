-- Create role if missing
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  'ec',
  '5R8BirEpENNOISGJl8qEG-fgMAGyX6J3vhJ9bh_rkZ-75_wsyr1fEaY7xLuPfTNL'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'ec'
)\gexec

-- Always ensure password is correct
ALTER ROLE ec WITH LOGIN PASSWORD '5R8BirEpENNOISGJl8qEG-fgMAGyX6J3vhJ9bh_rkZ-75_wsyr1fEaY7xLuPfTNL';

-- Create database if missing
SELECT format(
  'CREATE DATABASE %I OWNER %I',
  'ec',
  'ec'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'ec'
)\gexec