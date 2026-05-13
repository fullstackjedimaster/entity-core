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
            if (authLoading || !entityName) return;

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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, disableAuth, entityName]);

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
            <section className="mx-auto max-w-5xl space-y-5">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="mb-2">
                            <Link
                                href="/entity"
                                className="text-sm font-medium text-blue-700 hover:underline"
                            >
                                ← Back to Entities
                            </Link>
                        </div>

                        <h1 className="text-3xl font-semibold tracking-tight">
                            {entityName} Data
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Create, edit, and inspect records for this entity.
                        </p>
                    </div>

                    <Link
                        href={`/crud/${entityName}/${ZERO_UUID}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
                    >
                        Create Record
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                            <h2 className="text-base font-semibold">
                                Records
                            </h2>
                            <p className="text-sm text-slate-600">
                                Select a record to view or edit its values.
                            </p>
                        </div>
                    </div>

                    {loading && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                            Loading records...
                        </p>
                    )}

                    {error && (
                        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            Error: {error}
                        </p>
                    )}

                    {!loading && !error && items.length === 0 && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                            No records found.
                        </p>
                    )}

                    {!loading && !error && items.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">
                                            Record ID
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {items.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="transition hover:bg-slate-50"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs text-slate-700">
                                                    {item.id}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/crud/${entityName}/${item.id}`}
                                                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                                >
                                                    View / Edit
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}