# Entity Core demo readiness update

## Public demo

Use `/demo` as the portfolio embed target. The root route remains the authenticated application entry point.

Recommended portfolio setting:

```json
"embedDirect": "https://entity-core.fullstackjedi.dev/demo"
```

## Corrected inconsistencies

- Added a public, authentication-independent `/demo` experience.
- Matched the Entity Server / Entity Client dark navy demo theme.
- The demo does not render a workspace until `Build Workspace` is clicked.
- Any single top-level entity object is accepted; `employee` is not required.
- Editing JSON invalidates the prior generated workspace.
- Replaced stale product metadata (`CRUD Client`) with `Entity Core`.
- Removed the duplicate global stylesheet import.
- Renamed the package from `entity-client` to `entity-core`.
- Replaced the older embed height reporter with content-root-aware measurement.
- Kept production CRUD/auth routes intact.

## Remaining production concerns noticed during review

- `src/app/dashboard/page.tsx` is still a placeholder and should not be featured in the demo.
- Several hooks use broad `any` types. This does not block the demo, but should be tightened later.
- The authenticated entity-definition and CRUD pages still depend on live API/auth configuration; the public demo intentionally does not.
- The old `src/components/demo-shell/` directory is no longer needed because the portfolio owns the outer demo shell. It may be deleted after confirming no imports remain.
