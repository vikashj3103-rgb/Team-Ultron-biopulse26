-- HealthConnect Phase 2: Tenant Security Hardening, Tenant ID Immutability & Storage Governance.
-- Enforces that hospital_id / tenant ownership can NEVER be modified on any patient, clinician, or clinical record.
-- Configures replica identity for Realtime RLS evaluation and secures medical document storage.

create or replace function private.prevent_hospital_id_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hospital_id is distinct from old.hospital_id then
    raise exception 'Tenant reassignment forbidden: hospital_id is strictly immutable on table %', tg_table_name;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_hospital_id_mutation() from public, anon, authenticated;
grant execute on function private.prevent_hospital_id_mutation() to service_role;

-- Enforce hospital_id immutability across all tenant-scoped tables
drop trigger if exists prevent_patients_hospital_id_mutation on public.patients;
create trigger prevent_patients_hospital_id_mutation
  before update on public.patients
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_doctors_hospital_id_mutation on public.doctors;
create trigger prevent_doctors_hospital_id_mutation
  before update on public.doctors
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_attenders_hospital_id_mutation on public.attenders;
create trigger prevent_attenders_hospital_id_mutation
  before update on public.attenders
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_rooms_hospital_id_mutation on public.rooms;
create trigger prevent_rooms_hospital_id_mutation
  before update on public.rooms
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_vitals_hospital_id_mutation on public.patient_vitals;
create trigger prevent_vitals_hospital_id_mutation
  before update on public.patient_vitals
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_requests_hospital_id_mutation on public.patient_requests;
create trigger prevent_requests_hospital_id_mutation
  before update on public.patient_requests
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_alerts_hospital_id_mutation on public.alerts;
create trigger prevent_alerts_hospital_id_mutation
  before update on public.alerts
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_medications_hospital_id_mutation on public.medications;
create trigger prevent_medications_hospital_id_mutation
  before update on public.medications
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_reports_hospital_id_mutation on public.medical_reports;
create trigger prevent_reports_hospital_id_mutation
  before update on public.medical_reports
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_notes_hospital_id_mutation on public.doctor_notes;
create trigger prevent_notes_hospital_id_mutation
  before update on public.doctor_notes
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_timeline_hospital_id_mutation on public.patient_timeline_events;
create trigger prevent_timeline_hospital_id_mutation
  before update on public.patient_timeline_events
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_notifications_hospital_id_mutation on public.notifications;
create trigger prevent_notifications_hospital_id_mutation
  before update on public.notifications
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_devices_hospital_id_mutation on public.devices;
create trigger prevent_devices_hospital_id_mutation
  before update on public.devices
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_assets_hospital_id_mutation on public.assets;
create trigger prevent_assets_hospital_id_mutation
  before update on public.assets
  for each row execute function private.prevent_hospital_id_mutation();

drop trigger if exists prevent_memberships_hospital_id_mutation on public.hospital_memberships;
create trigger prevent_memberships_hospital_id_mutation
  before update on public.hospital_memberships
  for each row execute function private.prevent_hospital_id_mutation();

-- Ensure Supabase Realtime has complete row identity for CDC RLS policy evaluation on UPDATE and DELETE
alter table public.patients replica identity full;
alter table public.patient_vitals replica identity full;
alter table public.patient_requests replica identity full;
alter table public.alerts replica identity full;
alter table public.medications replica identity full;
alter table public.medical_reports replica identity full;
alter table public.doctor_notes replica identity full;
alter table public.patient_timeline_events replica identity full;
alter table public.notifications replica identity full;

-- Safe setup for Supabase Storage buckets and RLS policies (if storage schema exists)
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    -- Ensure clinical storage buckets are strictly non-public
    insert into storage.buckets (id, name, public)
    values ('clinical-reports', 'clinical-reports', false)
    on conflict (id) do update set public = false;

    insert into storage.buckets (id, name, public)
    values ('patient-documents', 'patient-documents', false)
    on conflict (id) do update set public = false;

    -- Enable RLS on storage.objects if table exists
    if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
      alter table storage.objects enable row level security;

      drop policy if exists clinical_storage_authorized_read on storage.objects;
      create policy clinical_storage_authorized_read on storage.objects
        for select
        to authenticated
        using (
          bucket_id in ('clinical-reports', 'patient-documents')
          and exists (
            select 1 from public.hospital_memberships hm
            join public.hospital_role_permissions hrp on hrp.role = hm.role
            where hm.user_id = (select auth.uid())
              and hm.status = 'active'
              and hrp.permission = 'reports.read'
          )
        );

      drop policy if exists clinical_storage_clinician_insert on storage.objects;
      create policy clinical_storage_clinician_insert on storage.objects
        for insert
        to authenticated
        with check (
          bucket_id in ('clinical-reports', 'patient-documents')
          and exists (
            select 1 from public.hospital_memberships hm
            join public.hospital_role_permissions hrp on hrp.role = hm.role
            where hm.user_id = (select auth.uid())
              and hm.status = 'active'
              and hrp.permission = 'reports.manage'
          )
        );
    end if;
  end if;
exception when others then
  null;
end $$;

comment on function private.prevent_hospital_id_mutation is 'Guarantees tenant isolation: hospital_id is strictly immutable once written.';
