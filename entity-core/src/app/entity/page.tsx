'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useEntityApi, type EntityInfo } from '@/lib/apiEntity';
import { useAuth } from '@/contexts/AuthContext';

export default function EntityIndexPage() {
    const api = useEntityApi();

    const {
        isAuthenticated,
        login,
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
            if (authLoading) return;

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
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, disableAuth]);

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
            <section className="mx-auto max-w-5xl space-y-5">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Entities
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Define entities, manage schemas, and launch live CRUD screens.
                        </p>
                        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            Schema: {getEntitySchema() ?? 'unknown'}
                        </p>
                    </div>

                    <Link
                        href="/entity/new"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
                    >
                        Create New Entity
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                            <h2 className="text-base font-semibold">
                                Configured Entities
                            </h2>
                            <p className="text-sm text-slate-600">
                                Click an entity to edit its definition or manage its data.
                            </p>
                        </div>
                    </div>

                    {loading && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                            Loading entities...
                        </p>
                    )}

                    {error && (
                        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            Error: {error}
                        </p>
                    )}

                    {!loading && !error && entities.length === 0 && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                            No entities found.
                        </p>
                    )}

                    {!loading && !error && entities.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">
                                            Name
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {entities.map((ent) => (
                                        <tr
                                            key={ent.entity_name}
                                            className="transition hover:bg-slate-50"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-slate-900">
                                                    {ent.entity_name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <Link
                                                        href={`/entity/${ent.entity_name}`}
                                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                                                    >
                                                        Edit Definition
                                                    </Link>

                                                    <Link
                                                        href={`/crud/${ent.entity_name}`}
                                                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                                    >
                                                        Manage Data
                                                    </Link>
                                                </div>
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