DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ec') THEN
    CREATE ROLE ec LOGIN PASSWORD 'ec_password';
  END IF;
END $$;