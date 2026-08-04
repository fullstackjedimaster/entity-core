import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntityApi } from '@/lib/apiEntity';

export function useEntity() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const api = useEntityApi();

    const [entity, setEntity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadEntity = useCallback(
        async (entityName: string) => {
            if (authLoading || !isAuthenticated || !entityName) return null;

            setIsLoading(true);
            setError(null);

            try {
                const data = await api.get(entityName);
                setEntity(data);
                return data;
            } catch (err: any) {
                setError(err?.message ?? 'Failed to load entity');
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [api, authLoading, isAuthenticated]
    );

    const saveEntity = useCallback(
        async (entityName: string, entityJson: Record<string, unknown>) => {
            if (!isAuthenticated) throw new Error('Not authenticated');
            if (!entityName) throw new Error('Missing entity name');

            setIsLoading(true);
            setError(null);

            const optimistic = {
                entity_name: entityName,
                entity_json: entityJson,
            };

            setEntity(optimistic);

            try {
                const data = await api.save(entityName, entityJson);
                setEntity(data);
                return data;
            } catch (err: any) {
                setError(err?.message ?? 'Failed to save entity');
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [api, isAuthenticated]
    );

    return {
        entity,
        loadEntity,
        saveEntity,
        isLoading,
        error,
    };
}