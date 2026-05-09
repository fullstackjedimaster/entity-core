SET ROLE ec;

CREATE SCHEMA IF NOT EXISTS ec AUTHORIZATION ec;

SET search_path = ec, public;



-- =========================================================
-- GLOBAL TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS ec.tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub TEXT UNIQUE NOT NULL,
  entity_schema TEXT NOT NULL,
  org_id UUID NOT NULL,
  roles TEXT[] DEFAULT '{}'::TEXT[],
  permissions TEXT[] DEFAULT '{}'::TEXT[],
  memberships JSONB DEFAULT '[]'::JSONB
);

ALTER TABLE ec.tenant OWNER TO ec;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_sub_idx
  ON ec.tenant(lower(sub));


CREATE TABLE IF NOT EXISTS ec.entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_schema TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_json JSONB NOT NULL,
  UNIQUE(entity_schema, entity_name)
);

ALTER TABLE ec.entity OWNER TO ec;

CREATE UNIQUE INDEX IF NOT EXISTS entity_schema_entity_name_idx
  ON ec.entity(lower(entity_schema), lower(entity_name));


-- =========================================================
-- GLOBAL ENTITY FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION ec._upsert_entity(
  p_entity_schema TEXT,
  p_entity_name TEXT,
  p_entity_json JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
BEGIN
  INSERT INTO ec.entity(entity_schema, entity_name, entity_json)
  VALUES (p_entity_schema, p_entity_name, p_entity_json)
  ON CONFLICT (entity_schema, entity_name)
  DO UPDATE SET entity_json = EXCLUDED.entity_json;
END;
$$;

ALTER FUNCTION ec._upsert_entity(TEXT, TEXT, JSONB) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._upsert_entity(TEXT, TEXT, JSONB) TO ec_app;


CREATE OR REPLACE FUNCTION ec.create_entity(
  entity_schema TEXT,
  entity_name TEXT,
  entity_json JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  k TEXT;
  v JSONB;
  coltype TEXT;
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = entity_schema
      AND table_name = entity_name
  )
  INTO has_table;

  IF NOT has_table THEN
    EXECUTE format(
      'CREATE TABLE %I.%I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )',
      entity_schema,
      entity_name
    );
  END IF;

  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO ec_app',
    entity_schema,
    entity_name
  );

  FOR k, v IN
    SELECT key, value FROM jsonb_each(entity_json)
  LOOP
    coltype := CASE jsonb_typeof(v)
      WHEN 'number' THEN 'numeric'
      WHEN 'boolean' THEN 'boolean'
      WHEN 'object' THEN 'jsonb'
      WHEN 'array' THEN 'jsonb'
      ELSE 'text'
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = entity_schema
        AND table_name = entity_name
        AND column_name = k
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN %I %s',
        entity_schema,
        entity_name,
        k,
        coltype
      );
    END IF;
  END LOOP;



  PERFORM ec._upsert_entity(entity_schema, entity_name, entity_json);
END;
$$;

ALTER FUNCTION ec.create_entity(TEXT, TEXT, JSONB) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.create_entity(TEXT, TEXT, JSONB) TO ec_app;


CREATE OR REPLACE FUNCTION ec.list_entities(
  p_entity_schema TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'entity_name', entity_name
      )
      ORDER BY entity_name
    ),
    '[]'::jsonb
  )
  INTO result
  FROM ec.entity
  WHERE entity_schema = p_entity_schema;

  RETURN result;
END;
$$;

