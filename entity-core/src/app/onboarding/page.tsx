"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { settings } from "@/lib/settings";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = settings.API_BASE_URL
const AUTH0_DOMAIN = settings.AUTH0_DOMAIN
const AUTH0_REDIRECT_URI = settings.AUTH0_REDIRECT_URI
/**
 * Wrapper component to satisfy Next's requirement that
 * useSearchParams() be used inside a Suspense boundary.
 */
export default function OnboardingPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-md mx-auto">
                    <h1 className="text-2xl font-bold mb-4">
                        Create Your Organization
                    </h1>
                    <p className="text-gray-700">Loading onboarding…</p>
                </main>
            }
        >
            <OnboardingInner />
        </Suspense>
    );
}

/**
 * Onboarding creates an organization schema and assigns the user to it.
 * After provisioning, we redirect to:
 *
 *   https://AUTH0_DOMAIN/continue?state=STATE
 *
 * Which triggers `onContinuePostLogin` and causes Auth0 to re-mint the
 * refresh token + access token *with* the new org_id/schema claims included.
 */
function OnboardingInner() {
    const router = useRouter();
    const params = useSearchParams();

    const sessionToken = params.get("session_token") || "";
    const stateParam = params.get("state") || "";

    const [decoded, setDecoded] = useState<any>(null);
    const [orgKey, setOrgKey] = useState("");
    const { isAuthenticated, getToken, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Decode onboarding session token
    useEffect(() => {
        if (!sessionToken) return;
        try {
            const body = sessionToken.split(".")[1];
            const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
            setDecoded(JSON.parse(json));
        } catch (err) {
            console.error("Failed to decode session token:", err);
            setError("Invalid session token.");
        }
    }, [sessionToken]);



  const submit = async () => {
      try {
        setLoading(true);
        setError(null);

        const org = orgKey.trim().toLowerCase();


        const provRes = await fetch(`${API_BASE_URL}/onboarding/provision_tenant`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Onboarding-Token": sessionToken,
              },
              body: JSON.stringify({
                schema: org,
                state: stateParam
              }),
            });

        if (!provRes.ok) {
          setError(await provRes.text());
          return;
        }

         const sessionToken = await provRes.json();

         window.location.href = `https://${AUTH0_DOMAIN}/continue?state=${stateParam}&session_token=${sessionToken}`;
//             const url = `https://${TENANT_DOMAIN}/continue?state=${stateParam}&session_token=${sessionToken}`

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }

    };
    return (
        <main className="p-6 max-w-md mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Create Your Organization</h1>

            {decoded && (
                <p className="text-gray-700">
                    Welcome, <strong>{decoded.name || decoded.email}</strong>
                </p>
            )}

            {error && <p className="text-red-600">{error}</p>}

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="organization key (e.g., acme)"
                value={orgKey}
                onChange={(e) => setOrgKey(e.target.value)}
            />

            <button
                onClick={submit}
                disabled={loading || !orgKey}
                className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
            >
                {loading ? "Provisioning…" : "Continue"}
            </button>
        </main>
    );
}
