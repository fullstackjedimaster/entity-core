'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    Building2,
    Database,
    Factory,
    Package,
    Plus,
    Pencil,
    Users,
    Shield,
} from 'lucide-react';

import { useEntityApi, type EntityInfo } from '@/lib/apiEntity';
import { useAuth } from '@/contexts/AuthContext';

function getEntityIcon(name: string) {
    const lower = name.toLowerCase();

    if (lower.includes('company')) return Building2;
    if (lower.includes('department')) return Users;
    if (lower.includes('employee')) return Users;
    if (lower.includes('product')) return Package;

    return Factory;
}

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
            if (authLoading) {
                return;
            }

            if (!disableAuth && !isAuthenticated) {
                setLoading(false);
                await login();
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const result = await api.list();

                if (!cancelled) {
                    setEntities(result.entities ?? []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(
                        err?.message ??
                            'Failed to load entities.'
                    );
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
    }, [
        api,
        authLoading,
        disableAuth,
        isAuthenticated,
        login,
    ]);

    const schema = getEntitySchema?.() ?? 'default';

    return (
        <main className="min-h-screen bg-black text-white px-5 py-8 md:px-10">
            <div className="max-w-5xl mx-auto">
                {/* HERO */}
                <section className="mb-10">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-5">
                        Entities
                    </h1>

                    <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-2xl mb-8">
                        Define entities, manage schemas, and launch
                        live CRUD screens.
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
                            href="/entities/new"
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
                            <Plus className="w-5 h-5" />
                            Create New Entity
                        </Link>
                    </div>
                </section>

                {/* SECTION HEADER */}
                <section className="mb-6 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-500/30">
                            <Database className="w-6 h-6 text-violet-400" />
                        </div>

                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold">
                                Configured Entities
                            </h2>

                            <p className="text-gray-400 mt-1">
                                Click an entity to edit its definition
                                or manage its data.
                            </p>
                        </div>
                    </div>
                </section>

                {/* STATES */}
                {loading && (
                    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-10 text-center text-gray-400">
                        Loading entities...
                    </div>
                )}

                {error && (
                    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
                        {error}
                    </div>
                )}

                {/* ENTITY CARDS */}
                {!loading && !error && (
                    <div className="space-y-6">
                        {entities.map((entity) => {
                            const Icon = getEntityIcon(
                                entity.entity_name
                            );

                            return (
                                <div
                                    key={entity.entity_name}
                                    className="
                                        group
                                        rounded-3xl
                                        border border-white/10
                                        bg-gradient-to-br
                                        from-zinc-950
                                        to-zinc-900
                                        p-6 md:p-7
                                        shadow-2xl
                                        transition-all duration-200
                                        hover:border-violet-500/40
                                        hover:shadow-[0_0_35px_rgba(139,92,246,0.15)]
                                    "
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                        {/* LEFT */}
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div
                                                className="
                                                    flex items-center justify-center
                                                    w-16 h-16
                                                    rounded-2xl
                                                    bg-violet-600/15
                                                    border border-violet-500/25
                                                    shrink-0
                                                "
                                            >
                                                <Icon className="w-8 h-8 text-violet-300" />
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="text-2xl font-bold text-white break-all">
                                                    {entity.entity_name}
                                                </h3>

                                                <p className="text-gray-400 mt-1">
                                                    Dynamic entity definition and CRUD management.
                                                </p>
                                            </div>
                                        </div>

                                        {/* ACTIONS */}
                                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                            <Link
                                                href={`/entities/${entity.entity_name}`}
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
                                                Edit Definition
                                            </Link>

                                            <Link
                                                href={`/${entity.entity_name}`}
                                                className="
                                                    inline-flex items-center justify-center gap-3
                                                    rounded-2xl
                                                    border border-white/10
                                                    bg-white/5
                                                    hover:bg-white/10
                                                    px-6 py-4
                                                    font-semibold
                                                    text-gray-100
                                                    transition-all
                                                    whitespace-nowrap
                                                "
                                            >
                                                <Database className="w-5 h-5" />
                                                Manage Data
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* FOOTER */}
                <footer className="mt-16 pt-10 border-t border-white/10">
                    <div className="flex flex-wrap items-center justify-center gap-4 text-gray-500 text-sm">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-violet-400" />
                            Secure
                        </div>

                        <span className="text-gray-700">•</span>

                        <div>Scalable</div>

                        <span className="text-gray-700">•</span>

                        <div>Built for developers</div>
                    </div>
                </footer>
            </div>
        </main>
    );
}