import './globals.css';
import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import AuthWrapper from '@/components/AuthWrapper';

const roboto = Roboto({
    weight: ['400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'CRUD Client',
    description: 'Entity Management App using CRUD Server backend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={roboto.className}>
        <body>
        <AuthWrapper>{children}</AuthWrapper>
        </body>
        </html>
    );
}
