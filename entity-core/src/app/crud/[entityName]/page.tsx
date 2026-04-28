'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useApiFetch } from "@/hooks/useApiFetch";


type RecordRow = { id?: string; [k: string]: any };

function pickLabel(r: RecordRow): string {
    return (
        r.full_name ??
        r.name ??
        r.title ??
        r.email ??
        r.code ??
        r.id ??
        'Untitled'
    );
}

export default function EntityIndex() {
    const rawParams = useParams();
    const entity = useMemo(() => {
        const val = rawParams?.['entityName'];
        return typeof val === 'string' ? val : '';
    }, [rawParams]);

    const { isAuthenticated, login, getToken } = useAuth();

    const [rows, setRows] = useState<RecordRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const { apiFetch } = useApiFetch();


    useEffect(() => {
        if (!entity || !isAuthenticated) return; // ✅ stop early if not ready

        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await apiFetch("/api/data", {
                    method: "POST",
                    body: JSON.stringify({
                        operation: "select",
                        name: entity,
                        id: null,
                        data: {},
                    }),
                });

                const { ok, result } = await res.json();
                setRows(Array.isArray(result) ? result : []);
            } catch (e: any) {
                console.error(e);
                setErr(e?.message || "Failed to load");
            } finally {
                setLoading(false);
            }
        })();
    }, [entity, isAuthenticated]);

    if (!entity) return <p style={{ padding: 16 }}>Missing entity name in route.</p>;
    if (loading) return <p style={{ padding: 16 }}>Loading {entity}…</p>;
    if (err)
        return (
            <p style={{ padding: 16, color: 'crimson' }}>
                ⚠️ Error loading {entity}: {err}
            </p>
        );

    return (
        <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    justifyContent: 'space-between',
                }}
            >
                <div>
                    <h1 style={{ margin: 0, textTransform: 'capitalize' }}>{entity}</h1>
                    <p style={{ margin: 0, opacity: 0.6 }}>
                        {rows.length} {rows.length === 1 ? 'record' : 'records'} found
                    </p>
                </div>
                <Link href={`/${entity}/00000000-0000-0000-0000-000000000000`}>
          <span
              style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: '#0070f3',
                  color: 'white',
                  textDecoration: 'none',
              }}
          >
            + Add New
          </span>
                </Link>
            </header>

            {rows.length === 0 ? (
                <p style={{ opacity: 0.6 }}>No {entity} found.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #eee' }}>
                    {rows.map((r, i) => {
                        const id = r.id ?? r.uuid ?? r._id ?? String(i);
                        return (
                            <li
                                key={id}
                                style={{
                                    padding: '10px 0',
                                    borderBottom: '1px solid #eee',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Link href={`/${entity}/${id}`}>
                  <span style={{ color: '#0070f3', fontWeight: 500 }}>
                    {pickLabel(r)}
                  </span>
                                </Link>
                                <code style={{ opacity: 0.5, fontSize: '0.8em', userSelect: 'all' }}>{id}</code>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
