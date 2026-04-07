'use client';

import { useState } from 'react';

export default function TemplateCreatorPage() {
    const [entityName, setEntityName] = useState('');
    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const resp = await fetch(`/api/template/${entityName}`);
            if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
            const data = await resp.json();
            setTemplate(data);
        } catch (err: any) {
            setError(err.message);
            setTemplate(null);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold">Create New Template</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block font-medium mb-2">Entity Name</label>
                    <input
                        type="text"
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        className="border px-3 py-2 rounded w-full"
                        placeholder="e.g., employee"
                    />
                </div>

                <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                    Generate Template
                </button>
            </form>

            {loading && <p>Loading...</p>}
            {error && <p className="text-red-600">Error: {error}</p>}

            {template && (
                <pre className="mt-6 p-4 bg-gray-100 border rounded text-sm overflow-x-auto">
          {JSON.stringify(template, null, 2)}
        </pre>
            )}
        </div>
    );
}
