'use client';

import Link from 'next/link';
import {
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';

import EntityComponent from '@/components/EntityComponent';
import { useAuth } from '@/contexts/AuthContext';
import { useEntityData } from '@/hooks/useEntityData';
import { ZERO_UUID } from '@/lib/apiCrud';

function normalizeDateValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    // Converts "2026-05-06T19:20:00.655174+00:00" to "2026-05-06".
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return value.slice(0, 10);
    }

    return value;
}

function normalizeInitialValues(
    raw: Record<string, unknown>
): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
        if (Array.isArray(value)) {
            normalized[key] = value.map((item) =>
                item &&
                typeof item === 'object' &&
                !Array.isArray(item)
                    ? normalizeInitialValues(
                          item as Record<string, unknown>
                      )
                    : normalizeDateValue(item)
            );
        } else if (
            value &&
            typeof value === 'object'
        ) {
            normalized[key] = normalizeInitialValues(
                value as Record<string, unknown>
            );
        } else {
            normalized[key] = normalizeDateValue(value);
        }
    }

    return normalized;
}

export default function EntityDataItemDetailPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-3xl mx-auto">
                    <p className="text-gray-600">
                        Loading record...
                    </p>
                </main>
            }
        >
            <EntityDataItemDetailInner />
        </Suspense>
    );
}

function EntityDataItemDetailInner() {
    const router = useRouter();
    const params = useParams();

    const entityName = String(params?.entityName ?? '');
    const id = String(params?.id ?? ZERO_UUID);
    const isNew = id === ZERO_UUID;

    const {
        isAuthenticated,
        loading: authLoading,
        login,
        disableAuth,
    } = useAuth();

    const {
        entityData,
        loadEntityData,
        saveEntityData,
        isLoading,
        error,
    } = useEntityData();

    const [initialValues, setInitialValues] =
        useState<Record<string, unknown> | undefined>(undefined);

    const loadedKeyRef = useRef<string | null>(null);
    const loginStartedRef = useRef(false);

    useEffect(() => {
        if (authLoading) return;

        if (!disableAuth && !isAuthenticated) {
            if (!loginStartedRef.current) {
                loginStartedRef.current = true;
                login();
            }

            return;
        }

        if (!entityName || isNew) {
            setInitialValues(undefined);
            loadedKeyRef.current = null;
            return;
        }

        const loadKey = `${entityName}:${id}`;

        if (loadedKeyRef.current === loadKey) {
            return;
        }

        loadedKeyRef.current = loadKey;
        loadEntityData(id, entityName);
    }, [
        authLoading,
        disableAuth,
        isAuthenticated,
        entityName,
        id,
        isNew,
        login,
        loadEntityData,
    ]);

    useEffect(() => {
        if (!entityData || isNew) return;

        const raw =
            entityData?.items ??
            entityData?.entity ??
            entityData?.result ??
            entityData;

        if (
            raw &&
            typeof raw === 'object' &&
            !Array.isArray(raw)
        ) {
            setInitialValues(
                normalizeInitialValues(
                    raw as Record<string, unknown>
                )
            );
        }
    }, [entityData, isNew]);

    const title = useMemo(() => {
        return isNew
            ? `Create ${entityName} Record`
            : `Edit ${entityName} Record`;
    }, [entityName, isNew]);

    if (authLoading) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <p className="text-gray-600">
                    Checking authentication...
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

    if (!entityName) {
        return (
            <main className="p-6 max-w-3xl mx-auto">
                <p className="text-red-600">
                    Missing entity name.
                </p>
            </main>
        );
    }

    return (
        <main className="p-6 max-w-3xl mx-auto space-y-4">
            <Link
                href={`/crud/${entityName}`}
                className="inline-flex items-center text-sm text-blue-600 hover:underline"
            >
                ← Back to Records
            </Link>

            <div>
                <h1 className="text-2xl font-semibold">
                    {title}
                </h1>

                <p className="text-sm text-gray-600">
                    {isNew
                        ? 'New record'
                        : `Record ID: ${id}`}
                </p>
            </div>

            {isLoading && !isNew && (
                <p className="text-gray-600">
                    Loading existing record...
                </p>
            )}

            {error && (
                <p className="text-red-600">
                    Error: {error}
                </p>
            )}

            {(!isLoading || isNew) && (
                <EntityComponent
                    entityName={entityName}
                    id={id}
                    initialValues={initialValues}
                    onSavedAction={async (
                        savedValues: Record<string, unknown>
                    ) => {
                        await saveEntityData(
                            isNew ? null : id,
                            entityName,
                            savedValues
                        );

                        router.push(`/crud/${entityName}`);
                    }}
                    onCancelAction={() =>
                        router.push(`/crud/${entityName}`)
                    }
                />
            )}
        </main>
    );
}