'use client';

import useSWR from 'swr';
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

    const canFetch =
        !!entityName &&
        !authLoading &&
        (disableAuth || isAuthenticated);

    const key = canFetch ? ['form-metadata', entityName] : null;

    const {
        data,
        error,
        isLoading,
        mutate,
    } = useSWR<FormMetadataResponse>(
        key,
        async () =>
            api.getFormMetadata(entityName) as Promise<FormMetadataResponse>,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const formMetadata = data ? normalizeFormMetadata(data) : null;

    return {
        formMetadata,
        metadata: formMetadata,
        isLoading: authLoading || isLoading,
        loading: authLoading || isLoading,
        error,
        mutate,
    };
}