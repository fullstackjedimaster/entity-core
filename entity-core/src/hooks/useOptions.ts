'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityApi, type OptionItem } from '@/lib/apiEntity';

export type { OptionItem };

export type UseOptionsParams = {
    entityName?: string;
    column?: string;
    parentField?: string;
    parentValue?: string | number | null;
    filter?: string;
    mode?: 'auto' | 'foreign_key' | 'column';
};

export function useOptions({
    entityName,
    column,
    parentField,
    parentValue,
    filter,
    mode = 'auto',
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
            const loaded = await api.getOptions(entityName, column, {
                parentField,
                parentValue,
                filter,
                mode,
            });

            setOptions(loaded);
        } catch (err) {
            const normalized =
                err instanceof Error
                    ? err
                    : new Error('Failed to load options');

            setError(normalized);
            setOptions([]);
        } finally {
            setIsLoading(false);
        }
    }, [api, entityName, column, parentField, parentValue, filter, mode]);

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
                const loaded = await api.getOptions(entityName, column, {
                    parentField,
                    parentValue,
                    filter,
                    mode,
                });

                if (!cancelled) {
                    setOptions(loaded);
                }
            } catch (err) {
                if (!cancelled) {
                    const normalized =
                        err instanceof Error
                            ? err
                            : new Error('Failed to load options');

                    setError(normalized);
                    setOptions([]);
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
    }, [api, entityName, column, parentField, parentValue, filter, mode]);

    return {
        options,
        isLoading,
        error,
        refresh: loadOptions,
    };
}