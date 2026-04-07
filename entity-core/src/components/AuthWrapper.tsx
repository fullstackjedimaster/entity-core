'use client';

import React from 'react';
import {
    Auth0Provider,
    AppState,
} from '@auth0/auth0-react';

/**
 * Top-level Auth0 provider for Entity Core.
 * This is the only app that talks to Auth0 directly.
 */
export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const redirectUri =
        typeof window !== 'undefined'
            ? window.location.origin + '/callback'
            : process.env.NEXT_PUBLIC_AUTH0_REDIRECT_URI ??
            'http://localhost:3000/callback';

    const onRedirectCallback = (appState?: AppState) => {
        // Prefer explicit returnTo from appState, otherwise go to /template
        if (typeof window === 'undefined') return;

        const target =
            (appState?.returnTo as string | undefined) ??
            '/template';

        window.location.replace(target);
    };

    return (
        <Auth0Provider
            domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
            clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
            authorizationParams={{
                redirect_uri: redirectUri,
                audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE!,
                scope:
                    process.env.NEXT_PUBLIC_AUTH0_SCOPE ||
                    'openid profile email crud:read crud:create crud:update crud:delete offline_access',
            }}
            cacheLocation="localstorage"
            useRefreshTokens={true}
            onRedirectCallback={onRedirectCallback}
        >
            {children}
        </Auth0Provider>
    );
}
