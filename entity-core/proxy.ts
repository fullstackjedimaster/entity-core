// entity-core/proxy.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH0_DOMAIN =
    process.env.NEXT_PUBLIC_AUTH0_DOMAIN?.trim() ||
    "dev-gttnobig6h3trkvm.us.auth0.com";

const AUTH0_ORIGIN = `https://${AUTH0_DOMAIN}`;

const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",

    [
        "script-src",
        "'self'",
        "'unsafe-inline'",
    ].join(" "),

    [
        "style-src",
        "'self'",
        "'unsafe-inline'",
    ].join(" "),

    [
        "img-src",
        "'self'",
        "data:",
        "blob:",
        "https:",
    ].join(" "),

    [
        "font-src",
        "'self'",
        "data:",
    ].join(" "),

    [
        "connect-src",
        "'self'",
        "https://entity-core.fullstackjedi.dev",
        AUTH0_ORIGIN,
        "https://*.auth0.com",
    ].join(" "),

    [
        "frame-src",
        "'self'",
        AUTH0_ORIGIN,
        "https://*.auth0.com",
    ].join(" "),

    [
        "child-src",
        "'self'",
        AUTH0_ORIGIN,
        "https://*.auth0.com",
    ].join(" "),

    [
        "form-action",
        "'self'",
        AUTH0_ORIGIN,
        "https://*.auth0.com",
    ].join(" "),

    [
        "frame-ancestors",
        "'self'",
        "https://fullstackjedi.dev",
        "https://www.fullstackjedi.dev",
    ].join(" "),
].join("; ");

export function proxy(
    _request: NextRequest,
): NextResponse {
    const response = NextResponse.next();

    response.headers.set(
        "Content-Security-Policy",
        CONTENT_SECURITY_POLICY,
    );

    response.headers.set(
        "Referrer-Policy",
        "strict-origin-when-cross-origin",
    );

    response.headers.set(
        "X-Content-Type-Options",
        "nosniff",
    );

    /*
     * Do not set X-Frame-Options here. The application is intentionally
     * embedded by the Portfolio, and frame-ancestors is the modern,
     * explicit control for that relationship.
     */

    return response;
}

export const config = {
    /*
     * Apply to application documents and route responses while avoiding
     * immutable framework assets and common public files.
     */
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
    ],
};