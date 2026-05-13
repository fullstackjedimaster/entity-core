'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    Database,
    FilePlus2,
    Pencil,
    Rows3,
    Shield,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useCrudApi, ZERO_UUID, type EntityDataItemInfo } from '@/lib/apiCrud';

export default function EntityDataItemIndexPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-black text-white px-5 py-8">
                    <div className="max-w-5xl mx-auto">
                        <p className="text-gray-400">Loading entity data...</p>
                    </div>
                </main>
            }
        >
            <EntityDataItemIndexInner />
        </Suspense>
    );
}

function EntityDataItemIndexInner() {
    const params = useParams();
    const entityName = String(params?.entityName ?? '');

    const api = useCrudApi();
    const { isAuthenticated, login, loading: authLoading, disableAuth, getEntitySchema } = useAuth();

    const [items, setItems] = useState<EntityDataItemInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const schema = getEntitySchema?.() ?? 'default';

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (authLoading || !entityName) return;

            if (!disableAuth && !isAuthenticated) {
                setLoading(false);
                await login();
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const result = await api.list(entityName);

                if (!cancelled) {
                    setItems(result.items ?? []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message ?? `Failed to load ${entityName} records.`);
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
    }, [api, authLoading, disableAuth, entityName, isAuthenticated, login]);

    const title = useMemo(() => {
        if (!entityName) return 'Entity Data';
        return entityName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }, [entityName]);

    return (
        <main className="min-h-screen bg-black text-white px-5 py-8 md:px-10">
            <div className="max-w-5xl mx-auto">
                <section className="mb-10">
                    <Link
                        href="/entities"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-violet-300 transition-colors mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Entities
                    </Link>

                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-5">
                        {title}
                    </h1>

                    <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-2xl mb-8">
                        View, create, and edit live records for this entity.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                        <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-5 py-4 shadow-lg backdrop-blur">
                            <Database className="w-5 h-5 text-violet-400" />

                            <div>
                                <div className="text-xs uppercase tracking-widest text-gray-400">
                                    Active Schema
                                </div>

                                <div className="text-lg font-semibold text-white">
                                    {schema}
                                </div>
                            </div>
                        </div>

                        <Link
                            href={`/crud/${entityName}/${ZERO_UUID}`}
                            className="
                                inline-flex items-center gap-3
                                rounded-2xl
                                bg-gradient-to-r from-violet-600 to-fuchsia-600
                                hover:from-violet-500 hover:to-fuchsia-500
                                px-6 py-4
                                text-lg font-semibold
                                shadow-[0_0_30px_rgba(139,92,246,0.35)]
                                transition-all duration-200
                                hover:scale-[1.02]
                            "
                        >
                            <FilePlus2 className="w-5 h-5" />
                            Create New Record
                        </Link>
                    </div>
                </section>

                <section className="mb-6 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-500/30">
                            <Rows3 className="w-6 h-6 text-violet-400" />
                        </div>

                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold">
                                Records
                            </h2>

                            <p className="text-gray-400 mt-1">
                                Select a record to edit its data.
                            </p>
                        </div>
                    </div>
                </section>

                {loading && (
                    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-10 text-center text-gray-400">
                        Loading records...
                    </div>
                )}

                {error && (
                    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
                        {error}
                    </div>
                )}

                {!loading && !error && items.length === 0 && (
                    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 to-zinc-900 p-10 text-center shadow-2xl">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-600/15">
                            <Rows3 className="w-8 h-8 text-violet-300" />
                        </div>

                        <h3 className="text-2xl font-bold mb-2">
                            No records yet
                        </h3>

                        <p className="text-gray-400 mb-6">
                            Create the first live data record for this entity.
                        </p>

                        <Link
                            href={`/crud/${entityName}/${ZERO_UUID}`}
                            className="
                                inline-flex items-center justify-center gap-3
                                rounded-2xl
                                bg-gradient-to-r from-violet-600 to-fuchsia-600
                                hover:from-violet-500 hover:to-fuchsia-500
                                px-6 py-4
                                font-semibold
                                shadow-[0_0_30px_rgba(139,92,246,0.25)]
                                transition-all
                            "
                        >
                            <FilePlus2 className="w-5 h-5" />
                            Create New Record
                        </Link>
                    </div>
                )}

                {!loading && !error && items.length > 0 && (
                    <div className="space-y-6">
                        {items.map((item, index) => {
                            const id = String(item.id ?? item.uuid ?? '');

                            return (
                                <div
                                    key={id || index}
                                    className="
                                        group
                                        rounded-3xl
                                        border border-white/10
                                        bg-gradient-to-br from-zinc-950 to-zinc-900
                                        p-6 md:p-7
                                        shadow-2xl
                                        transition-all duration-200
                                        hover:border-violet-500/40
                                        hover:shadow-[0_0_35px_rgba(139,92,246,0.15)]
                                    "
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/15 border border-violet-500/25 shrink-0">
                                                <Database className="w-8 h-8 text-violet-300" />
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="text-2xl font-bold text-white break-all">
                                                    Record {index + 1}
                                                </h3>

                                                <p className="text-gray-400 mt-1 break-all">
                                                    {id || 'Unsaved record'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                            <Link
                                                href={`/crud/${entityName}/${id}`}
                                                className="
                                                    inline-flex items-center justify-center gap-3
                                                    rounded-2xl
                                                    border border-violet-500/40
                                                    bg-violet-500/10
                                                    hover:bg-violet-500/20
                                                    px-6 py-4
                                                    font-semibold
                                                    text-violet-200
                                                    transition-all
                                                    whitespace-nowrap
                                                "
                                            >
                                                <Pencil className="w-5 h-5" />
                                                Edit Record
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <footer className="mt-16 pt-10 border-t border-white/10">
                    <div className="flex flex-wrap items-center justify-center gap-4 text-gray-500 text-sm">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-violet-400" />
                            Live CRUD
                        </div>

                        <span className="text-gray-700">•</span>

                        <div>Schema-driven</div>

                        <span className="text-gray-700">•</span>

                        <div>EntityCore</div>
                    </div>
                </footer>
            </div>
        </main>
    );
}