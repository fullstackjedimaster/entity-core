// /src/lib/settings.ts
// Pure client-side configuration for Entity Core Client (Next.js)

export interface AppSettings {
    AUTH0_DOMAIN: string;
    AUTH0_CLIENT_ID: string;
    AUTH0_AUDIENCE: string;
    AUTH0_NAMESPACE: string;
    API_BASE_URL: string;      // Public API base, e.g. https://fullstackjedi.dev/entity-core/api
    ENTITY_CORE_SERVER_URL: string;   // Service root, e.g. https://fullstackjedi.dev/entity-core
    CRUD_SERVER_API_KEY: string;
    AUTH0_SCOPE: string;
    DISABLE_AUTH: string;
}

// Small helpers so we can support either API_BASE_URL or API_BASE
const DEFAULT_API_BASE = "https://entity-core.fullstackjedi.dev/api";
const DEFAULT_CRUD_SERVER = "https://entity-core.fullstackjedi.dev/";

const apiBaseFromEnv =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    DEFAULT_API_BASE;

const crudServerFromEnv =
    process.env.NEXT_PUBLIC_CRUD_SERVER_URL ||
    DEFAULT_CRUD_SERVER;

// -----------------------------------------------------------------------------
// Browser-safe configuration using NEXT_PUBLIC_* environment variables
// -----------------------------------------------------------------------------
export const settings: AppSettings = {
    AUTH0_DOMAIN: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "",
    AUTH0_CLIENT_ID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "",
    AUTH0_AUDIENCE:
        process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ||
        "https://entity-core.fullstackjedi.dev/api",
    AUTH0_NAMESPACE:
        process.env.NEXT_PUBLIC_AUTH0_NAMESPACE || "https://fullstackjedi.dev",

    // Public API base (Nginx → FastAPI)
    API_BASE_URL: apiBaseFromEnv,

    // Service root used by places that append `/api/...` themselves
    CRUD_SERVER_URL: crudServerFromEnv,

    CRUD_SERVER_API_KEY:
        process.env.NEXT_PUBLIC_CRUD_SERVER_API_KEY || "",

    // Full scope set including templates
    AUTH0_SCOPE:
        process.env.NEXT_PUBLIC_AUTH0_SCOPE ||
        "openid profile email crud:read crud:create crud:update crud:delete templates:read templates:write offline_access",

    DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH || "false",
};

// Optional one-line export for convenience in imports
export default settings;