ALTER FUNCTION ec.list_entities(TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.list_entities(TEXT) TO ec_app;


CREATE OR REPLACE FUNCTION ec.get_entity(
  p_entity_schema TEXT,
  p_entity_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'entity_name', entity_name,
    'entity_json', entity_json
  )
  INTO result
  FROM ec.entity
  WHERE entity_schema = p_entity_schema
    AND entity_name = p_entity_name;

  RETURN result;
END;
$$;

ALTER FUNCTION ec.get_entity(TEXT, TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.get_entity(TEXT, TEXT) TO ec_app;


-- =========================================================
-- GLOBAL GENERIC CRUD FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION ec.manage_entity(
  entity_schema TEXT,
  entity_name TEXT,
  operation TEXT,
  id UUID DEFAULT NULL,
  data JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  result JSON;
  col RECORD;
  col_names TEXT := '';
  col_values TEXT := '';
  update_pairs TEXT := '';
  query TEXT;
  zero_uuid CONSTANT UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
  operation := lower(coalesce(operation, ''));

  IF operation = 'create' THEN

    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = entity_schema
        AND table_name = entity_name
        AND column_name <> 'id'
        AND column_name NOT IN ('created_at', 'updated_at', 'last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      col_names := col_names || format('%I, ', col.column_name);

      col_values := col_values || COALESCE(
        CASE col.data_type
          WHEN 'uuid' THEN format('%L::uuid', data->>col.column_name)
          WHEN 'integer' THEN format('%L::int', data->>col.column_name)
          WHEN 'bigint' THEN format('%L::bigint', data->>col.column_name)
          WHEN 'numeric' THEN format('%L::numeric', data->>col.column_name)
          WHEN 'boolean' THEN format('%L::boolean', data->>col.column_name)
          WHEN 'json' THEN format('%L::json', data->>col.column_name)
          WHEN 'jsonb' THEN format('%L::jsonb', data->>col.column_name)
          WHEN 'date' THEN format('%L::date', data->>col.column_name)
          WHEN 'timestamp without time zone' THEN format('%L::timestamp', data->>col.column_name)
          WHEN 'timestamp with time zone' THEN format('%L::timestamptz', data->>col.column_name)
          ELSE format('%L', data->>col.column_name)
        END,
        'NULL'
      ) || ', ';
    END LOOP;

    IF col_names = '' THEN
      query := format(
        'INSERT INTO %I.%I DEFAULT VALUES RETURNING row_to_json(%I.*)',
        entity_schema,
        entity_name,
        entity_name
      );
    ELSE
      col_names := left(col_names, length(col_names) - 2);
      col_values := left(col_values, length(col_values) - 2);

      query := format(
        'INSERT INTO %I.%I (%s) VALUES (%s) RETURNING row_to_json(%I.*)',
        entity_schema,
        entity_name,
        col_names,
        col_values,
        entity_name
      );
    END IF;

    EXECUTE query INTO result;

  ELSIF operation = 'read' THEN

    IF id IS NULL OR id = zero_uuid THEN
      query := format(
        'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM %I.%I t',
        entity_schema,
        entity_name
      );
    ELSE
      query := format(
        'SELECT row_to_json(t) FROM %I.%I t WHERE id = %L::uuid',
        entity_schema,
        entity_name,
        id::text
      );
    END IF;

    EXECUTE query INTO result;

  ELSIF operation IN ('list', 'select') THEN

    query := format(
      'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM %I.%I t',
      entity_schema,
      entity_name
    );

    EXECUTE query INTO result;

  ELSIF operation = 'update' THEN

    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'update requires a valid id';
    END IF;

    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = entity_schema
        AND table_name = entity_name
        AND column_name <> 'id'
        AND column_name NOT IN ('created_at', 'updated_at', 'last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      update_pairs := update_pairs || format('%I = ', col.column_name) || COALESCE(
        CASE col.data_type
          WHEN 'uuid' THEN format('%L::uuid', data->>col.column_name)
          WHEN 'integer' THEN format('%L::int', data->>col.column_name)
          WHEN 'bigint' THEN format('%L::bigint', data->>col.column_name)
          WHEN 'numeric' THEN format('%L::numeric', data->>col.column_name)
          WHEN 'boolean' THEN format('%L::boolean', data->>col.column_name)
          WHEN 'json' THEN format('%L::json', data->>col.column_name)
          WHEN 'jsonb' THEN format('%L::jsonb', data->>col.column_name)
          WHEN 'date' THEN format('%L::date', data->>col.column_name)
          WHEN 'timestamp without time zone' THEN format('%L::timestamp', data->>col.column_name)
          WHEN 'timestamp with time zone' THEN format('%L::timestamptz', data->>col.column_name)
          ELSE format('%L', data->>col.column_name)
        END,
        'NULL'
      ) || ', ';
    END LOOP;

    update_pairs := left(update_pairs, length(update_pairs) - 2);

    query := format(
      'UPDATE %I.%I SET %s WHERE id = %L::uuid RETURNING row_to_json(%I.*)',
      entity_schema,
      entity_name,
      update_pairs,
      id::text,
      entity_name
    );

    EXECUTE query INTO result;

  ELSIF operation = 'delete' THEN

    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'delete requires a valid id';
    END IF;

    query := format(
      'DELETE FROM %I.%I WHERE id = %L::uuid RETURNING row_to_json(%I.*)',
      entity_schema,
      entity_name,
      id::text,
      entity_name
    );

    EXECUTE query INTO result;

  ELSE
    RAISE EXCEPTION 'Unsupported operation: %', operation;
  END IF;

  RETURN result;
END;
$$;

ALTER FUNCTION ec.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) TO ec_app;

CREATE OR REPLACE FUNCTION ec.get_column_options(
  p_entity_schema TEXT,
  p_entity_name TEXT,
  p_column_name TEXT,
  p_filter TEXT DEFAULT NULL
)
RETURNS TABLE (value TEXT)
LANGUAGE plpgsql AS $opt$
DECLARE
  tmpl JSONB;
BEGIN
  -- Fetch entity for schema + entity
  SELECT entity_json INTO tmpl
  FROM ec.entity
  WHERE entity_schema = p_entity_schema AND entity_name = p_entity_name;

  IF tmpl IS NULL THEN
    RAISE EXCEPTION 'No entity_json found for %.%', p_entity_schema, p_entity_name;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT j->>%L AS value
     FROM jsonb_array_elements($1->''entity_json''->%L->%L) AS j
     WHERE j->>%L IS NOT NULL %s
     ORDER BY value',
     p_column_name, p_entity_name, p_column_name, p_column_name,
     CASE WHEN p_filter IS NOT NULL THEN
       format('AND j->>%L ILIKE ''%%%s%%''', p_column_name, p_filter)
     ELSE
       ''
     END
  ) USING tmpl;
END;
$opt$;

ALTER FUNCTION ec.get_column_options(TEXT, TEXT, TEXT, TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.get_column_options(TEXT, TEXT, TEXT, TEXT) TO ec_app;

CREATE OR REPLACE FUNCTION ec.get_form_metadata(
  p_entity_schema TEXT,
  p_entity_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $form$
DECLARE
  rec RECORD;
  fields JSONB := '[]'::JSONB;
  pk TEXT := 'id';
  excludes TEXT[] := ARRAY['created_at', 'updated_at', 'last_updated_at', 'last_updated_by']::TEXT[];
  has_entity BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM ec.entity
    WHERE entity_schema = p_entity_schema
      AND entity_name = p_entity_name
  )
  INTO has_entity;

  IF NOT has_entity THEN
    RAISE EXCEPTION 'Unknown entity: %.%', p_entity_schema, p_entity_name;
  END IF;

  FOR rec IN
    SELECT
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.udt_name,
      c.ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema = p_entity_schema
      AND c.table_name = p_entity_name
    ORDER BY c.ordinal_position
  LOOP
    IF rec.column_name = pk OR rec.column_name = ANY(excludes) THEN
      CONTINUE;
    END IF;

    fields := fields || jsonb_build_object(
      'name', rec.column_name,
      'label', initcap(replace(rec.column_name, '_', ' ')),
      'type',
        CASE
          WHEN rec.data_type = 'ARRAY' AND rec.udt_name LIKE '_text' THEN 'string[]'
          WHEN rec.data_type = 'ARRAY' THEN 'array'
          WHEN rec.data_type = 'USER-DEFINED' AND rec.udt_name = 'citext' THEN 'text'
          WHEN rec.data_type = 'jsonb' THEN 'jsonb'
          WHEN rec.data_type = 'json' THEN 'json'
          WHEN rec.data_type = 'boolean' THEN 'boolean'
          WHEN rec.data_type IN ('integer','bigint','numeric','double precision','real') THEN 'number'
          WHEN rec.data_type LIKE 'timestamp%' THEN 'datetime'
          WHEN rec.data_type = 'date' THEN 'date'
          WHEN rec.data_type = 'uuid' THEN 'uuid'
          ELSE 'text'
        END,
      'required', (rec.is_nullable = 'NO')
    )::JSONB;
  END LOOP;

  RETURN jsonb_build_object(
    'entityName', p_entity_name,
    'entity', p_entity_name,
    'entity_schema', p_entity_schema,
    'schema', p_entity_schema,
    'table', p_entity_name,
    'primaryKey', pk,
    'fields', fields
  );
END;
$form$;

ALTER FUNCTION ec.get_form_metadata(TEXT, TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.get_form_metadata(TEXT, TEXT) TO ec_app;
CREATE OR REPLACE FUNCTION ec.get_foreign_key_options(
    p_entity_schema TEXT,
    p_entity_name TEXT,
    p_column_name TEXT DEFAULT NULL,
    p_parent_field TEXT DEFAULT NULL,
    p_parent_value TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    fk RECORD;
    parent_fk RECORD;
    child_parent_fk RECORD;
    result JSONB := '{}';
    lookup JSONB;
    label_column TEXT;
    where_sql TEXT;
BEGIN
    FOR fk IN
        SELECT
            kcu.column_name,
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.constraint_schema = tc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = p_entity_schema
          AND tc.table_name = p_entity_name
          AND (
                p_column_name IS NULL
                OR kcu.column_name = p_column_name
          )
        ORDER BY kcu.column_name
    LOOP
        SELECT c.column_name
        INTO label_column
        FROM information_schema.columns c
        WHERE c.table_schema = fk.foreign_schema
          AND c.table_name = fk.foreign_table
          AND c.column_name IN ('name', 'label', 'title')
        ORDER BY CASE c.column_name
            WHEN 'name' THEN 1
            WHEN 'label' THEN 2
            WHEN 'title' THEN 3
            ELSE 4
        END
        LIMIT 1;

        IF label_column IS NULL THEN
            label_column := fk.foreign_column;
        END IF;

        where_sql := '';

        IF p_parent_field IS NOT NULL
           AND p_parent_value IS NOT NULL
           AND p_parent_value <> ''
        THEN
            SELECT
                kcu.column_name,
                ccu.table_schema AS foreign_schema,
                ccu.table_name AS foreign_table,
                ccu.column_name AS foreign_column
            INTO parent_fk
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.constraint_schema = kcu.constraint_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
               AND ccu.constraint_schema = tc.constraint_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = p_entity_schema
              AND tc.table_name = p_entity_name
              AND kcu.column_name = p_parent_field
            LIMIT 1;

            IF parent_fk.column_name IS NOT NULL THEN
                SELECT
                    kcu.column_name,
                    ccu.table_schema AS parent_schema,
                    ccu.table_name AS parent_table,
                    ccu.column_name AS parent_column
                INTO child_parent_fk
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.constraint_schema = kcu.constraint_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                   AND ccu.constraint_schema = tc.constraint_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = fk.foreign_schema
                  AND tc.table_name = fk.foreign_table
                  AND ccu.table_schema = parent_fk.foreign_schema
                  AND ccu.table_name = parent_fk.foreign_table
                  AND ccu.column_name = parent_fk.foreign_column
                LIMIT 1;

                IF child_parent_fk.column_name IS NOT NULL THEN
                    where_sql := format(
                        'WHERE %I::text = $1',
                        child_parent_fk.column_name
                    );
                ELSE
                    lookup := '[]'::jsonb;

                    result := jsonb_set(
                        result,
                        ARRAY[fk.column_name],
                        lookup,
                        true
                    );

                    CONTINUE;
                END IF;
            END IF;
        END IF;

        IF where_sql <> '' THEN
            EXECUTE format(
                'SELECT COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            ''value'', %1$I::text,
                            ''label'', COALESCE(%2$I::text, %1$I::text)
                        )
                        ORDER BY COALESCE(%2$I::text, %1$I::text)
                    ),
                    ''[]''::jsonb
                )
                FROM %3$I.%4$I
                %5$s',
                fk.foreign_column,
                label_column,
                fk.foreign_schema,
                fk.foreign_table,
                where_sql
            )
            INTO lookup
            USING p_parent_value;
        ELSE
            EXECUTE format(
                'SELECT COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            ''value'', %1$I::text,
                            ''label'', COALESCE(%2$I::text, %1$I::text)
                        )
                        ORDER BY COALESCE(%2$I::text, %1$I::text)
                    ),
                    ''[]''::jsonb
                )
                FROM %3$I.%4$I',
                fk.foreign_column,
                label_column,
                fk.foreign_schema,
                fk.foreign_table
            )
            INTO lookup;
        END IF;

        result := jsonb_set(
            result,
            ARRAY[fk.column_name],
            lookup,
            true
        );
    END LOOP;

    RETURN result;
