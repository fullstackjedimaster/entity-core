'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface EntityInfo {
  entity_name: string;
}

export default function EntityIndexPage() {
  const api = useApi();
  const { isAuthenticated, login, loading: authLoading, disableAuth } = useAuth();

  const [entities, setEntities] = useState<EntityInfo[]>([]);
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

        const data = await api.entities.list();
        setEntities(data);
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

      <Link
        href="/entity/new"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        + Create New Entity
      </Link>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && entities.length === 0 && (
        <p className="text-gray-600">No entities found.</p>
      )}

      <ul className="border divide-y rounded">
        {entities.map((ent) => (
          <li key={ent.entity} className="p-4 flex justify-between">
            <span>{ent.entity}</span>
            <Link
              href={`/entity/${ent.entity`}
              className="text-blue-600 hover:underline"
            >
              View / Edit →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}