import asyncpg
from app.core.runtime import get_adapter_module

# use the same adapter architecture as other CRUD routes
_adapter = get_adapter_module()

async def get_template(entity_name: str):
    """
    Fetch a JSON template for an entity from ec.entity_config.
    """
    pool: asyncpg.Pool = await _adapter.get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT template
            FROM ec.entity_config
            WHERE entity_name = $1
            """,
            entity_name,
        )
        return row["template"] if row else None


async def save_template(entity_name: str, payload: dict):
    """
    Insert or update a JSON template for an entity.
    Delegates to stored function ec.insertTemplate(schema_name, entity_name, template)
    if available, otherwise upserts directly.
    """
    pool: asyncpg.Pool = await _adapter.get_asyncpg_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ec.entity_config (entity_name, schema_name, template)
            VALUES ($1, current_schema(), $2)
                ON CONFLICT (entity_name)
            DO UPDATE SET template = EXCLUDED.template
            """,
            entity_name,
            payload,
        )
        return {"status": "ok", "entity_name": entity_name}
