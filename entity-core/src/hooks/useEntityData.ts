import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useState } from "react";
import { settings } from "@/lib/settings";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export function useEntityData() {
    const { getToken, isAuthenticated, loading: authLoading } = useAuth();

    const [entityData, setEntityData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadEntityData = useCallback(
        async (id: string, target: string) => {
            if (authLoading || !isAuthenticated || !id || id === ZERO_UUID) {
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const token = await getToken();
                if (!token) throw new Error("Missing token");

                const requestEnvelope = {
                    operation: "read",
                    target,
                    id,
                    data: {},
                };

                const res = await fetch(`${settings.API_BASE_URL}/data`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestEnvelope),
                });

                if (!res.ok) {
                    throw new Error(await res.text());
                }

                const result = await res.json();
                setEntityData(result);

                return result;
            } catch (err: any) {
                setError(err?.message ?? "Failed to load entity data");
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [getToken, authLoading, isAuthenticated]
    );

    const saveEntityData = useCallback(
        async (id: string | null, target: string, data: any) => {
            if (!isAuthenticated) throw new Error("Not authenticated");

            setIsLoading(true);
            setError(null);

            try {
                const token = await getToken();
                if (!token) throw new Error("Missing token");

                let operation: "create" | "update" | "delete" = "create";

                if (!data) {
                    operation = "delete";
                } else if (id && id !== ZERO_UUID) {
                    operation = "update";
                }

                setEntityData({
                    entity_name: target,
                    entity_json: data,
                });

                const requestEnvelope = {
                    operation,
                    target,
                    id: id && id !== ZERO_UUID ? id : null,
                    data,
                };

                const res = await fetch(`${settings.API_BASE_URL}/data`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestEnvelope),
                });

                if (!res.ok) {
                    throw new Error(await res.text());
                }

                const result = await res.json();
                setEntityData(result);

                return result;
            } catch (err: any) {
                setError(err?.message ?? "Failed to save entity data");
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [getToken, isAuthenticated]
    );

    return {
        entityData,
        loadEntityData,
        saveEntityData,
        isLoading,
        error,
    };
}