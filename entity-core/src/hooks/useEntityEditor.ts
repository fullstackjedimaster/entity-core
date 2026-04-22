import { useAuth } from "@/contexts/AuthContext";
import { useState , useCallback} from "react";
import { settings } from '@/lib/settings';

export function useEntityEditor(entityName: string) {
    const { getToken, isAuthenticated, loading: authLoading } = useAuth();
    const [entity, setEntity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadEntity = useCallback(async () => {
        if (!entity || authLoading || !isAuthenticated) return;

        setIsLoading(true);
        setError(null);

        try {
            const token = await getToken();
            if (!token) throw new Error("Missing token");

            if (entityName != 'new'){

                const res = await fetch(
                    `${settings.API_BASE_URL}/api/entities/${entityName}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!res.ok) throw new Error(await res.text());

                const data = await res.json();
                setEntity(data);
            }
                
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [entity, getToken, authLoading, isAuthenticated]);

    const saveEntity = useCallback(
    async (entityJson: any) => {
        const token = await getToken();
        if (!token) throw new Error("Missing token");

        // 👇 optimistic update FIRST
        const optimistic = {
            entity: entityName,
            entity_json: entityJson,
        };
        setEntity(optimistic);

        try {
            const res = await fetch(
                `${settings.API_BASE_URL}/api/entities`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(optimistic),
                }
            );

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();

            // 👇 reconcile with server response
            setEntity(data);

            return data;

        } catch (err) {
            // 👇 rollback if needed
            console.error("Save failed, rolling back");
            setError("Save failed");
            throw err;
        }
    },
    [entityName, getToken]
);

    return { entity, loadEntity, saveEntity, isLoading, error };
}