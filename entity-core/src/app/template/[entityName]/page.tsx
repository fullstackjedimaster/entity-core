'use client';

import { useEffect, useState } from 'react';

export default function TemplateDetailPage({ params }: any) {
    const { entityName } = params;

    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const resp = await fetch(`/api/template/${entityName}`);
                if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
                setTemplate(await resp.json());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [entityName]);

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold">
                Template: <span className="font-mono">{entityName}</span>
            </h1>

            {loading && <p>Loading…</p>}
            {error && <p className="text-red-600">Error: {error}</p>}

            {template && (
                <pre className="p-4 bg-gray-100 border rounded text-sm overflow-x-auto">
          {JSON.stringify(template, null, 2)}
        </pre>
            )}
        </div>
    );
}
