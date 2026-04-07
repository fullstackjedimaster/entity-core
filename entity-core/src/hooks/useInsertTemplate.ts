// crud-client/src/hooks/useInsertTemplate.ts
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useInsertTemplate(entity: string) {
    const { data, error, isLoading } = useSWR(
        entity ? `/api/entities/${entity}/insert_template` : null,
        fetcher
    );
    return {
        template: data,
        isLoading,
        error,
    };
}
