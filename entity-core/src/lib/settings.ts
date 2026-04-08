// /src/lib/env.ts

function required(name: string, value?: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const settings = {
  ENTITY_CORE_API_BASE_URL:
    process.env.NEXT_PUBLIC_ENTITY_CORE_API_BASE_URL ||
     "https://entity-core.fullstackjedi.dev/api",

  AUTH0_DOMAIN: required(
    "NEXT_PUBLIC_AUTH0_DOMAIN",
    process.env.NEXT_PUBLIC_AUTH0_DOMAIN
  ),

  AUTH0_CLIENT_ID: required(
    "NEXT_PUBLIC_AUTH0_CLIENT_ID",
    process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
  ),

  AUTH0_AUDIENCE: required(
    "NEXT_PUBLIC_AUTH0_AUDIENCE",
    process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  ),

  AUTH0_NAMESPACE:
    process.env.NEXT_PUBLIC_AUTH0_NAMESPACE ||
    "https://fullstackjedi.dev",

  AUTH0_SCOPE:
    process.env.NEXT_PUBLIC_AUTH0_SCOPE ||
    "openid profile email crud:read crud:create crud:update crud:delete offline_access",

  AUTH0_REDIRECT_URI:
    process.env.NEXT_PUBLIC_AUTH0_REDIRECT_URI ||
    "https://entity-core.fullstackjedi.dev/callback",

  DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH === "true",
} as const;

export default settings;