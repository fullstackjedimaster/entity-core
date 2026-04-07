// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (loading) return; // wait for Auth0 to initialize
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }
        // ✅ Redirect authenticated users to default entity list
        router.push("/template");
    }, [loading, isAuthenticated, router]);

    return (
        <main className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">
            <p>Redirecting to templates…</p>
        </main>
    );
}
