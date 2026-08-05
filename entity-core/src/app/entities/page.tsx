'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useEntityApi, type EntityInfo } from '@/lib/apiEntity';

export default function EntityIndexPage() {
    const api = useEntityApi();

    const {
        isAuthenticated,
        login,
        logout,
        loading: authLoading,
        disableAuth,
        getEntitySchema,
    } = useAuth();

    const [entities, setEntities] = useState<EntityInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (authLoading) {
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
                const data = await api.list();

                if (cancelled) return;

                setEntities(data.entities ?? []);
            } catch (err: any) {
                console.error(err);

                if (cancelled) return;

                setError(err?.message ?? 'Failed to load entities');
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

        // Do not include `api` unless useEntityApi() returns a memoized object.
        // Including it causes this page to reload forever.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, disableAuth]);

    return (
        <main className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Entities</h1>

                    <p className="text-sm text-gray-600">
                        Schema: {getEntitySchema() ?? 'unknown'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {!disableAuth && (
                        <button
                            type="button"
                            onClick={() => logout()}
                            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                        >
                            Logout
                        </button>
                    )}

                    <Link
                        href="/entities/new"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Create New Entity
                    </Link>
                </div>
            </div>

            {loading && <p>Loading...</p>}

            {error && <p className="text-red-600">Error: {error}</p>}

            {!loading && !error && entities.length === 0 && (
                <p className="text-gray-600">No entities found.</p>
            )}

            {!loading && !error && entities.length > 0 && (
                <ul className="border divide-y rounded">
                    {entities.map((ent) => (
                        <li
                            key={ent.entity_name}
                            className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <span className="font-medium">
                                {ent.entity_name}
                            </span>

                            <div className="flex flex-wrap gap-4 text-sm">
                                <Link
                                    href={`/entities/${ent.entity_name}`}
                                    className="text-blue-600 hover:underline"
                                >
                                    Edit definition
                                </Link>

                                <Link
                                    href={`/crud/${ent.entity_name}`}
                                    className="text-blue-600 hover:underline"
                                >
                                    Manage data
                                </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}