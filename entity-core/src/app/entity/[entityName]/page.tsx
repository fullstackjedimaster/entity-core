'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EntityTemplateBuilder from '@/components/EntityTemplateBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { useEntity } from '@/hooks/useEntity';

export default function EntityDetailPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-md mx-auto">
                    <p className="text-gray-700">Loading entity...</p>
                </main>
            }
        >
            <EntityInner />
        </Suspense>
    );
}

function EntityInner() {
    const router = useRouter();
    const params = useParams();

    const entityNameParam = String(params?.entityName ?? '');
    const isNew = entityNameParam === 'new';

    const [entityName, setEntityName] = useState(isNew ? '' : entityNameParam);
    const [jsonStr, setJsonStr] = useState('{}');

    const { isAuthenticated, loading: authLoading, login, disableAuth } = useAuth();
    const { entity, loadEntity, saveEntity, isLoading, error } = useEntity();

    useEffect(() => {
        if (authLoading) return;

        if (!disableAuth && !isAuthenticated) {
            login();
            return;
        }

        if (!isNew && entityNameParam) {
            loadEntity(entityNameParam);
        }
    }, [
        authLoading,
        disableAuth,
        isAuthenticated,
        login,
        isNew,
        entityNameParam,
        loadEntity,
    ]);

    useEffect(() => {
        if (!entity || isNew) return;

        const raw =
            entity?.entity_json ??
            entity?.entityJson ??
            entity?.result?.entity_json ??
            entity?.result ??
            entity;

        try {
            const safe = typeof raw === 'string' ? JSON.parse(raw) : raw;
            setJsonStr(JSON.stringify(safe ?? {}, null, 2));
        } catch (err) {
            console.error('Failed to normalize entity_json:', err);
            setJsonStr('{}');
        }
    }, [entity, isNew]);

    function handleBuilderChange(template: Record<string, unknown>) {
        setJsonStr(JSON.stringify(template, null, 2));
    }

    const onSave = async () => {
        try {
            const cleanEntityName = entityName.trim();

            if (!cleanEntityName) {
                alert('Entity name is required');
                return;
            }

            const parsed = JSON.parse(jsonStr);

            await saveEntity(cleanEntityName, parsed);

            router.push('/entity');
        } catch (err) {
            console.error('Save failed:', err);
            alert(
                err instanceof Error
                    ? err.message
                    : 'Save failed. Check console.'
            );
        }
    };

    if (authLoading) {
        return <p className="p-6">Checking authentication...</p>;
    }

    if (!disableAuth && !isAuthenticated) {
        return <p className="p-6 text-gray-600">Redirecting to login...</p>;
    }

    return (
        <main className="p-6 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">
                    {isNew ? 'Create Entity' : 'Edit Entity'}
                </h1>
                <p className="text-sm text-gray-600">
                    Define the JSON template for this entity.
                </p>
            </div>

            <div>
                <label className="block font-medium mb-2">Entity Name</label>
                <input
                    type="text"
                    value={entityName}
                    disabled={!isNew}
                    onChange={(e) => setEntityName(e.target.value)}
                    className="border px-3 py-2 rounded w-full disabled:bg-gray-100"
                    placeholder="employee"
                />
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {isNew && (
                <EntityTemplateBuilder
                    entityName={entityName}
                    onChange={handleBuilderChange}
                />
            )}

            <div>
                <label className="block font-medium mb-2">Entity JSON</label>
                <textarea
                    value={jsonStr}
                    onChange={(e) => setJsonStr(e.target.value)}
                    rows={20}
                    className="w-full font-mono text-sm border rounded-lg p-3"
                />
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-60"
                >
                    {isLoading ? 'Saving...' : 'Save Entity'}
                </button>

                <button
                    type="button"
                    onClick={() => router.push('/entity')}
                    className="px-4 py-2 border rounded-md"
                >
                    Cancel
                </button>
            </div>
        </main>
    );
}