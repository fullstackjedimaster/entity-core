'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCrudApi, ZERO_UUID, type EntityDataItemInfo } from '@/lib/apiCrud';

export default function EntityDataItemIndexPage() {
    return (
        <Suspense fallback={<main className="p-6">Loading entity data...</main>}>
            <EntityDataItemIndexInner />
        </Suspense>
    );
}

function EntityDataItemIndexInner() {
    const params = useParams();
    const entityName = String(params?.entityName ?? '');

    const api = useCrudApi();
    const { isAuthenticated, login, loading: authLoading, disableAuth } = useAuth();

    const [items, setItems] = useState<EntityDataItemInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (authLoading || !entityName) {
                return;
            }

            if (!disableAuth && !isAuthenticated) {
                setLoading(false);
                await login();
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const data = await api.list(entityName);

                if (!cancelled) {
                    setItems(data.items ?? []);
                }
            } catch (err: any) {
                console.error(err);

                if (!cancelled) {
                    setError(err?.message ?? 'Failed to load entity data');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };

        // Do NOT include `api` unless useCrudApi() is memoized.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, disableAuth, entityName]);

    return (
        <main className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {entityName} Data
                    </h1>
                    <p className="text-sm text-gray-600">
                        Create, edit, and inspect records for this entity.
                    </p>
                </div>

                <Link
                    href={`/crud/${entityName}/${ZERO_UUID}`}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Create Record
                </Link>
            </div>

            {loading && <p>Loading...</p>}

            {error && <p className="text-red-600">Error: {error}</p>}

            {!loading && !error && items.length === 0 && (
                <p className="text-gray-600">No records found.</p>
            )}

            {!loading && !error && items.length > 0 && (
                <ul className="border divide-y rounded">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="p-4 flex items-center justify-between gap-4"
                        >
                            <span className="font-mono text-sm">{item.id}</span>

                            <Link
                                href={`/crud/${entityName}/${item.id}`}
                                className="text-blue-600 hover:underline"
                            >
                                View / Edit
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}