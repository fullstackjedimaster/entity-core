import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrudApi, ZERO_UUID } from '@/lib/apiCrud';

export function useEntityData() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const api = useCrudApi();

    const [entityData, setEntityData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadEntityData = useCallback(
        async (id: string, target: string) => {
            if (authLoading || !isAuthenticated || !id || id === ZERO_UUID) {
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const result = await api.get(target, id);
                setEntityData(result);
                return result;
            } catch (err: any) {
                setError(err?.message ?? 'Failed to load entity data');
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [api, authLoading, isAuthenticated]
    );

    const saveEntityData = useCallback(
        async (
            id: string | null,
            target: string,
            data: Record<string, unknown> | null
        ) => {
            if (!isAuthenticated) throw new Error('Not authenticated');
            if (!target) throw new Error('Missing target entity');

            setIsLoading(true);
            setError(null);

            try {
                let result: unknown;

                if (!data) {
                    if (!id || id === ZERO_UUID) {
                        throw new Error('Cannot delete without a real id');
                    }

                    result = await api.delete(target, id);
                } else if (id && id !== ZERO_UUID) {
                    result = await api.update(target, id, data);
                } else {
                    result = await api.create(target, data);
                }

                setEntityData(result);
                return result;
            } catch (err: any) {
                setError(err?.message ?? 'Failed to save entity data');
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [api, isAuthenticated]
    );

    return {
        entityData,
        loadEntityData,
        saveEntityData,
        isLoading,
        error,
    };
}