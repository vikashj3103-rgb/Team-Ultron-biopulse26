# HealthConnect Phase 1: Identity and Tenant Foundation

This phase creates the first multi-hospital security boundary without replacing the existing synthetic clinical workflows. The timestamped SQL migration is designed for the current `supabase/schema.sql` baseline and backfills its rows into the `legacy-careconnect` hospital. Do not treat `schema.sql` by itself as a deployment schema; it is the original prototype baseline and still has the policies that the migration replaces.

## Identity and authorization

- Supabase Auth verifies email and password. The browser no longer restores a role or user from `careconnect_auth_session_v2`.
- The application loads the authenticated user through `auth.getUser()`, then requires exactly one active `hospital_memberships` row. Role and permissions come from membership and `hospital_role_permissions`; profile role fields and user metadata never authorize access.
- Multiple active hospital memberships are denied until hospital switching is implemented. Prepared roles (`nurse`, `patient`, `pharmacy`, `operations`) exist in the database map, but the current UI only accepts `admin`, `doctor`, and `attender`.
- SQL helpers in the non-exposed `private` schema derive permission and patient assignment from `auth.uid()` plus active membership. Tenant-owned clinical tables use RLS, explicit grants, and composite `(resource_id, hospital_id)` foreign keys.
- The prior direct Supabase sync service stays disabled until each DataStore operation has a trusted tenant context and RLS-compatible payload. The browser's whole-clinic snapshot is not an acceptable production persistence API.
- Hospital admin is a hospital role. `private.platform_operators` is a separate, non-exposed company-operator plane and has no hospital-user access policy.
- Attenders can read assigned patient data and create a new nurse request. They cannot change request dispatch/resolution fields or mutate prescriptions. Internal request transitions remain staff controlled.

## Data and audit scope

The migration adds hospital ownership to rooms, doctors, attenders, patients, vitals, requests, alerts, medications, reports, notes, timeline events, and notifications; it also creates tenant-owned device and asset registries. Profiles remain global identities connected to hospitals by membership. Patient assignments and patient child records have composite same-hospital foreign keys.

`audit_logs` is append-only to application roles. Membership insert/update/delete events are recorded by a database trigger. A restricted service-role function is provided for trusted server events. Patient `SELECT` operations cannot be captured by ordinary row triggers; patient-access audit events must be wired into the future server/database read path. Authentication audit events also need integration with the chosen Supabase Auth event/export path.

## Browser storage inventory

| Classification | Current keys or data | Phase 1 handling |
| --- | --- | --- |
| A: UI preferences | `careconnect_language`, `healthconnect_language`, `careconnect_careai_language`, `healthconnect_tutorial_{admin,doctor,attender}_completed`, `healthconnect_careai_position`, `healthconnect_clinical_alert_sound`, `healthconnect_audio_muted` | Retained as preferences; they do not authorize access. |
| B: Temporary client state | `careconnect_active_patient_id`, `healthconnect_sse_client_id`, `healthconnect_sse_last_event_id` | Retained as navigation/relay state only; patient selection is not authorization. |
| C: Authentication/session | `careconnect_auth_session_v2` | No longer read or written. Supabase Auth may persist its own refresh session when configured; the SDK session is verified against Auth and does not supply the application role. |
| D: Clinical/demo data | `careconnect_datastore_v4` | Still holds the synthetic workflow store and mutable demo state: patient records, vitals, staff/caregiver details, requests, alerts, medicines, reports, notes, timeline, notifications, calls, care-team assignments, admissions, procedures, investigations, transfers, discharge plans, and client audit entries. It is not an authoritative hospital database. Credential-shaped Attender fields are removed when data is loaded, saved, imported, exported, or broadcast as a snapshot. |
| E: Demo/simulation | Simulation scenarios and temporary caregiver credentials supplied to DataStore in memory | Retained only to keep synthetic workflow verification usable. Credentials are not used by AuthContext, are not persisted or included in snapshots, and do not authorize a real session. |

The next persistence phase must replace every clinical read and write above with tenant-scoped Supabase queries or trusted server functions, migrate any retained local records with an explicit hospital mapping, remove local clinical storage as an authority, and move patient-access audit events into that read path. Admissions, encounters, procedures, medication administrations, investigations, transfers, discharge plans, care-team assignments, and nurse-call operations still exist only in the local DataStore and need tenant-owned SQL models. Production-authenticated users currently see a migration notice instead of the local clinical store.

## Demo relay boundary

The role-picker demo login requires both a Vite development build and `VITE_DEMO_MODE=true`; production builds cannot enable it. The `/admin/demo` route follows the same gate. Vercel in-memory sync/reset/hardware endpoints return `503` unless `HEALTHCONNECT_DEMO_MODE=true` outside production. The Vite relay only runs when the dev server is explicitly configured with `VITE_DEMO_MODE=true`. These relays are synthetic simulation tools, not an authenticated persistence path. Keep real patient data out of demo mode.

## Migration and validation

The migration name follows Supabase's timestamped naming convention. The local Supabase CLI could not start on this Windows host because Application Control blocked the downloaded `supabase.exe`; consequently this environment could not run `supabase test db` or verify the migration against a local Postgres instance. Run the migration and pgTAP suite in an isolated Supabase local database before deployment. Never apply it directly to a production project without reviewing the target database and deployment plan.

`supabase/tests/tenant_isolation.test.sql` contains seven database assertions for same-hospital access, cross-hospital patient read/update, doctor vitals, Attender requests, anonymous access, and missing membership. `scripts/verify-security-foundation.cjs` checks that the migration and the fail-closed identity/relay contracts remain present. The regular HealthConnect verification suite continues to cover the demo workflows.

## Remaining blockers

1. The migration has not yet been executed in a local or hosted PostgreSQL database; SQL parse and pgTAP results are pending.
2. The clinical DataStore has not been replaced with Supabase-backed reads/writes. That is why real authenticated accounts are stopped before the synthetic workspace.
3. Auth profile provisioning, hospital onboarding, membership management, invitations, multi-hospital selection, and platform-admin operations need trusted server workflows.
4. Device registration and per-device credentials are not implemented; production hardware ingestion remains disabled.
5. Patient-read audit logging and complete authentication-event ingestion need to be connected to trusted server/database paths.
6. Browser automation scripts that inject the removed localStorage identity need to sign in through the gated demo flow in development or use a local Supabase Auth fixture.
