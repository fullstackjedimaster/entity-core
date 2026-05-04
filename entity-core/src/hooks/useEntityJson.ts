"use client";

import { useEffect, useState } from "react";
import { useApiFetch } from "@/hooks/useApiFetch";

export interface EntityJsonState {
    entityName: any | null;
    loading: boolean;
    error: string | null;
}

/**
 * useEntityJson(entityName)
 *  - fetches JSON for a given entity from /api/entity/{entityName}
 *  - entity is expected to be an object keyed by entity name
 */
export function useEntityJson(entityName?: string | null): EntityJsonState {
    const { apiFetch } = useApiFetch();
    const [entity, setEntity] = useState<any | null>(null);
    const [loading, setLoading] = useState<boolean>(!!entityName);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!entityName) return;

        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const res = await apiFetch(`/api/entity/${entityName}`);
                if (!res.ok) {
                    throw new Error(`Failed to load entity: ${res.status} ${res.statusText}`);
                }
                const data = await res.json();
                if (!cancelled) {
                    setEntity(data);
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Unknown error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [entityName, apiFetch]);

    return { entityJson, loading, error };
}
