'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEntityApi } from '@/lib/apiEntity';
import { useAuth } from '@/contexts/AuthContext';

export type FieldMeta = {
    name: string;
    label: string;
    type: string;
    required: boolean;
    widget?: string;
};

export type FormMetadata = {
    entityName: string;
    schema: string;
    table: string;
    primaryKey: string;
    fields: FieldMeta[];
};

type FormMetadataResponse =
    | FormMetadata
    | {
          formMetadata?: FormMetadata;
          metadata?: FormMetadata;
          result?:
              | FormMetadata
              | {
                    formMetadata?: FormMetadata;
                    metadata?: FormMetadata;
                };
      };

function normalizeFormMetadata(payload: FormMetadataResponse): FormMetadata {
    const data = payload as any;

    return (
        data?.formMetadata ??
        data?.metadata ??
        data?.result?.formMetadata ??
        data?.result?.metadata ??
        data?.result ??
        data
    );
}

export function useFormMetadata(entityName: string) {
    const { isAuthenticated, loading: authLoading, disableAuth } = useAuth();
    const api = useEntityApi();

    const [formMetadata, setFormMetadata] = useState<FormMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const canFetch =
        !!entityName &&
        !authLoading &&
        (disableAuth || isAuthenticated);

    const loadFormMetadata = useCallback(async () => {
        if (!canFetch) {
            setFormMetadata(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const payload =
                (await api.getFormMetadata(entityName)) as FormMetadataResponse;

            setFormMetadata(normalizeFormMetadata(payload));
        } catch (err) {
            setFormMetadata(null);
            setError(
                err instanceof Error
                    ? err
                    : new Error('Failed to load form metadata')
            );
        } finally {
            setIsLoading(false);
        }
    }, [api, canFetch, entityName]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!canFetch) {
                if (!cancelled) {
                    setFormMetadata(null);
                    setIsLoading(false);
                    setError(null);
                }
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const payload =
                    (await api.getFormMetadata(entityName)) as FormMetadataResponse;

                if (!cancelled) {
                    setFormMetadata(normalizeFormMetadata(payload));
                }
            } catch (err) {
                if (!cancelled) {
                    setFormMetadata(null);
                    setError(
                        err instanceof Error
                            ? err
                            : new Error('Failed to load form metadata')
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
    }, [api, canFetch, entityName]);

    return {
        formMetadata,
        metadata: formMetadata,
        isLoading: authLoading || isLoading,
        loading: authLoading || isLoading,
        error,
        mutate: loadFormMetadata,
        refresh: loadFormMetadata,
    };
}