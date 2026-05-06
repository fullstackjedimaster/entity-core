'use client';

import { useAuthedFetch } from '@/hooks/useAuthedFetch';

export const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export type CrudOperation = 'list' | 'read' | 'create' | 'update' | 'delete';

export interface RequestEnvelope {
    operation: CrudOperation;
    target: string;
    id?: string | null;
    data?: Record<string, unknown> | null;
    args?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}

export interface EntityDataItemInfo {
    id: string;
    [key: string]: unknown;
}

async function handle<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
}

export function useCrudApi() {
    const authedFetch = useAuthedFetch();

    const postEnvelope = async <T>(entityName: string, envelope: RequestEnvelope) => {
        const resp = await authedFetch(`/crud/${entityName}`, {
            method: 'POST',
            body: JSON.stringify(envelope),
        });

        return handle<T>(resp);
    };

    return {
        list: async (entityName: string) => {
            return postEnvelope<{ items: EntityDataItemInfo[] }>(entityName, {
                operation: 'list',
                target: entityName,
                id: ZERO_UUID,
                data: {},
                args: {},
                meta: {
                    source: 'entity-core:apiCrud.list',
                },
            });
        },

        get: async (entityName: string, id: string) => {
            return postEnvelope<{ items: unknown }>(entityName, {
                operation: 'read',
                target: entityName,
                id,
                data: {},
                args: {},
                meta: {
                    source: 'entity-core:apiCrud.get',
                },
            });
        },

        create: async (
            entityName: string,
            data: Record<string, unknown>
        ) => {
            return postEnvelope<{ items: unknown }>(entityName, {
                operation: 'create',
                target: entityName,
                id: null,
                data,
                args: {},
                meta: {
                    source: 'entity-core:apiCrud.create',
                },
            });
        },

        update: async (
            entityName: string,
            id: string,
            data: Record<string, unknown>
        ) => {
            return postEnvelope<{ items: unknown }>(entityName, {
                operation: 'update',
                target: entityName,
                id,
                data,
                args: {},
                meta: {
                    source: 'entity-core:apiCrud.update',
                },
            });
        },

        delete: async (entityName: string, id: string) => {
            return postEnvelope<{ items: unknown }>(entityName, {
                operation: 'delete',
                target: entityName,
                id,
                data: {},
                args: {},
                meta: {
                    source: 'entity-core:apiCrud.delete',
                },
            });
        },
    };
}