'use client';

import { useAuthedFetch } from '@/hooks/useAuthedFetch';

export function useApi() {
    const authedFetch = useAuthedFetch();

      // small helper
    const handle = async (resp: Response) => {
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`API ${resp.status}: ${text}`);
      }

      return resp.json();
    };

      return {
        items: {
          list: async (entityName: string) => {
            const resp = await authedFetch(`/api/${entityName}`);
            return handle(resp);
          },

          get: async (id:string, entityName: string) => {
            const resp = await authedFetch(`/api/entities/${entityName}/${id}`);
            return handle(resp);
          },

          create: async (entityName:string, payload: any) => {
            const resp = await authedFetch(`/api/entities/${entityName}`, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            return handle(resp);
          },

          update: async (entityName: string, id:string, payload: any) => {
            const resp = await authedFetch(`/api/entities/${entityName}/${id}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            });
            return handle(resp);
          },

          delete: async (entityName: string) => {
            const resp = await authedFetch(`/api/entities/${entityName}`, {
              method: 'DELETE',
            });
            return handle(resp);
      },
    },
  };
}