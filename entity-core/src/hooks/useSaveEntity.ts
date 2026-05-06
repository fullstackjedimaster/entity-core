'use client';

import { useState } from 'react';
import { useCrudApi, ZERO_UUID } from '@/lib/apiCrud';

interface UseSaveEntityConfig {
    entityName: string;
    primaryKey: string;
}

interface SaveResult {
    success?: boolean;
    data?: any;
    message?: string;
    [key: string]: any;
}

/**
 * useSaveEntity
 *
 * Saves entity row data through the normalized CRUD API.
 *
 * Tenant/entity_schema is NOT sent in the body.
 * It comes from:
 * Auth0 token -> entity-core-api -> internal token -> entity-server claims.
 */
export function useSaveEntity(config: UseSaveEntityConfig) {
    const { entityName, primaryKey } = config;
    const api = useCrudApi();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SaveResult | null>(null);

    async function save(data: Record<string, any>): Promise<SaveResult> {
        setLoading(true);
        setError(null);

        try {
            const rawId = data?.[primaryKey];
            const id =
                typeof rawId === 'string' && rawId.trim()
                    ? rawId
                    : null;

            const json =
                id && id !== ZERO_UUID
                    ? await api.update(entityName, id, data)
                    : await api.create(entityName, data);

            const saveResult = json as SaveResult;

            setResult(saveResult);
            return saveResult;
        } catch (err: any) {
            const message = err?.message ?? 'Unknown save error';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }

    return {
        save,
        loading,
        error,
        result,
    };
}