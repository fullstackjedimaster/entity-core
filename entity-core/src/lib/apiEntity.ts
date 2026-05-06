'use client';

import { useAuthedFetch } from '@/hooks/useAuthedFetch';

export interface EntityInfo {
    entity_name: string;
}

export interface EntityPayload {
    entity_json: Record<string, unknown>;
}

async function handle<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
}

export function useEntityApi() {
    const authedFetch = useAuthedFetch();

    return {
        list: async () => {
            const resp = await authedFetch('/api/entities');
            return handle<{ entities: EntityInfo[] }>(resp);
        },

        get: async (entityName: string) => {
            const resp = await authedFetch(`/api/entities/${entityName}`);
            return handle<unknown>(resp);
        },

        save: async (
            entityName: string,
            entityJson: Record<string, unknown>
        ) => {
            const resp = await authedFetch(`/api/entities/${entityName}`, {
                method: 'POST',
                body: JSON.stringify({
                    entity_json: entityJson,
                }),
            });

            return handle<unknown>(resp);
        },

        getFormMetadata: async (entityName: string) => {
            const resp = await authedFetch(
                `/api/entities/${entityName}/form_metadata`
            );

            return handle<unknown>(resp);
        },

        getColumnOptions: async (
            entityName: string,
            column: string,
            filter?: string
        ) => {
            const qs = filter
                ? `?filter=${encodeURIComponent(filter)}`
                : '';

            const resp = await authedFetch(
                `/api/entities/${entityName}/options/${column}${qs}`
            );

            return handle<unknown[]>(resp);
        },
    };
}