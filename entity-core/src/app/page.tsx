// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        router.push('/entities');
    }, [loading, isAuthenticated, router]);

    return (
        <main className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">
            <p>Redirecting to entities...</p>
        </main>
    );
}