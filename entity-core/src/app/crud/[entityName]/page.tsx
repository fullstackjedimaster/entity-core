'use client';

import Link from 'next/link';
import { useApi } from '@/lib/apiCrud';



interface EntityDataItemInfo {
    id:string;
}

import { useParams } from "next/navigation";
import { Suspense, useState, useEffect} from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function EntityDataItemIndexPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-md mx-auto">
                    <p className="text-gray-700">Loading entity…</p>
                </main>
            }
        >
            <EntityDataItemIndexInner />
        </Suspense>
    );
}

function EntityDataItemIndexInner() {

    const params = useParams();
    const entityParam = params?.entityName as string;

  const api = useApi();
  const { isAuthenticated, login, loading: authLoading, disableAuth } = useAuth();

  const [entityDataItems, setEntityDataItems] = useState<EntityDataItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // ⛔ wait for auth system to initialize
        if (authLoading) return;

        // 🔐 trigger login if needed
        if (!disableAuth && !isAuthenticated) {
          await login();
          return;
        }

        setLoading(true);
        setError(null);

      const data = await api.entityDataItems.list(entityParam);
      setEntityDataItems(data.entityDataItems ?? []);
      } catch (err: any) {
          console.error(err);
          setError(err.message);
      } finally {
          setLoading(false);
      }
    }

    load();
  }, [authLoading, isAuthenticated, disableAuth]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Entities</h1>



      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && entityDataItems.length === 0 && (
        <p className="text-gray-600">No entities found.</p>
      )}

      <ul className="border divide-y rounded">
        {entityDataItems.map((entityDataItem) => (
          <li key={entityDataItem.id} className="p-4 flex justify-between">
            <span>{entityDataItem.id}</span>
            <Link
              href={`/${entityDataItem.id}`}
              className="text-blue-600 hover:underline"
            >
              View / Edit →
            </Link>
               <Link
              href={`/${entityParam}/{00000000-0000-0000-0000-000000000000}`}
              className="text-blue-600 hover:underline"
            >
              Create →
            </Link>
          </li>
        ))}
      </ul>

    </div>
  );
}