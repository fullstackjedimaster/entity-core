import asyncpg
from app.core.runtime import get_adapter_module

# use the same adapter architecture as other CRUD routes
_adapter = get_adapter_module()

async def get_template(entity_name: str):
    """
    Fetch a JSON entity for an entity from ec.entity_config.
    """
    pool: asyncpg.Pool = await _adapter.get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT entity
            FROM ec.entity
            WHERE entity_name = $1
            """,
            entity_name,
        )
        return row["entity_json"] if row else None


async def save_template(entity_name: str, payload: dict):
    """
    Insert or update a JSON entity for an entity.
    Delegates to stored function ec.insertTemplate(schema_name, entity_name, entity)
    if available, otherwise upserts directly.
    """
    pool: asyncpg.Pool = await _adapter.get_asyncpg_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ec.entity (entity_name, schema_name, entity_json)
            VALUES ($1, current_schema(), $2)
                ON CONFLICT (entity_name)
            DO UPDATE SET entity_json = EXCLUDED.entity_json
            """,
            entity_name,
            payload,
        )
        return {"status": "ok", "entity_name": entity_name}
