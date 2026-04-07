"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const { isAuthenticated, user, login, logout, loading } = useAuth();

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p>Loading authentication…</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <h1 className="text-2xl font-semibold mb-4">CRUD-Client Authentication</h1>

            {isAuthenticated ? (
                <>
                    <p className="mb-4 text-gray-700">
                        Logged in as <strong>{user?.email}</strong>
                    </p>
                    <button
                        onClick={() => logout()}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                    >
                        Log out
                    </button>
                </>
            ) : (
                <>
                    <p className="text-gray-600 mb-8 text-center max-w-[320px]">
                        Securely manage entities, schemas, and templates through your CRUD-Server backend.
                    </p>
                    <button
                        onClick={() => login()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Log in with Auth0
                    </button>
                </>
            )}
        </main>
    );
}