END;
$$;

ALTER FUNCTION ec.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) TO ec_app;

-- =========================================================
-- TENANT BOOTSTRAP
-- =========================================================

CREATE OR REPLACE FUNCTION ec._ensure_tenant_objects(
  p_entity_schema TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
BEGIN
  p_entity_schema := lower(trim(p_entity_schema));

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = p_entity_schema
  ) THEN
    EXECUTE format($sql$
        CREATE ROLE %1$I NOLOGIN;
        $sql$, p_entity_schema);
  END IF;

  EXECUTE format('GRANT %I TO ec', p_entity_schema);

  EXECUTE format(
    'CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I',
    p_entity_schema,
    p_entity_schema
  );

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.organization (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      parent_org_id UUID NULL REFERENCES %1$I.organization(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I."user" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth0_sub TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture_url TEXT,
      given_name TEXT,
      family_name TEXT,
      locale TEXT,
      last_login_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.role (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES %1$I.organization(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(org_id, key)
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.permission (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.user_org (
      user_id UUID REFERENCES %1$I."user"(id) ON DELETE CASCADE,
      org_id UUID REFERENCES %1$I.organization(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, org_id)
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.user_org_role (
      user_id UUID REFERENCES %1$I."user"(id) ON DELETE CASCADE,
      org_id UUID REFERENCES %1$I.organization(id) ON DELETE CASCADE,
      role_id UUID REFERENCES %1$I.role(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, org_id, role_id)
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.role_permission (
      role_id UUID REFERENCES %1$I.role(id) ON DELETE CASCADE,
      permission_id UUID REFERENCES %1$I.permission(id) ON DELETE CASCADE,
      PRIMARY KEY(role_id, permission_id)
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %1$I.entity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_schema TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_json JSONB NOT NULL,
      UNIQUE(entity_schema, entity_name)
    )
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    CREATE UNIQUE INDEX IF NOT EXISTS entity_schema_entity_idx
      ON %1$I.entity(lower(entity_schema), lower(entity_name))
  $sql$, p_entity_schema);

  EXECUTE format('ALTER TABLE %1$I.organization OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I."user" OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.role OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.permission OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.user_org OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.user_org_role OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.role_permission OWNER TO %1$I', p_entity_schema);
  EXECUTE format('ALTER TABLE %1$I.entity OWNER TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.upsert_entity(
      p_entity_schema TEXT,
      p_entity_name TEXT,
      p_entity_json JSONB
    )
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $fn$
    BEGIN
      INSERT INTO %1$I.entity(entity_schema, entity_name, entity_json)
      VALUES (p_entity_schema, p_entity_name, p_entity_json)
      ON CONFLICT(entity_schema, entity_name)
      DO UPDATE SET entity_json = EXCLUDED.entity_json;
    END;
    $fn$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.upsert_entity(TEXT, TEXT, JSONB) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.upsert_entity(TEXT, TEXT, JSONB) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.upsert_entity(TEXT, TEXT, JSONB) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.upsert_entity(TEXT, TEXT, JSONB) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.create_entity(
      entity_schema TEXT,
      entity_name TEXT,
      entity_json JSONB
    )
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $fn$
    DECLARE
      k TEXT;
      v JSONB;
      coltype TEXT;
      has_table BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = entity_schema
          AND table_name = entity_name
      )
      INTO has_table;

      IF NOT has_table THEN
        EXECUTE format(
          'CREATE TABLE %%I.%%I (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          )',
          entity_schema,
          entity_name
        );
      END IF;

      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %%I.%%I TO ec_app',
        entity_schema,
        entity_name
      );


      FOR k, v IN
        SELECT key, value FROM jsonb_each(entity_json)
      LOOP
        coltype := CASE jsonb_typeof(v)
          WHEN 'number' THEN 'numeric'
          WHEN 'boolean' THEN 'boolean'
          WHEN 'object' THEN 'jsonb'
          WHEN 'array' THEN 'jsonb'
          ELSE 'text'
        END;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = entity_schema
            AND table_name = entity_name
            AND column_name = k
        ) THEN
          EXECUTE format(
            'ALTER TABLE %%I.%%I ADD COLUMN %%I %%s',
            entity_schema,
            entity_name,
            k,
            coltype
          );
        END IF;
      END LOOP;

      PERFORM %1$I.upsert_entity(entity_schema, entity_name, entity_json);
    END;
    $fn$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.create_entity(TEXT, TEXT, JSONB) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.create_entity(TEXT, TEXT, JSONB) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.create_entity(TEXT, TEXT, JSONB) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.create_entity(TEXT, TEXT, JSONB) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.get_entity(
      p_entity_schema TEXT,
      p_entity_name TEXT
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $fn$
    DECLARE
      result JSONB;
    BEGIN
      SELECT jsonb_build_object(
        'entity_name', entity_name,
        'entity_json', entity_json
      )
      INTO result
      FROM %1$I.entity
      WHERE entity_schema = p_entity_schema
        AND entity_name = p_entity_name;

      RETURN result;
    END;
    $fn$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.get_entity(TEXT, TEXT) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.get_entity(TEXT, TEXT) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_entity(TEXT, TEXT) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_entity(TEXT, TEXT) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.list_entities(
      p_entity_schema TEXT
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $fn$
    DECLARE
      result JSONB;
    BEGIN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'entity_name', entity_name
          )
          ORDER BY entity_name
        ),
        '[]'::jsonb
      )
      INTO result
      FROM %1$I.entity
      WHERE entity_schema = p_entity_schema;

      RETURN result;
    END;
    $fn$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.list_entities(TEXT) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.list_entities(TEXT) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.list_entities(TEXT) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.list_entities(TEXT) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.manage_entity(
      entity_schema TEXT,
      entity_name TEXT,
      operation TEXT,
      id UUID DEFAULT NULL,
      data JSONB DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $fn$
    DECLARE
      result JSON;
      col RECORD;
      col_names TEXT := '';
      col_values TEXT := '';
      update_pairs TEXT := '';
      query TEXT;
      zero_uuid CONSTANT UUID := '00000000-0000-0000-0000-000000000000'::UUID;
    BEGIN
      operation := lower(coalesce(operation, ''));

      IF operation = 'create' THEN
        FOR col IN
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = entity_schema
            AND table_name = entity_name
            AND column_name <> 'id'
            AND column_name NOT IN ('created_at', 'updated_at', 'last_updated_at', 'last_updated_by')
          ORDER BY ordinal_position
        LOOP
          col_names := col_names || format('%%I, ', col.column_name);

          col_values := col_values || COALESCE(
            CASE col.data_type
              WHEN 'uuid' THEN format('%%L::uuid', data->>col.column_name)
              WHEN 'integer' THEN format('%%L::int', data->>col.column_name)
              WHEN 'bigint' THEN format('%%L::bigint', data->>col.column_name)
              WHEN 'numeric' THEN format('%%L::numeric', data->>col.column_name)
              WHEN 'boolean' THEN format('%%L::boolean', data->>col.column_name)
              WHEN 'json' THEN format('%%L::json', data->>col.column_name)
              WHEN 'jsonb' THEN format('%%L::jsonb', data->>col.column_name)
              WHEN 'date' THEN format('%%L::date', data->>col.column_name)
              WHEN 'timestamp without time zone' THEN format('%%L::timestamp', data->>col.column_name)
              WHEN 'timestamp with time zone' THEN format('%%L::timestamptz', data->>col.column_name)
              ELSE format('%%L', data->>col.column_name)
            END,
            'NULL'
          ) || ', ';
        END LOOP;

        IF col_names = '' THEN
          query := format(
            'INSERT INTO %%I.%%I DEFAULT VALUES RETURNING row_to_json(%%I.*)',
            entity_schema,
            entity_name,
            entity_name
          );
        ELSE
          col_names := left(col_names, length(col_names) - 2);
          col_values := left(col_values, length(col_values) - 2);

          query := format(
            'INSERT INTO %%I.%%I (%%s) VALUES (%%s) RETURNING row_to_json(%%I.*)',
            entity_schema,
            entity_name,
            col_names,
            col_values,
            entity_name
          );
        END IF;

        EXECUTE query INTO result;

      ELSIF operation = 'read' THEN
        IF id IS NULL OR id = zero_uuid THEN
          query := format(
            'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM %%I.%%I t',
            entity_schema,
            entity_name
          );
        ELSE
          query := format(
            'SELECT row_to_json(t) FROM %%I.%%I t WHERE id = %%L::uuid',
            entity_schema,
            entity_name,
            id::text
          );
        END IF;

        EXECUTE query INTO result;

      ELSIF operation IN ('list', 'select') THEN
        query := format(
          'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM %%I.%%I t',
          entity_schema,
          entity_name
        );

        EXECUTE query INTO result;

      ELSIF operation = 'update' THEN
        IF id IS NULL OR id = zero_uuid THEN
          RAISE EXCEPTION 'update requires a valid id';
        END IF;

        FOR col IN
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = entity_schema
            AND table_name = entity_name
            AND column_name <> 'id'
            AND column_name NOT IN ('created_at', 'updated_at', 'last_updated_at', 'last_updated_by')
          ORDER BY ordinal_position
        LOOP
          update_pairs := update_pairs || format('%%I = ', col.column_name) || COALESCE(
            CASE col.data_type
              WHEN 'uuid' THEN format('%%L::uuid', data->>col.column_name)
              WHEN 'integer' THEN format('%%L::int', data->>col.column_name)
              WHEN 'bigint' THEN format('%%L::bigint', data->>col.column_name)
              WHEN 'numeric' THEN format('%%L::numeric', data->>col.column_name)
              WHEN 'boolean' THEN format('%%L::boolean', data->>col.column_name)
              WHEN 'json' THEN format('%%L::json', data->>col.column_name)
              WHEN 'jsonb' THEN format('%%L::jsonb', data->>col.column_name)
              WHEN 'date' THEN format('%%L::date', data->>col.column_name)
              WHEN 'timestamp without time zone' THEN format('%%L::timestamp', data->>col.column_name)
              WHEN 'timestamp with time zone' THEN format('%%L::timestamptz', data->>col.column_name)
              ELSE format('%%L', data->>col.column_name)
            END,
            'NULL'
          ) || ', ';
        END LOOP;

        update_pairs := left(update_pairs, length(update_pairs) - 2);

        query := format(
          'UPDATE %%I.%%I SET %%s WHERE id = %%L::uuid RETURNING row_to_json(%%I.*)',
          entity_schema,
          entity_name,
          update_pairs,
          id::text,
          entity_name
        );

        EXECUTE query INTO result;

      ELSIF operation = 'delete' THEN
        IF id IS NULL OR id = zero_uuid THEN
          RAISE EXCEPTION 'delete requires a valid id';
        END IF;

        query := format(
          'DELETE FROM %%I.%%I WHERE id = %%L::uuid RETURNING row_to_json(%%I.*)',
          entity_schema,
          entity_name,
          id::text,
          entity_name
        );

        EXECUTE query INTO result;

      ELSE
        RAISE EXCEPTION 'Unsupported operation: %%', operation;
      END IF;

      RETURN result;
    END;
    $fn$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.get_column_options(
      p_entity_schema TEXT,
      p_entity_name TEXT,
      p_column_name TEXT,
      p_filter TEXT DEFAULT NULL
    )
    RETURNS TABLE (value TEXT)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $opt$
    DECLARE
      tmpl JSONB;
    BEGIN
      SELECT entity_json
      INTO tmpl
      FROM %1$I.entity
      WHERE entity_schema = p_entity_schema
        AND entity_name = p_entity_name;

      RETURN QUERY EXECUTE format(
        'SELECT DISTINCT j->>%%L AS value
         FROM jsonb_array_elements($1->%%L->%%L) AS j
         WHERE j->>%%L IS NOT NULL %%s
         ORDER BY value',
        p_column_name,
        p_entity_name,
        p_column_name,
        p_column_name,
        CASE
          WHEN p_filter IS NOT NULL THEN
            format('AND j->>%%L ILIKE %%L', p_column_name, '%%' || p_filter || '%%')
          ELSE
            ''
        END
      ) USING tmpl;
    END;
    $opt$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.get_column_options(TEXT, TEXT, TEXT, TEXT) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.get_column_options(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_column_options(TEXT, TEXT, TEXT, TEXT) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_column_options(TEXT, TEXT, TEXT, TEXT) TO %1$I', p_entity_schema);


  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION %1$I.get_form_metadata(
      p_entity_schema TEXT,
      p_entity_name TEXT
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %1$I, public
    AS $form$
    DECLARE
      rec RECORD;
      fields JSONB := '[]'::JSONB;
      pk TEXT := 'id';
      excludes TEXT[] := ARRAY['created_at', 'updated_at', 'last_updated_at', 'last_updated_by']::TEXT[];
      has_entity BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM %1$I.entity
        WHERE entity_schema = p_entity_schema
          AND entity_name = p_entity_name
      )
      INTO has_entity;

      IF NOT has_entity THEN
        RAISE EXCEPTION 'Unknown entity:%%.%%', p_entity_schema, p_entity_name;
      END IF;

      FOR rec IN
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.udt_name,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema = p_entity_schema
          AND c.table_name = p_entity_name
        ORDER BY c.ordinal_position
      LOOP
        IF rec.column_name = pk OR rec.column_name = ANY(excludes) THEN
          CONTINUE;
        END IF;

        fields := fields || jsonb_build_object(
          'name', rec.column_name,
          'label', initcap(replace(rec.column_name, '_', ' ')),
          'type',
            CASE
              WHEN rec.data_type = 'ARRAY' AND rec.udt_name LIKE '_text' THEN 'string[]'
              WHEN rec.data_type = 'ARRAY' THEN 'array'
              WHEN rec.data_type = 'USER-DEFINED' AND rec.udt_name = 'citext' THEN 'text'
              WHEN rec.data_type = 'jsonb' THEN 'jsonb'
              WHEN rec.data_type = 'json' THEN 'json'
              WHEN rec.data_type = 'boolean' THEN 'boolean'
              WHEN rec.data_type IN ('integer','bigint','numeric','double precision','real') THEN 'number'
              WHEN rec.data_type LIKE 'timestamp%%' THEN 'datetime'
              WHEN rec.data_type = 'date' THEN 'date'
              WHEN rec.data_type = 'uuid' THEN 'uuid'
              ELSE 'text'
            END,
          'required', (rec.is_nullable = 'NO')
        )::JSONB;
      END LOOP;

      RETURN jsonb_build_object(
        'entityName', p_entity_name,
        'entity', p_entity_name,
        'entity_schema', p_entity_schema,
        'schema', p_entity_schema,
        'table', p_entity_name,
        'primaryKey', pk,
        'fields', fields
      );
    END;
    $form$
  $sql$, p_entity_schema);

  EXECUTE format('ALTER FUNCTION %1$I.get_form_metadata(TEXT, TEXT) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.get_form_metadata(TEXT, TEXT) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_form_metadata(TEXT, TEXT) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_form_metadata(TEXT, TEXT) TO %1$I', p_entity_schema);

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION  %1$I.get_foreign_key_options(
        p_entity_schema TEXT,
        p_entity_name TEXT,
        p_column_name TEXT DEFAULT NULL,
        p_parent_field TEXT DEFAULT NULL,
        p_parent_value TEXT DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    AS $fk$
    DECLARE
        fk RECORD;
        parent_fk RECORD;
        child_parent_fk RECORD;
        result JSONB := '{}';
        lookup JSONB;
        label_column TEXT;
        where_sql TEXT;
    BEGIN
        FOR fk IN
            SELECT
                kcu.column_name,
                ccu.table_schema AS foreign_schema,
                ccu.table_name AS foreign_table,
                ccu.column_name AS foreign_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.constraint_schema = kcu.constraint_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
               AND ccu.constraint_schema = tc.constraint_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = p_entity_schema
              AND tc.table_name = p_entity_name
              AND (
                    p_column_name IS NULL
                    OR kcu.column_name = p_column_name
              )
            ORDER BY kcu.column_name
        LOOP
            SELECT c.column_name
            INTO label_column
            FROM information_schema.columns c
            WHERE c.table_schema = fk.foreign_schema
              AND c.table_name = fk.foreign_table
              AND c.column_name IN ('name', 'label', 'title')
            ORDER BY CASE c.column_name
                WHEN 'name' THEN 1
                WHEN 'label' THEN 2
                WHEN 'title' THEN 3
                ELSE 4
            END
            LIMIT 1;

            IF label_column IS NULL THEN
                label_column := fk.foreign_column;
            END IF;

            where_sql := '';

            IF p_parent_field IS NOT NULL
               AND p_parent_value IS NOT NULL
               AND p_parent_value <> ''
            THEN
                SELECT
                    kcu.column_name,
                    ccu.table_schema AS foreign_schema,
                    ccu.table_name AS foreign_table,
                    ccu.column_name AS foreign_column
                INTO parent_fk
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.constraint_schema = kcu.constraint_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                   AND ccu.constraint_schema = tc.constraint_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = p_entity_schema
                  AND tc.table_name = p_entity_name
                  AND kcu.column_name = p_parent_field
                LIMIT 1;

                IF parent_fk.column_name IS NOT NULL THEN
                    SELECT
                        kcu.column_name,
                        ccu.table_schema AS parent_schema,
                        ccu.table_name AS parent_table,
                        ccu.column_name AS parent_column
                    INTO child_parent_fk
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                       AND tc.constraint_schema = kcu.constraint_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                       AND ccu.constraint_schema = tc.constraint_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_schema = fk.foreign_schema
                      AND tc.table_name = fk.foreign_table
                      AND ccu.table_schema = parent_fk.foreign_schema
                      AND ccu.table_name = parent_fk.foreign_table
                      AND ccu.column_name = parent_fk.foreign_column
                    LIMIT 1;

                    IF child_parent_fk.column_name IS NOT NULL THEN
                        where_sql := format(
                            'WHERE %%I::text = $1',
                            child_parent_fk.column_name
                        );
                    ELSE
                        lookup := '[]'::jsonb;

                        result := jsonb_set(
                            result,
                            ARRAY[fk.column_name],
                            lookup,
                            true
                        );

                        CONTINUE;
                    END IF;
                END IF;
            END IF;

            IF where_sql <> '' THEN
                EXECUTE format(
                    'SELECT COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                ''value'', %%1$I::text,
                                ''label'', COALESCE(%%2$I::text, %%1$I::text)
                            )
                            ORDER BY COALESCE(%%2$I::text, %%1$I::text)
                        ),
                        ''[]''::jsonb
                    )
                    FROM %%3$I.%%4$I
                    %%5$s',
                    fk.foreign_column,
                    label_column,
                    fk.foreign_schema,
                    fk.foreign_table,
                    where_sql
                )
                INTO lookup
                USING p_parent_value;
            ELSE
                EXECUTE format(
                    'SELECT COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                ''value'', %%1$I::text,
                                ''label'', COALESCE(%%2$I::text, %%1$I::text)
                            )
                            ORDER BY COALESCE(%%2$I::text, %%1$I::text)
                        ),
                        ''[]''::jsonb
                    )
                    FROM %%3$I.%%4$I',
                    fk.foreign_column,
                    label_column,
                    fk.foreign_schema,
                    fk.foreign_table
                )
                INTO lookup;
            END IF;

            result := jsonb_set(
                result,
                ARRAY[fk.column_name],
                lookup,
                true
            );
        END LOOP;

        RETURN result;
    END;
    $fk$
    $sql$ , p_entity_schema);



  EXECUTE format('ALTER FUNCTION %1$I.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO %1$I', p_entity_schema);
  EXECUTE format('REVOKE ALL ON FUNCTION %1$I.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %1$I.get_foreign_key_options(TEXT, TEXT, TEXT, TEXT, TEXT) TO %1$I', p_entity_schema);


  EXECUTE format('ALTER SCHEMA %1$I OWNER TO %1$I', p_entity_schema);
  EXECUTE format('GRANT USAGE ON SCHEMA %1$I TO ec_app', p_entity_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %1$I TO ec_app', p_entity_schema);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %1$I TO ec_app', p_entity_schema);

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE ec IN SCHEMA %1$I  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ec_app', p_entity_schema);
END;
$$;

