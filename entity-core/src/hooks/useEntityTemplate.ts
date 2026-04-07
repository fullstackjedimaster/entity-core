'use client';
import { useEffect, useState } from 'react';

export interface EntityTemplateState {
    template: any | null;
    loading: boolean;
    error: string | null;
}

export function useEntityTemplate(entityName?: string | null): EntityTemplateState {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(!!entityName);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!entityName) return;

        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const resp = await fetch(`/api/template/${entityName}`);
                if (resp.status === 404) {
                    // no template yet
                    if (!cancelled) {
                        setTemplate(null);
                        setError(null);
                    }
                    return;
                }
                if (!resp.ok) throw new Error(`Template error: ${resp.status}`);

                const data = await resp.json();
                if (!cancelled) setTemplate(data.template);

            } catch (e: any) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true };
    }, [entityName]);

    return { template, loading, error };
}
