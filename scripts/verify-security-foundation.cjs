const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migrationDirectory = path.join(root, 'supabase', 'migrations');
const migrationName = 'tenant_identity_foundation';

assert.ok(fs.existsSync(migrationDirectory), 'Supabase migrations directory exists');
const migrationFiles = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith(`_${migrationName}.sql`));
assert.equal(migrationFiles.length, 1, 'tenant identity migration exists exactly once');

const migration = read(path.join('supabase', 'migrations', migrationFiles[0]));
for (const table of ['hospitals', 'hospital_memberships', 'hospital_role_permissions', 'audit_logs', 'devices', 'assets']) {
  assert.match(migration, new RegExp(`create table(?: if not exists)? public\\.${table}\\b`, 'i'), `${table} is created`);
}
for (const table of ['rooms', 'doctors', 'attenders', 'patients', 'patient_vitals', 'patient_requests', 'alerts', 'medications', 'medical_reports', 'doctor_notes', 'patient_timeline_events', 'notifications']) {
  assert.match(migration, new RegExp(`alter table public\\.${table}[^;]*hospital_id`, 'is'), `${table} is tenant-owned`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} has RLS enabled`);
}
for (const table of ['devices', 'assets']) {
  assert.match(migration, new RegExp(`create table(?: if not exists)? public\\.${table}\\b[^;]*hospital_id`, 'is'), `${table} is tenant-owned`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} has RLS enabled`);
}
assert.match(migration, /foreign key\s*\(patient_id, hospital_id\)\s*references\s+public\.patients\s*\(id, hospital_id\)/i, 'clinical child records use tenant-aware patient foreign keys');
assert.match(migration, /user_has_hospital_permission/i, 'RLS derives permission from authenticated membership');
assert.match(migration, /revoke\s+(?:all|update|delete)[^;]*audit_logs/i, 'audit records cannot be edited or deleted by application roles');
assert.match(migration, /platform_operators/i, 'company platform operators are separate from hospital membership roles');

const authContext = read(path.join('src', 'context', 'AuthContext.tsx'));
assert.match(authContext, /signInWithPassword/, 'credential login delegates to Supabase Auth');
assert.match(authContext, /\.from\(['"]hospital_memberships['"]\)/, 'workspace role is loaded from hospital membership');
assert.doesNotMatch(authContext, /localStorage\.(?:getItem|setItem)\(\s*AUTH_STORAGE_KEY/, 'application role identity is not restored from localStorage');
assert.doesNotMatch(authContext, /user_metadata\??\.role|profile\??\.role/, 'client metadata and legacy profile role never grant privileges');
assert.doesNotMatch(authContext, /verifyAttenderPassword\(/, 'Attender passwords are not authenticated by the clinical store');
assert.match(read(path.join('src', 'services', 'dataStore.ts')), /removeAttenderCredentials/, 'legacy Attender credentials are stripped from local storage and snapshots');

const loginPage = read(path.join('src', 'pages', 'LoginPage.tsx'));
assert.match(loginPage, /DEMO_MODE_ENABLED/, 'demo login is controlled by the development-only feature gate');
assert.match(read(path.join('src', 'services', 'supabaseSyncService.ts')), /isTenantPersistenceReady = false/, 'legacy non-tenant Supabase writes remain disabled');
for (const relativePath of ['api/sync/index.ts', 'api/sync/state.ts', 'api/sync/reset.ts', 'api/patient-events.ts']) {
  assert.match(read(relativePath), /denyIfDemoRelayDisabled/, `${relativePath} fails closed outside isolated demo mode`);
}

const rlsTests = read(path.join('supabase', 'tests', 'tenant_isolation.test.sql'));
for (const caseLabel of [
  'Hospital A user reads Hospital A patient',
  'Hospital A user cannot read Hospital B patient',
  'Hospital A user cannot modify Hospital B patient',
  'Hospital A doctor cannot access Hospital B vitals',
  'Hospital A attender cannot access Hospital B requests',
  'Unauthenticated user cannot read patient data',
  'Invalid membership cannot read hospital data',
]) {
  assert.ok(rlsTests.includes(caseLabel), `database isolation case exists: ${caseLabel}`);
}

console.log('✅ Security foundation contracts verified');
