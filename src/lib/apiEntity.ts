'use client';

import { useMemo } from 'react';
import { useAuthedFetch } from '@/hooks/useAuthedFetch';

export interface EntityInfo {
    entity_name: string;
}

export interface EntityPayload {
    entity_json: Record<string, unknown>;
}

export type OptionItem = {
    value: string | number;
    label: string;
};

export type ForeignKeyOptionsParams = {
    parentField?: string;
    parentValue?: string | number | null;
};

async function handle<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
}

export function useEntityApi() {
    const authedFetch = useAuthedFetch();

    return useMemo(
        () => ({
            list: async () => {
                const resp = await authedFetch('/entities');
                return handle<{ entities: EntityInfo[] }>(resp);
            },

            get: async (entityName: string) => {
                const resp = await authedFetch(`/entities/${entityName}`);
                return handle<unknown>(resp);
            },

            save: async (
                entityName: string,
                entityJson: Record<string, unknown>
            ) => {
                const resp = await authedFetch(`/entities/${entityName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        entity_json: entityJson,
                    }),
                });

                return handle<unknown>(resp);
            },

            getFormMetadata: async (entityName: string) => {
                const resp = await authedFetch(
                    `/entities/${entityName}/form_metadata`
                );

                return handle<unknown>(resp);
            },

            getColumnOptions: async (
                entityName: string,
                column: string,
                filter?: string
            ) => {
                const qs = new URLSearchParams();

                if (filter) {
                    qs.set('filter', filter);
                }

                const suffix = qs.toString() ? `?${qs.toString()}` : '';

                const resp = await authedFetch(
                    `/entities/${entityName}/options/${column}${suffix}`
                );

                return handle<OptionItem[]>(resp);
            },

            getForeignKeyOptions: async (
                entityName: string,
                column: string,
                params: ForeignKeyOptionsParams = {}
            ) => {
                const qs = new URLSearchParams();

                if (params.parentField) {
                    qs.set('parentField', params.parentField);
                }

                if (
                    params.parentValue !== undefined &&
                    params.parentValue !== null &&
                    params.parentValue !== ''
                ) {
                    qs.set('parentValue', String(params.parentValue));
                }

                const suffix = qs.toString() ? `?${qs.toString()}` : '';

                const resp = await authedFetch(
                    `/entities/${entityName}/foreign-key-options/${column}${suffix}`
                );

                return handle<OptionItem[]>(resp);
            },
        }),
        [authedFetch]
    );
}