ALTER FUNCTION ec._ensure_tenant_objects(TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._ensure_tenant_objects(TEXT) TO ec_app;


-- =========================================================
-- ROLE / PERMISSION HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION ec._seed_roles_and_permissions(
  p_entity_schema TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
BEGIN
  EXECUTE format($sql$
    INSERT INTO %1$I.permission(key, description)
    VALUES
      ('crud:create', 'Create records'),
      ('crud:read', 'Read records'),
      ('crud:update', 'Update records'),
      ('crud:delete', 'Delete records')
    ON CONFLICT(key) DO NOTHING
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    INSERT INTO %1$I.role(org_id, key, name, description)
    VALUES
      (NULL, 'creator', 'Creator', 'Full access to tenant data'),
      (NULL, 'editor', 'Editor', 'Modify records'),
      (NULL, 'viewer', 'Viewer', 'Read-only access')
    ON CONFLICT(org_id, key) DO NOTHING
  $sql$, p_entity_schema);

  EXECUTE format($sql$
    INSERT INTO %1$I.role_permission(role_id, permission_id)
    SELECT r.id, p.id
    FROM %1$I.role r
    CROSS JOIN %1$I.permission p
    WHERE
      r.key = 'creator'
      OR (r.key = 'editor' AND p.key IN ('crud:read', 'crud:update'))
      OR (r.key = 'viewer' AND p.key = 'crud:read')
    ON CONFLICT DO NOTHING
  $sql$, p_entity_schema);
END;
$$;

ALTER FUNCTION ec._seed_roles_and_permissions(TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._seed_roles_and_permissions(TEXT) TO ec_app;


CREATE OR REPLACE FUNCTION ec._assign_role(
  p_entity_schema TEXT,
  p_user UUID,
  p_org UUID,
  p_role_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  v_role_id UUID;
BEGIN
  EXECUTE format(
    'SELECT id FROM %I.role WHERE key = $1 LIMIT 1',
    p_entity_schema
  )
  INTO v_role_id
  USING p_role_key;

  IF v_role_id IS NULL THEN
    RAISE NOTICE 'Role % not found in %', p_role_key, p_entity_schema;
    RETURN;
  END IF;

  EXECUTE format(
    'INSERT INTO %I.user_org(user_id, org_id)
     VALUES($1, $2)
     ON CONFLICT DO NOTHING',
    p_entity_schema
  )
  USING p_user, p_org;

  EXECUTE format(
    'INSERT INTO %I.user_org_role(user_id, org_id, role_id)
     VALUES($1, $2, $3)
     ON CONFLICT DO NOTHING',
    p_entity_schema
  )
  USING p_user, p_org, v_role_id;
END;
$$;

ALTER FUNCTION ec._assign_role(TEXT, UUID, UUID, TEXT) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._assign_role(TEXT, UUID, UUID, TEXT) TO ec_app;


CREATE OR REPLACE FUNCTION ec._apply_roles_and_permissions(
  p_entity_schema TEXT,
  p_user_id UUID,
  p_org_id UUID,
  p_roles TEXT[] DEFAULT '{}'::TEXT[],
  p_permissions TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  v_user JSONB;
BEGIN
  IF array_length(p_permissions, 1) IS NOT NULL THEN
    EXECUTE format($sql$
      INSERT INTO %1$I.permission(key, description, updated_at)
      SELECT DISTINCT p, NULL, now()
      FROM unnest($1::TEXT[]) p
      ON CONFLICT(key)
      DO UPDATE SET updated_at = now()
    $sql$, p_entity_schema)
    USING p_permissions;
  END IF;

  IF array_length(p_roles, 1) IS NOT NULL THEN
    EXECUTE format($sql$
      INSERT INTO %1$I.role(org_id, key, name, description, updated_at)
      SELECT $1, r, r, NULL, now()
      FROM unnest($2::TEXT[]) r
      ON CONFLICT(org_id, key)
      DO UPDATE SET updated_at = now()
    $sql$, p_entity_schema)
    USING p_org_id, p_roles;

    EXECUTE format($sql$
      INSERT INTO %1$I.user_org(user_id, org_id)
      VALUES($1, $2)
      ON CONFLICT DO NOTHING
    $sql$, p_entity_schema)
    USING p_user_id, p_org_id;

    EXECUTE format($sql$
      INSERT INTO %1$I.user_org_role(user_id, org_id, role_id)
      SELECT $1, $2, r.id
      FROM %1$I.role r
      WHERE r.org_id = $2
        AND r.key = ANY($3::TEXT[])
      ON CONFLICT DO NOTHING
    $sql$, p_entity_schema)
    USING p_user_id, p_org_id, p_roles;
  END IF;

  EXECUTE format($sql$
    WITH roles_by_org AS (
      SELECT
        uor.user_id,
        o.org_key,
        array_agg(DISTINCT r.key ORDER BY r.key) AS roles
      FROM %1$I.user_org_role uor
      JOIN %1$I.role r
        ON r.id = uor.role_id
      JOIN %1$I.organization o
        ON o.id = uor.org_id
      WHERE uor.user_id = $1
      GROUP BY uor.user_id, o.org_key
    )
    SELECT jsonb_build_object(
      'id', u.id,
      'auth0_sub', u.auth0_sub,
      'email', u.email,
      'name', u.name,
      'memberships', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'org_key', org_key,
              'roles', roles
            )
          )
          FROM roles_by_org
        ),
        '[]'::jsonb
      )
    )
    FROM %1$I."user" u
    WHERE u.id = $1
  $sql$, p_entity_schema)
  USING p_user_id
  INTO v_user;

  RETURN v_user;
END;
$$;

ALTER FUNCTION ec._apply_roles_and_permissions(TEXT, UUID, UUID, TEXT[], TEXT[]) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._apply_roles_and_permissions(TEXT, UUID, UUID, TEXT[], TEXT[]) TO ec_app;


CREATE OR REPLACE FUNCTION ec._upsert_tenant(
  p_sub TEXT,
  p_entity_schema TEXT,
  p_org_id UUID,
  p_roles TEXT[],
  p_permissions TEXT[],
  p_memberships JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
BEGIN
  INSERT INTO ec.tenant(
    sub,
    entity_schema,
    org_id,
    roles,
    permissions,
    memberships
  )
  VALUES (
    p_sub,
    p_entity_schema,
    p_org_id,
    p_roles,
    p_permissions,
    p_memberships
  )
  ON CONFLICT(sub)
  DO UPDATE SET
    entity_schema = EXCLUDED.entity_schema,
    org_id = EXCLUDED.org_id,
    roles = EXCLUDED.roles,
    permissions = EXCLUDED.permissions,
    memberships = EXCLUDED.memberships;
END;
$$;

ALTER FUNCTION ec._upsert_tenant(TEXT, TEXT, UUID, TEXT[], TEXT[], JSONB) OWNER TO ec;
GRANT EXECUTE ON FUNCTION ec._upsert_tenant(TEXT, TEXT, UUID, TEXT[], TEXT[], JSONB) TO ec_app;


-- =========================================================
-- PROVISION TENANT
-- =========================================================

CREATE OR REPLACE FUNCTION ec.provision_tenant(
  p_entity_schema TEXT,
  p_sub TEXT,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_picture TEXT DEFAULT NULL,
  p_given_name TEXT DEFAULT NULL,
  p_family_name TEXT DEFAULT NULL,
  p_locale TEXT DEFAULT 'en',
  p_roles TEXT[] DEFAULT '{}'::TEXT[],
  p_permissions TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_user JSONB;
  v_memberships JSONB;
  v_app_metadata JSONB;
BEGIN
  p_entity_schema := lower(trim(coalesce(p_entity_schema, 'public')));
  p_email := lower(p_email);

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    p_roles := ARRAY['creator']::TEXT[];
  END IF;

  IF p_permissions IS NULL OR array_length(p_permissions, 1) IS NULL THEN
    p_permissions := ARRAY[
      'crud:create',
      'crud:read',
      'crud:update',
      'crud:delete'
    ]::TEXT[];
  END IF;

  PERFORM ec._ensure_tenant_objects(p_entity_schema);

  PERFORM ec._seed_roles_and_permissions(p_entity_schema);

  EXECUTE format($sql$
    INSERT INTO %1$I.organization(org_key, name)
    VALUES($1, $1)
    ON CONFLICT(org_key) DO NOTHING
  $sql$, p_entity_schema)
  USING p_entity_schema;

  EXECUTE format(
    'SELECT id FROM %I.organization WHERE org_key = $1',
    p_entity_schema
  )
  INTO v_org_id
  USING p_entity_schema;

  EXECUTE format($sql$
    INSERT INTO %1$I."user"(
      auth0_sub,
      email,
      name,
      picture_url,
      given_name,
      family_name,
      locale,
      last_login_at,
      updated_at
    )
    VALUES($1, $2, $3, $4, $5, $6, $7, now(), now())
    ON CONFLICT(auth0_sub)
    DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      picture_url = EXCLUDED.picture_url,
      given_name = EXCLUDED.given_name,
      family_name = EXCLUDED.family_name,
      locale = EXCLUDED.locale,
      last_login_at = now(),
      updated_at = now()
    RETURNING id
  $sql$, p_entity_schema)
  USING
    p_sub,
    p_email,
    p_name,
    p_picture,
    p_given_name,
    p_family_name,
    p_locale
  INTO v_user_id;

  PERFORM ec._assign_role(
    p_entity_schema,
    v_user_id,
    v_org_id,
    'creator'
  );

  v_user := ec._apply_roles_and_permissions(
    p_entity_schema,
    v_user_id,
    v_org_id,
    p_roles,
    p_permissions
  );

  v_memberships := v_user->'memberships';

  PERFORM ec._upsert_tenant(
    p_sub,
    p_entity_schema,
    v_org_id,
    p_roles,
    p_permissions,
    v_memberships
  );

  v_app_metadata := jsonb_build_object(
    'sub', p_sub,
    'entity_schema', p_entity_schema,
    'org_id', v_org_id,
    'roles', p_roles,
    'permissions', p_permissions,
    'memberships', v_memberships
  );

  RETURN v_app_metadata;
END;
$$;

ALTER FUNCTION ec.provision_tenant(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[]
) OWNER TO ec;

GRANT EXECUTE ON FUNCTION ec.provision_tenant(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[]
) TO ec_app;


-- =========================================================
-- FINAL LOCKDOWN
-- =========================================================

REVOKE ALL ON SCHEMA ec FROM PUBLIC;
GRANT USAGE ON SCHEMA ec TO ec_app;

REVOKE ALL ON ALL TABLES IN SCHEMA ec FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON ec.tenant TO ec_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ec.entity TO ec_app;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ec FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ec._upsert_entity(TEXT, TEXT, JSONB) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.create_entity(TEXT, TEXT, JSONB) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.list_entities(TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.get_entity(TEXT, TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.manage_entity(TEXT, TEXT, TEXT, UUID, JSONB) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.get_column_options(TEXT, TEXT, TEXT, TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.get_form_metadata(TEXT, TEXT) TO ec_app;

GRANT EXECUTE ON FUNCTION ec._ensure_tenant_objects(TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec._seed_roles_and_permissions(TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec._assign_role(TEXT, UUID, UUID, TEXT) TO ec_app;
GRANT EXECUTE ON FUNCTION ec._apply_roles_and_permissions(TEXT, UUID, UUID, TEXT[], TEXT[]) TO ec_app;
GRANT EXECUTE ON FUNCTION ec._upsert_tenant(TEXT, TEXT, UUID, TEXT[], TEXT[], JSONB) TO ec_app;
GRANT EXECUTE ON FUNCTION ec.provision_tenant(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[]) TO ec_app;
