'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EntityInfo {
  entity_name: string;
}

export default function EntityIndexPage() {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { disableAuth, token, isAuthenticated, login } = useAuthInfo();

  useEffect(() => {
      async function fetchEntities() {
        try {
          setLoading(true);
          setError(null);

          if (!disableAuth && !isAuthenticated) {
            login();
            return;
          }

          const resp = await fetch('/api/entities', {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                }
              : undefined,
          });

          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Server ${resp.status}: ${text}`);
          }

          const data = await resp.json();
          setEntities(data);
        } catch (err: any) {
          console.error(err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }

      fetchEntities();
    }, [disableAuth, isAuthenticated, token]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Entities</h1>

      <div>
        <Link
          href="/entity/new"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create New Entity
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && entities.length === 0 && (
        <p className="text-gray-600">No entities found.</p>
      )}

      <ul className="border divide-y rounded">
        {entities.map((ent) => (
          <li key={ent.entity_name} className="p-4 flex justify-between">
            <span>{ent.entity_name}</span>
            <Link
              href={`/entity/${ent.entity_name}`}
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
