import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { settings } from "@/lib/settings";

/**
 * useTemplateEditor
 * Manages loading/saving entity templates without polling or auto-fetching.
 * The caller decides when to trigger loadTemplate().
 */
export function useEntityEditor(entityName: string) {
    const { getToken, isAuthenticated, loading: authLoading } = useAuth();
    const [entity, setEntity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Explicitly load template (only called by user action)
    const loadEntity = useCallback(async () => {
        if (!entityName) return;
        if (authLoading) return;
        if (!isAuthenticated) {
            console.warn("⚠️ Auth not ready or user not logged in.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error("⚠️ Missing token (Auth0 not ready)");

            const res = await fetch(`${settings.ENTITY_CORE_API_BASE_URL}/api/entities/${entity}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
            const data = await res.json();
            setEntity(data);
        } catch (err: any) {
            console.error("⚠️ Error loading entity:", err);
            setError(err.message || "Unknown error loading entity");
        } finally {
            setIsLoading(false);
        }
    }, [entityName, getToken, authLoading, isAuthenticated]);

    // Save current template back to server
    const saveEntity = useCallback(
        async (newEntity: any) => {
            if (!entityName) throw new Error("No entity provided");
            const token = await getToken();
            if (!token) throw new Error("⚠️ Missing token (Auth0 not ready)");

            const res = await fetch(`${settings.ENTITY_CORE_API_BASE_URL}/api/entities`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newEntity),
            });

            if (!res.ok) throw new Error(`Save failed: ${res.status} ${await res.text()}`);
            const data = await res.json();
            setEntity(data);
            return data;
        },
        [entityName, getToken]
    );

    // ✅ No automatic loading here — only manual
    return { entity, loadTemplate, saveTemplate, isLoading, error };
}
