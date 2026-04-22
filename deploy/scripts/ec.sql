CREATE SCHEMA IF NOT EXISTS ec AUTHORIZATION ec;

ALTER ROLE ec SET search_path = ec, public;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


CREATE TABLE IF NOT EXISTS ec.entity(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_schema_entity_idx
  ON ec.entity(lower(schema), lower(entity));

CREATE TABLE IF NOT EXISTS ec.tenant(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub TEXT UNIQUE NOT NULL,
  schema TEXT NOT NULL,
  org_id TEXT NOT NULL,
  roles text[] DEFAULT '{}'::text[],
  permissions text[] DEFAULT '{}'::text[],
   memberships jsonb DEFAULT '[]'::jsonb

);



CREATE UNIQUE INDEX IF NOT EXISTS tenant_sub_idx
  ON ec.tenant(lower(sub));

-- 2. Insert/update function with full JSON payload (meta-wrapped)
CREATE OR REPLACE FUNCTION ec._upsert_tenant(
  p_sub TEXT,
  p_schema TEXT,
   p_org_id UUID,
  p_roles TEXT[],
   p_permissions TEXT[],
    p_memberships JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ec.tenant(sub, schema,  org_Id, roles , permissions, memberships )
  VALUES (p_sub, p_schema,p_org_id , p_roles , p_permissions , p_memberships)
  ON CONFLICT (sub)
  DO UPDATE SET sub = EXCLUDED.sub,
      schema = EXCLUDED.schema,
      org_id = EXCLUDED.org_id ,
      roles = EXCLUDED.roles,
      permissions =  EXCLUDED.permissions,
      memberships =  EXCLUDED.memberships;
END;
$$;

CREATE OR REPLACE FUNCTION ec.provision_status(
  p_sub TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN

  SELECT jsonb_build_object(
    'schema', schema,
    'org_id', org_id,
    'roles', roles,
    'permissions', permissions,
    'memberships', memberships
  )
  INTO result
  FROM ec.tenant
  WHERE sub = p_sub;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- 2. Insert/update function with full JSON payload (meta-wrapped)
CREATE OR REPLACE FUNCTION ec._upsert_entity(
  p_schema TEXT,
  p_entity TEXT,
  p_entity_json    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF schema IS NULL OR trim(schema) = '' THEN
    RAISE EXCEPTION 'upsert_entity: schema is required';
  END IF;

  IF entity IS NULL OR trim(entity) = '' THEN
    RAISE EXCEPTION 'upsert_entity: entity is required';
  END IF;

  IF entity_json IS NULL OR entity_json::text = '{}' THEN
    RAISE EXCEPTION 'upsert_entity: entity_json must be a non-empty JSON object';
  END IF;

  INSERT INTO ec.entity(schema, entity, entity_json)
  VALUES (p_schema, p_entity, p_entity_json)
  ON CONFLICT (entity)
  DO UPDATE SET entity_json = EXCLUDED.entity_json;
END;
$$;

ALTER FUNCTION ec._upsert_entity(TEXT, TEXT, JSONB) OWNER TO ec;


CREATE OR REPLACE FUNCTION ec.get_entity(
  p_schema TEXT,
  p_entity TEXT,
  p_entity_json TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT entity_json INTO result
  FROM ec.entity
  WHERE entity = p_entity
    AND schema = p_schema;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;


ALTER FUNCTION ec.get_entity(TEXT, TEXT, TEXT) OWNER TO ec;

CREATE OR REPLACE FUNCTION ec.list_entities(
  p_schema TEXT
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
       result JSONB;
BEGIN
  SELECT entity INTO result
  FROM ec.entity
  WHERE schema = p_schema;

RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

ALTER FUNCTION ec.list_entities(TEXT) OWNER TO ec;


CREATE OR REPLACE FUNCTION ec.get_column_options(
  p_schema TEXT,
  p_entity TEXT,
  p_column TEXT,
  p_filter TEXT DEFAULT NULL
)
RETURNS TABLE (value TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  tmpl JSONB;
BEGIN
  -- Fetch entity for schema + entity
  SELECT entity_json INTO tmpl
  FROM ec.entity
  WHERE schema = p_schema AND entity = p_entity;

  IF tmpl IS NULL THEN
    RAISE EXCEPTION 'No entity_json found for %.%', p_schema, p_entity;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT j->>%L AS value
     FROM jsonb_array_elements($1->''entity_json''->%L->%L) AS j
     WHERE j->>%L IS NOT NULL %s
     ORDER BY value',
     p_column, p_entity, p_column, p_column,
     CASE WHEN p_filter IS NOT NULL THEN
       format('AND j->>%L ILIKE ''%%%s%%''', p_column, p_filter)
     ELSE
       ''
     END
  ) USING tmpl;
END;
$$;

CREATE OR REPLACE FUNCTION ec.get_form_metadata(
  p_schema TEXT,
  p_entity TEXT
)
RETURNS TABLE (entity_json JSONB)
LANGUAGE plpgsql AS $$
BEGIN
  SELECT entity_json
  FROM ec.entity
  WHERE schema = p_schema AND entity = p_entity;
END;
$$;


CREATE OR REPLACE FUNCTION ec.manage_entity(
  operation text,
  entity text,
  id uuid DEFAULT NULL,
  data json DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ec, public
AS $$
DECLARE
  result json;
  cfg RECORD;
  col RECORD;
  col_names text := '';
  col_values text := '';
  update_pairs text := '';
  query text;
  zero_uuid constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  target_schema text := lower(NULLIF(data->>'__schema',''));
  table_name text := entity;
BEGIN
  operation := lower(coalesce(operation,''));
  entity := lower(coalesce(entity,''));

  -- Fetch matching entity config from ec.entity
  IF target_schema IS NOT NULL THEN
    SELECT * INTO cfg
    FROM ec.entity
    WHERE lower(entity) = entity AND lower(schema) = target_schema;
  ELSE
    SELECT * INTO cfg
    FROM ec.entity
    WHERE lower(entity) = entity
    ORDER BY schema
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No config found for entity=%, schema=%', entity, target_schema;
  END IF;

  -- CREATE
  IF operation = 'create' THEN
    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = cfg.schema
        AND table_name = table_name
        AND column_name <> 'id'
        AND column_name NOT IN ('last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      col_names := col_names || format('%I, ', col.column_name);
      col_values := col_values || COALESCE(
        CASE col.data_type
          WHEN 'uuid'                          THEN format('%L::uuid',        data->>col.column_name)
          WHEN 'integer'                       THEN format('%L::int',         data->>col.column_name)
          WHEN 'bigint'                        THEN format('%L::bigint',      data->>col.column_name)
          WHEN 'numeric'                       THEN format('%L::numeric',     data->>col.column_name)
          WHEN 'boolean'                       THEN format('%L::boolean',     data->>col.column_name)
          WHEN 'json'                          THEN format('%L::json',        data->>col.column_name)
          WHEN 'jsonb'                         THEN format('%L::jsonb',       data->>col.column_name)
          WHEN 'date'                          THEN format('%L::date',        data->>col.column_name)
          WHEN 'timestamp without time zone'   THEN format('%L::timestamp',   data->>col.column_name)
          WHEN 'timestamp with time zone'      THEN format('%L::timestamptz', data->>col.column_name)
          WHEN 'citext'                        THEN format('%L::citext',      data->>col.column_name)
          ELSE                                       format('%L',              data->>col.column_name)
        END, 'NULL'
      ) || ', ';
    END LOOP;

    IF col_names = '' THEN
      query := format(
        'INSERT INTO %I.%I DEFAULT VALUES RETURNING to_jsonb(%I.*)',
        cfg.schema, table_name, table_name
      );
    ELSE
      col_names := left(col_names, length(col_names) - 2);
      col_values := left(col_values, length(col_values) - 2);
      query := format(
        'INSERT INTO %I.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)',
        cfg.schema, table_name, col_names, col_values, table_name
      );
    END IF;
    EXECUTE query INTO result;

  -- READ
  ELSIF operation = 'read' THEN
    IF id IS NULL OR id = zero_uuid THEN
      query := format(
        'SELECT COALESCE(json_agg(to_jsonb(t.*)), ''[]''::json) FROM %I.%I t',
        cfg.schema, table_name
      );
    ELSE
      query := format(
        'SELECT to_jsonb(t.*) FROM %I.%I t WHERE id = %L::uuid',
        cfg.schema, table_name, id::text
      );
    END IF;
    EXECUTE query INTO result;

  -- LIST / SELECT
  ELSIF operation IN ('list', 'select') THEN
    query := format(
      'SELECT COALESCE(json_agg(to_jsonb(t.*)), ''[]''::json) FROM %I.%I t',
      cfg.schema, table_name
    );
    EXECUTE query INTO result;

  -- UPDATE
  ELSIF operation = 'update' THEN
    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'update requires a valid id';
    END IF;

    FOR col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = cfg.schema
        AND table_name = table_name
        AND column_name <> 'id'
        AND column_name NOT IN ('last_updated_at', 'last_updated_by')
      ORDER BY ordinal_position
    LOOP
      update_pairs := update_pairs || format('%I = ', col.column_name) || COALESCE(
        CASE col.data_type
          WHEN 'uuid'                          THEN format('%L::uuid',        data->>col.column_name)
          WHEN 'integer'                       THEN format('%L::int',         data->>col.column_name)
          WHEN 'bigint'                        THEN format('%L::bigint',      data->>col.column_name)
          WHEN 'numeric'                       THEN format('%L::numeric',     data->>col.column_name)
          WHEN 'boolean'                       THEN format('%L::boolean',     data->>col.column_name)
          WHEN 'json'                          THEN format('%L::json',        data->>col.column_name)
          WHEN 'jsonb'                         THEN format('%L::jsonb',       data->>col.column_name)
          WHEN 'date'                          THEN format('%L::date',        data->>col.column_name)
          WHEN 'timestamp without time zone'   THEN format('%L::timestamp',   data->>col.column_name)
          WHEN 'timestamp with time zone'      THEN format('%L::timestamptz', data->>col.column_name)
          WHEN 'citext'                        THEN format('%L::citext',      data->>col.column_name)
          ELSE                                       format('%L',              data->>col.column_name)
        END, 'NULL'
      ) || ', ';
    END LOOP;

    update_pairs := left(update_pairs, length(update_pairs) - 2);
    query := format(
      'UPDATE %I.%I SET %s WHERE id = %L::uuid RETURNING to_jsonb(%I.*)',
      cfg.schema, table_name, update_pairs, id::text, table_name
    );
    EXECUTE query INTO result;

  -- DELETE
  ELSIF operation = 'delete' THEN
    IF id IS NULL OR id = zero_uuid THEN
      RAISE EXCEPTION 'delete requires a valid id';
    END IF;
    query := format(
      'DELETE FROM %I.%I WHERE id = %L::uuid RETURNING to_jsonb(%I.*)',
      cfg.schema, table_name, id::text, table_name
    );
    EXECUTE query INTO result;

  -- Unsupported
  ELSE
    RAISE EXCEPTION 'Unsupported operation: %', operation;
  END IF;

  RETURN result;
END;
$$;

ALTER FUNCTION ec.manage_entity(text, text, uuid, json) OWNER TO ec;

CREATE OR REPLACE FUNCTION ec._ensure_tenant_tables(p_schema text)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER PARALLEL UNSAFE
AS $$
BEGIN
	EXECUTE format($ddl$ CREATE TABLE IF NOT EXISTS %1$I.organization (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		org_key text UNIQUE NOT NULL,
		name text NOT NULL,
		parent_org_id uuid NULL REFERENCES %1$I.organization(id),
		created_at timestamptz DEFAULT now(),
		updated_at timestamptz DEFAULT now()
	);

	CREATE TABLE IF NOT EXISTS %1$I."user" (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		auth0_sub text UNIQUE NOT NULL,
		email text NOT NULL,
		name text,
		picture_url text,
		given_name text,
		family_name text,
		locale text,
		last_login_at timestamptz DEFAULT now(),
		created_at timestamptz DEFAULT now(),
		updated_at timestamptz DEFAULT now()
	);

	CREATE TABLE IF NOT EXISTS %1$I.role (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
		key text NOT NULL,
		name text NOT NULL,
		description text,
		created_at timestamptz DEFAULT now(),
		updated_at timestamptz DEFAULT now(),
		UNIQUE (org_id, key)
	);

	CREATE TABLE IF NOT EXISTS %1$I.permission (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		key text UNIQUE NOT NULL, description text,
		created_at timestamptz DEFAULT now(),
		updated_at timestamptz DEFAULT now()
	);

	CREATE TABLE IF NOT EXISTS %1$I.user_org (
		user_id uuid REFERENCES %1$I."user"(id) ON DELETE CASCADE,
		org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
		PRIMARY KEY (user_id, org_id)
	);

	CREATE TABLE IF NOT EXISTS %1$I.user_org_role (
		user_id uuid REFERENCES %1$I."user"(id) ON DELETE CASCADE,
		org_id uuid REFERENCES %1$I.organization(id) ON DELETE CASCADE,
		role_id uuid REFERENCES %1$I.role(id) ON DELETE CASCADE,
		PRIMARY KEY (user_id, org_id, role_id)
	);

	CREATE TABLE IF NOT EXISTS %1$I.role_permission (
		role_id uuid REFERENCES %1$I.role(id) ON DELETE CASCADE,
		permission_id uuid REFERENCES %1$I.permission(id) ON DELETE CASCADE,
		PRIMARY KEY (role_id, permission_id)
	);
	$ddl$, p_schema);
END;
$$;

ALTER FUNCTION ec._ensure_tenant_tables(text) OWNER TO ec;

CREATE OR REPLACE FUNCTION ec._seed_roles_and_permissions(
		p_schema text
	)
RETURNS void
LANGUAGE 'plpgsql'
VOLATILE PARALLEL UNSAFE
AS $$

BEGIN

	EXECUTE format($sql$ INSERT INTO %1$I.permission (
		key,
		description
		)
		VALUES ('crud:create', 'Create records'),
			('crud:read', 'Read records'),
			('crud:update', 'Update records'),
			('crud:delete', 'Delete records')
		ON CONFLICT (key) DO NOTHING;
	$sql$, p_schema);

	EXECUTE format($sql$ INSERT INTO %1$I.role (
		org_id,
		key,
		name,
		description
		)
		VALUES (NULL,'creator','Creator','Full access to tenant data'),
			(NULL, 'editor', 'Editor', 'Modify records'),
			(NULL, 'viewer', 'Viewer', 'Read-only access')
		ON CONFLICT (org_id, key) DO NOTHING;
	$sql$, p_schema);

	EXECUTE format($sql$ INSERT INTO %1$I.role_permission (
		role_id,
		permission_id
		)
		SELECT r.id, p.id
		FROM %1$I.role r, %1$I.permission p
		WHERE (r.key = 'creator')
		OR (r.key = 'editor' AND p.key IN ('crud:read','crud:update'))
		OR (r.key = 'viewer' AND p.key = 'crud:read')
		ON CONFLICT DO NOTHING;
	$sql$, p_schema);
END;
$$;

ALTER FUNCTION ec._seed_roles_and_permissions(text) OWNER TO ec;


CREATE OR REPLACE FUNCTION ec._apply_roles_and_permissions(
    p_schema text,
    p_user_id uuid,
    p_org_id uuid,
    p_roles text[] DEFAULT '{}'::text[],
    p_permissions text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER PARALLEL UNSAFE
AS $$
DECLARE
  v_item jsonb;
  v_org_key text;
  v_parent_key text;
  v_roles text[];
  v_org_id uuid;
  v_parent_id uuid;
  v_sql text;
  v_user jsonb;
  v_root_org_key text;
BEGIN
  EXECUTE format(
    'SELECT org_key FROM %I.organization WHERE id = $1',
    p_schema
  )
  INTO v_root_org_key
  USING p_org_id;

  IF array_length(p_permissions, 1) IS NOT NULL THEN
    EXECUTE format($fmt$
      INSERT INTO %1$I.permission (key, description, updated_at)
      SELECT DISTINCT p, NULL, now()
      FROM unnest($1::text[]) p
      ON CONFLICT (key) DO UPDATE
        SET updated_at = now();
    $fmt$, p_schema)
    USING p_permissions;
  END IF;


    v_org_key := coalesce(v_item->>'org_key', v_root_org_key);
    v_parent_key := NULLIF(trim(v_item->>'parent_key'), '');
    v_roles := p_roles;

    IF v_parent_key IS NOT NULL THEN
      EXECUTE format($fmt$
        INSERT INTO %1$I.organization (org_key, name)
        VALUES (%2$L, %2$L)
        ON CONFLICT (org_key) DO NOTHING;
      $fmt$, p_schema, v_parent_key);

      EXECUTE format(
        'SELECT id FROM %I.organization WHERE org_key = %L',
        p_schema,
        v_parent_key
      )
      INTO v_parent_id;
    ELSE
      v_parent_id := p_org_id;
    END IF;

    EXECUTE format($fmt$
      INSERT INTO %1$I.organization (org_key, name, parent_org_id)
      VALUES (%2$L, %2$L, %3$L)
      ON CONFLICT (org_key) DO UPDATE
        SET parent_org_id = COALESCE(%3$L, %1$I.organization.parent_org_id),
            updated_at = now();
    $fmt$, p_schema, v_org_key, v_parent_id);

    EXECUTE format(
      'SELECT id FROM %I.organization WHERE org_key = %L',
      p_schema,
      v_org_key
    )
    INTO v_org_id;

    EXECUTE format($fmt$
      INSERT INTO %1$I.user_org (user_id, org_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    $fmt$, p_schema)
    USING p_user_id, v_org_id;

    IF array_length(v_roles, 1) IS NOT NULL THEN
      EXECUTE format($fmt$
        INSERT INTO %1$I.role (org_id, key, name, description, updated_at)
        SELECT $1, r, r, NULL, now()
        FROM unnest($2::text[]) r
        ON CONFLICT (org_id, key) DO UPDATE
          SET updated_at = now();
      $fmt$, p_schema)
      USING v_org_id, v_roles;

      EXECUTE format($fmt$
        INSERT INTO %1$I.user_org_role (user_id, org_id, role_id)
        SELECT $1, $2, r.id
        FROM %1$I.role r
        WHERE r.org_id = $2
          AND r.key = ANY($3::text[])
        ON CONFLICT DO NOTHING;
      $fmt$, p_schema)
      USING p_user_id, v_org_id, v_roles;
    END IF;


  v_sql := format($fmt$
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
    WHERE u.id = $1;
  $fmt$, p_schema);

  EXECUTE v_sql USING p_user_id INTO v_user;
  RETURN v_user;
END;
$$;

ALTER FUNCTION ec._apply_roles_and_permissions(text, uuid, uuid, text[], text[])
    OWNER TO ec;

CREATE OR REPLACE FUNCTION ec._assign_role(
	p_schema text,
	p_user uuid,
	p_org uuid,
	p_role_key text
	)
RETURNS void
LANGUAGE plpgsql
VOLATILE PARALLEL UNSAFE
AS $$
DECLARE v_role_id uuid;
BEGIN
	EXECUTE format('SELECT id FROM %I.role WHERE key=%L LIMIT 1', p_schema, p_role_key)
	INTO v_role_id;
	IF v_role_id IS NULL THEN
		RAISE NOTICE 'Role % not found in %', p_role_key, p_schema;
		RETURN;
	END IF;

	EXECUTE format('INSERT INTO %I.user_org(user_id, org_id) VALUES($1,$2) ON CONFLICT DO NOTHING', p_schema)
	USING p_user, p_org;

	EXECUTE format('INSERT INTO %I.user_org_role(user_id, org_id, role_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', p_schema)
	USING p_user, p_org, v_role_id;
END;
$$;

ALTER FUNCTION ec._assign_role(text, uuid, uuid,  text)
    OWNER TO ec;

CREATE OR REPLACE FUNCTION ec.provision_tenant(
    p_schema text,
    p_sub text,
    p_email text,
    p_name text DEFAULT NULL::text,
    p_picture text DEFAULT NULL::text,
    p_given_name text DEFAULT NULL::text,
    p_family_name text DEFAULT NULL::text,
    p_locale text DEFAULT 'en'::text,
    p_roles text[] DEFAULT '{}'::text[],
    p_permissions text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER PARALLEL UNSAFE
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_user jsonb;
  v_app_metadata jsonb;
  v_roles text[];
  v_permissions text[];
  v_memberships jsonb;
BEGIN
  -- 1️⃣ Normalize schema key
  p_schema := lower(trim(coalesce(p_schema, 'public')));
  p_email  := lower(p_email);

  -- 2️⃣ Ensure schema exists
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION CURRENT_USER', p_schema);

  -- 3️⃣ Ensure baseline tables
  PERFORM ec._ensure_tenant_tables(p_schema);

  -- 4️⃣ Seed baseline roles and permissions
  PERFORM ec._seed_roles_and_permissions(p_schema);

  -- 5️⃣ Root organization
  EXECUTE format($org$
    INSERT INTO %1$I.organization (org_key, name)
    VALUES (%2$L, %2$L)
    ON CONFLICT (org_key) DO NOTHING;
  $org$, p_schema, p_schema);

  EXECUTE format('SELECT id FROM %I.organization WHERE org_key=%L', p_schema, p_schema)
    INTO v_org_id;

  -- 6️⃣ Upsert initial user
  EXECUTE format($usr$
    INSERT INTO %1$I."user" (auth0_sub, email, name, picture_url, given_name, family_name, locale, last_login_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
    ON CONFLICT (auth0_sub)
      DO UPDATE SET email=$2, name=$3, picture_url=$4, given_name=$5, family_name=$6, locale=$7, last_login_at=now(), updated_at=now()
    RETURNING id;
  $usr$, p_schema)
  USING p_sub, p_email, p_name, p_picture, p_given_name, p_family_name, p_locale
  INTO v_user_id;

  -- 7️⃣ Assign creator role to root org
  PERFORM ec._assign_role(p_schema, v_user_id, v_org_id, 'creator');

  -- 8️⃣ Apply extended roles and permissions (from Auth0)
  v_user := ec._apply_roles_and_permissions(
      p_schema,
      v_user_id,
      v_org_id,
      p_roles,
      p_permissions
  );

  v_memberships := v_user->>'memberships';


--  PERFORM ec._upsert_tenant(p_sub, p_schema, v_org_id, v_roles, p_permissions, v_memberships);

  -- 9️⃣ Return unified summary
  v_app_metadata := jsonb_build_object(
    'sub', p_sub,
    'schema', p_schema,
    'org_id', v_org_id,
    'roles', p_roles,
    'permissions', p_permissions,
    'memberships', v_memberships
  );
  RETURN v_app_metadata;
END;
$$;



CREATE OR REPLACE FUNCTION ec.create_entity(_schema TEXT, _entity TEXT, _entity_json JSONB )
RETURNS VOID
LANGUAGE plpgsql
AS
$$
DECLARE k TEXT;
v JSONB;
coltype TEXT;
has_table BOOLEAN;
BEGIN

	SELECT EXISTS ( SELECT 1
		FROM information_schema.tables
		WHERE table_schema = _schema
		AND table_name = _entity )
		INTO has_table;

	IF NOT has_table THEN
     		EXECUTE format( 'CREATE TABLE %I.%I ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(),
			 updated_at timestamptz DEFAULT now() )', _schema, _entity);
     	END IF;
     	FOR k, v IN SELECT key, value FROM jsonb_each(_entity_json -> _entity)
     	    LOOP
     	    	coltype := CASE jsonb_typeof(v)
     	    			WHEN 'number' THEN 'numeric'
     	    			WHEN 'boolean' THEN 'boolean'
     	    			WHEN 'object' THEN 'jsonb'
     	    			WHEN 'array' THEN 'jsonb'
     	    			ELSE 'text'
     	    		  END;
     		IF NOT EXISTS ( SELECT 1
     				FROM information_schema.columns
     				WHERE table_schema = _schema
     				AND table_name = _entity
     				AND column_name = k ) THEN
     			EXECUTE format('ALTER TABLE %I.%I ADD COLUMN %I %s', _schema, _entity, k, coltype);
     		END IF;
     	   END LOOP;
	PERFORM ec._upsert_entity(_schema, _entity, _entity_json);
END;
$$;

ALTER FUNCTION ec.create_entity(TEXT, TEXT, JSONB) OWNER TO ec;
