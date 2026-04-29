import { useAuth } from "@/contexts/AuthContext";
import {useCallback, useState} from "react";
import {settings} from "@/lib/settings";

export function useEntity() {
    const { getToken, isAuthenticated,  loading: authLoading } = useAuth();

    const [entity, setEntity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const loadEntity = useCallback(async (entityName:string) => {
        if (authLoading || !isAuthenticated) return;

        setIsLoading(true);
        setError(null);

        try {

            const token = await getToken();
            if (!token) throw new Error("Missing token");

            const res = await fetch(
                `${settings.API_BASE_URL}/entities/${entityName}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            setEntity(data);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [ getToken, authLoading, isAuthenticated]);

    const saveEntity = useCallback(async (entityName:string, entityJson: any) => {
        if (!isAuthenticated) throw new Error("Not authenticated");

        const token = await getToken();
        if (!token) throw new Error("Missing token");

        const optimistic = {
            entity_name: entityName,
            entity_json: entityJson,
        };

        setEntity(optimistic);

        try {
            const res = await fetch(
                `${settings.API_BASE_URL}/entities/${entityName}`,
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
            setEntity(data);

            return data;

        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, [ getToken, isAuthenticated]);

    return { entity, loadEntity, saveEntity, isLoading, error };
}