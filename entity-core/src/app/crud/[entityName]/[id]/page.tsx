'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import EntityComponent from '@/components/EntityComponent';
import { apiFetchRaw } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const dynamic = 'force-dynamic';

interface ManageResultPayload {
    result?: unknown;
}

interface ManageResponse {
    ok: boolean;
    result?: ManageResultPayload;
    message?: string;
}

function EntityPageContent() {
    const searchParams = useSearchParams();

    const entity = searchParams.get('entity') ?? '';
    const id = searchParams.get('id') ?? '';

    const {
        isAuthenticated,
        loading: authLoading,
        login,
        getToken,
        disableAuth,
    } = useAuth();

    const [initialValues, setInitialValues] =
        useState<Record<string, unknown> | null>(null);

    const [loadingRow, setLoadingRow] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);

    // ---------------------------------------------------------------------
    // Require login
    // ---------------------------------------------------------------------

    useEffect(() => {
        if (authLoading) return;

        if (!disableAuth && !isAuthenticated) {
            login();
        }
    }, [authLoading, disableAuth, isAuthenticated, login]);

    // ---------------------------------------------------------------------
    // Load existing entity row
    // ---------------------------------------------------------------------

    useEffect(() => {
        if (!entity || !id) return;

        if (authLoading) return;

        if (!disableAuth && !isAuthenticated) return;

        let cancelled = false;

        async function loadEntityRow() {
            setLoadingRow(true);
            setRowError(null);

            try {
                // ---------------------------------------------------------
                // Get Auth0 access token
                // ---------------------------------------------------------

                const token = disableAuth
                    ? null
                    : await getToken();

                if (!disableAuth && !token) {
                    throw new Error('Failed to obtain access token');
                }

                // ---------------------------------------------------------
                // Load entity row
                // ---------------------------------------------------------

                const resp = await apiFetchRaw(
                    '/manage',
                    token ?? '',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            operation: 'read',
                            target: entity,
                            id,
                            args: {},
                            meta: {
                                source: 'entity/page',
                            },
                        }),
                    },
                );

                if (!resp.ok) {
                    const text = await resp.text();

                    throw new Error(
                        `manage read failed: ${resp.status} ${resp.statusText}${
                            text ? ` - ${text}` : ''
                        }`,
                    );
                }

                const json = (await resp.json()) as ManageResponse;

                if (!json.ok) {
                    throw new Error(
                        json.message || 'manage returned !ok',
                    );
                }

                const inner = json.result ?? {};

                const row = (inner.result ??
                    null) as Record<string, unknown> | null;

                if (!cancelled) {
                    setInitialValues(row);
                }
            } catch (err: unknown) {
                console.error(
                    '[entity/page] Failed to load row:',
                    err,
                );

                if (!cancelled) {
                    setRowError(
                        err instanceof Error
                            ? err.message
                            : 'Unknown error loading entity',
                    );

                    setInitialValues(null);
                }
            } finally {
                if (!cancelled) {
                    setLoadingRow(false);
                }
            }
        }

        loadEntityRow();

        return () => {
            cancelled = true;
        };
    }, [
        entity,
        id,
        authLoading,
        disableAuth,
        isAuthenticated,
        getToken,
    ]);

    // ---------------------------------------------------------------------
    // UI states
    // ---------------------------------------------------------------------

    if (authLoading) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <p className="text-gray-600">
                    Initializing authentication...
                </p>
            </main>
        );
    }

    if (!disableAuth && !isAuthenticated) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <p className="text-gray-600">
                    Redirecting to login...
                </p>
            </main>
        );
    }

    if (!entity) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <h1 className="text-xl font-semibold mb-2">
                    Entity form
                </h1>

                <p className="text-gray-600">
                    Missing <code>entity</code> query parameter.
                </p>
            </main>
        );
    }

    if (id && loadingRow) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <h1 className="text-xl font-semibold mb-2">
                    Edit {entity}
                </h1>

                <p className="text-gray-600">
                    Loading existing record...
                </p>
            </main>
        );
    }

    if (id && rowError) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <h1 className="text-xl font-semibold mb-2">
                    Edit {entity}
                </h1>

                <p className="text-red-600 mb-2">
                    Could not load existing record: {rowError}
                </p>
            </main>
        );
    }

    // ---------------------------------------------------------------------
    // Render entity form
    // ---------------------------------------------------------------------

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <EntityComponent
                entityName={entity}
                initialValues={initialValues ?? undefined}
            />
        </main>
    );
}

export default function EntityPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-3xl mx-auto">
                    <p className="text-gray-600">Loading...</p>
                </main>
            }
        >
            <EntityPageContent />
        </Suspense>
    );
}
