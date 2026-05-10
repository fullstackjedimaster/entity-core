'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityApi, type OptionItem } from '@/lib/apiEntity';

export type { OptionItem };

export type UseOptionsParams = {
    entityName?: string;
    column?: string;
    filter?: string;
};

export function useOptions({
    entityName,
    column,
    filter,
}: UseOptionsParams) {
    const api = useEntityApi();

    const [options, setOptions] = useState<OptionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const loadOptions = useCallback(async () => {
        if (!entityName || !column) {
            setOptions([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const loaded = await api.getColumnOptions(
                entityName,
                column,
                filter
            );

            setOptions(loaded);
        } catch (err) {
            setOptions([]);
            setError(
                err instanceof Error
                    ? err
                    : new Error('Failed to load column options')
            );
        } finally {
            setIsLoading(false);
        }
    }, [api, entityName, column, filter]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!entityName || !column) {
                if (!cancelled) {
                    setOptions([]);
                    setIsLoading(false);
                    setError(null);
                }
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const loaded = await api.getColumnOptions(
                    entityName,
                    column,
                    filter
                );

                if (!cancelled) {
                    setOptions(loaded);
                }
            } catch (err) {
                if (!cancelled) {
                    setOptions([]);
                    setError(
                        err instanceof Error
                            ? err
                            : new Error('Failed to load column options')
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void run();

        return () => {
            cancelled = true;
        };
    }, [api, entityName, column, filter]);

    return {
        options,
        isLoading,
        error,
        refresh: loadOptions,
    };
}