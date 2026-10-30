-- HealthConnect Phase 1: hospital identity, tenant ownership, RLS and audit foundation.
-- The original single-hospital rows are assigned to one bootstrap tenant. Future tenants
-- must be provisioned by a trusted platform workflow; membership remains the authority.

create extension if not exists "uuid-ossp";
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.hospitals (id, name, slug, status)
values ('00000000-0000-4000-8000-000000000001', 'CareConnect Legacy Hospital', 'legacy-careconnect', 'active')
on conflict (id) do nothing;

create table if not exists public.hospital_memberships (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'doctor', 'attender', 'nurse', 'patient', 'pharmacy', 'operations')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, user_id),
  unique (id, hospital_id)
);

create table if not exists public.hospital_role_permissions (
  role text not null check (role in ('admin', 'doctor', 'attender', 'nurse', 'patient', 'pharmacy', 'operations')),
  permission text not null,
  primary key (role, permission)
);

insert into public.hospital_role_permissions (role, permission) values
  ('admin', 'hospitals.read'), ('admin', 'memberships.read'), ('admin', 'memberships.manage'),
  ('admin', 'rooms.read'), ('admin', 'rooms.manage'), ('admin', 'doctors.read'), ('admin', 'doctors.manage'),
  ('admin', 'attenders.read'), ('admin', 'attenders.manage'), ('admin', 'patients.read'), ('admin', 'patients.create'),
  ('admin', 'patients.update'), ('admin', 'patients.delete'), ('admin', 'vitals.read'), ('admin', 'vitals.write'),
  ('admin', 'requests.read'), ('admin', 'requests.manage'), ('admin', 'alerts.read'), ('admin', 'alerts.manage'),
  ('admin', 'medications.read'), ('admin', 'medications.manage'), ('admin', 'reports.read'), ('admin', 'reports.manage'),
  ('admin', 'notes.read'), ('admin', 'notes.manage'), ('admin', 'timeline.read'), ('admin', 'timeline.manage'),
  ('admin', 'notifications.read'), ('admin', 'notifications.manage'), ('admin', 'devices.read'), ('admin', 'devices.manage'),
  ('admin', 'assets.read'), ('admin', 'assets.manage'), ('admin', 'audit.read'),
  ('doctor', 'hospitals.read'), ('doctor', 'rooms.read'), ('doctor', 'doctors.read'), ('doctor', 'attenders.read'), ('doctor', 'patients.read'),
  ('doctor', 'patients.update'), ('doctor', 'vitals.read'), ('doctor', 'vitals.write'), ('doctor', 'requests.read'),
  ('doctor', 'requests.manage'), ('doctor', 'alerts.read'), ('doctor', 'alerts.manage'), ('doctor', 'medications.read'),
  ('doctor', 'medications.manage'), ('doctor', 'reports.read'), ('doctor', 'reports.manage'), ('doctor', 'notes.read'),
  ('doctor', 'notes.manage'), ('doctor', 'timeline.read'), ('doctor', 'timeline.manage'), ('doctor', 'notifications.read'),
  ('doctor', 'devices.read'), ('doctor', 'assets.read'),
  ('attender', 'hospitals.read'), ('attender', 'rooms.read'), ('attender', 'patients.assigned.read'), ('attender', 'vitals.limited.read'),
  ('attender', 'requests.assigned.read'), ('attender', 'requests.create'), ('attender', 'alerts.assigned.read'),
  ('attender', 'medications.read'), ('attender', 'reports.read'), ('attender', 'timeline.read'),
  ('attender', 'notifications.read'), ('attender', 'devices.read'), ('attender', 'assets.read')
on conflict (role, permission) do nothing;

-- The company platform operator plane is separate and is not exposed through the public API.
create table if not exists private.platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
alter table private.platform_operators enable row level security;
revoke all on private.platform_operators from public, anon, authenticated;
grant all on private.platform_operators to service_role;

-- A single bootstrap tenant preserves existing prototype rows without trusting browser context.
alter table public.rooms add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.doctors add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.attenders add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.patients add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.patient_vitals add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.patient_requests add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.alerts add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.medications add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.medical_reports add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.doctor_notes add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.patient_timeline_events add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';
alter table public.notifications add column if not exists hospital_id uuid default '00000000-0000-4000-8000-000000000001';

update public.rooms set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.doctors set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.attenders set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.patients set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.patient_vitals set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.patient_requests set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.alerts set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.medications set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.medical_reports set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.doctor_notes set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.patient_timeline_events set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;
update public.notifications set hospital_id = '00000000-0000-4000-8000-000000000001' where hospital_id is null;

alter table public.rooms alter column hospital_id set not null;
alter table public.doctors alter column hospital_id set not null;
alter table public.attenders alter column hospital_id set not null;
alter table public.patients alter column hospital_id set not null;
alter table public.patient_vitals alter column hospital_id set not null;
alter table public.patient_requests alter column hospital_id set not null;
alter table public.alerts alter column hospital_id set not null;
alter table public.medications alter column hospital_id set not null;
alter table public.medical_reports alter column hospital_id set not null;
alter table public.doctor_notes alter column hospital_id set not null;
alter table public.patient_timeline_events alter column hospital_id set not null;
alter table public.notifications alter column hospital_id set not null;

-- Create composite parent keys before adding tenant-aware child tables and foreign keys.
alter table public.rooms drop constraint if exists rooms_room_number_key;
alter table public.rooms add constraint rooms_hospital_room_number_key unique (hospital_id, room_number);
alter table public.rooms add constraint rooms_id_hospital_key unique (id, hospital_id);
alter table public.doctors add constraint doctors_id_hospital_key unique (id, hospital_id);
alter table public.attenders add constraint attenders_id_hospital_key unique (id, hospital_id);
alter table public.patients drop constraint if exists patients_mrn_key;
alter table public.patients add constraint patients_hospital_mrn_key unique (hospital_id, mrn);
alter table public.patients add constraint patients_id_hospital_key unique (id, hospital_id);

-- Membership is the trusted role source. The old profile.role column is retained only for legacy display compatibility.
comment on column public.profiles.role is 'Legacy display field only; authorization is derived from active hospital_memberships.';
insert into public.hospital_memberships (hospital_id, user_id, role, status)
select '00000000-0000-4000-8000-000000000001', p.id, p.role, 'active'
from public.profiles p
where p.role in ('admin', 'doctor', 'attender')
on conflict (hospital_id, user_id) do nothing;

-- Device and asset registries start empty. Device identity and patient assignment are tenant-scoped.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default '00000000-0000-4000-8000-000000000001',
  serial_number text not null,
  device_type text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance', 'retired')),
  patient_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, serial_number),
  unique (id, hospital_id),
  foreign key (hospital_id) references public.hospitals(id) on delete cascade,
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete set null (patient_id)
);

update public.patients set hardware_device_id = null where btrim(coalesce(hardware_device_id, '')) = '';

insert into public.devices (hospital_id, serial_number, device_type, status, patient_id)
select distinct on (p.hospital_id, p.hardware_device_id)
  p.hospital_id, p.hardware_device_id, 'legacy_hardware', 'active', p.id
from public.patients p
where p.hardware_device_id is not null and btrim(p.hardware_device_id) <> ''
order by p.hospital_id, p.hardware_device_id, p.id
on conflict (hospital_id, serial_number) do nothing;

alter table public.patients add constraint patients_device_same_hospital_fk
  foreign key (hospital_id, hardware_device_id)
  references public.devices(hospital_id, serial_number)
  on delete set null (hardware_device_id);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default '00000000-0000-4000-8000-000000000001',
  asset_tag text not null,
  name text not null,
  category text not null,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'retired')),
  room_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, asset_tag),
  unique (id, hospital_id),
  foreign key (hospital_id) references public.hospitals(id) on delete cascade,
  foreign key (room_id, hospital_id) references public.rooms(id, hospital_id) on delete set null (room_id)
);

-- Tenant-aware unique keys and parent relationships prevent cross-hospital links at the database layer.
alter table public.rooms add constraint rooms_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.doctors add constraint doctors_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.attenders add constraint attenders_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.patients add constraint patients_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;

alter table public.patients drop constraint if exists patients_assigned_doctor_id_fkey;
alter table public.patients drop constraint if exists patients_assigned_attender_id_fkey;
alter table public.patients add constraint patients_doctor_same_hospital_fk foreign key (assigned_doctor_id, hospital_id) references public.doctors(id, hospital_id) on delete set null (assigned_doctor_id);
alter table public.patients add constraint patients_attender_same_hospital_fk foreign key (assigned_attender_id, hospital_id) references public.attenders(id, hospital_id) on delete set null (assigned_attender_id);
alter table public.attenders drop constraint if exists fk_attender_patient;
alter table public.attenders add constraint attenders_patient_same_hospital_fk foreign key (assigned_patient_id, hospital_id) references public.patients(id, hospital_id) on delete set null (assigned_patient_id);

alter table public.patient_vitals add constraint patient_vitals_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.patient_vitals drop constraint if exists patient_vitals_patient_id_fkey;
alter table public.patient_vitals add constraint patient_vitals_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.patient_requests add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.patient_requests add constraint patient_requests_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.patient_requests drop constraint if exists patient_requests_patient_id_fkey;
alter table public.patient_requests add constraint patient_requests_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.alerts add constraint alerts_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.alerts drop constraint if exists alerts_patient_id_fkey;
alter table public.alerts add constraint alerts_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.medications add constraint medications_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.medications drop constraint if exists medications_patient_id_fkey;
alter table public.medications add constraint medications_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.medical_reports add constraint medical_reports_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.medical_reports drop constraint if exists medical_reports_patient_id_fkey;
alter table public.medical_reports add constraint medical_reports_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.doctor_notes add constraint doctor_notes_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.doctor_notes drop constraint if exists doctor_notes_patient_id_fkey;
alter table public.doctor_notes add constraint doctor_notes_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;
alter table public.doctor_notes drop constraint if exists doctor_notes_doctor_id_fkey;
alter table public.doctor_notes add constraint doctor_notes_doctor_same_hospital_fk foreign key (doctor_id, hospital_id) references public.doctors(id, hospital_id) on delete set null (doctor_id);

alter table public.patient_timeline_events add constraint patient_timeline_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.patient_timeline_events drop constraint if exists patient_timeline_events_patient_id_fkey;
alter table public.patient_timeline_events add constraint patient_timeline_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

alter table public.notifications add constraint notifications_hospital_fk foreign key (hospital_id) references public.hospitals(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_patient_id_fkey;
alter table public.notifications add constraint notifications_patient_same_hospital_fk foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete cascade;

create index if not exists idx_memberships_user_status on public.hospital_memberships(user_id, status);
create index if not exists idx_patients_hospital_status on public.patients(hospital_id, status);
create index if not exists idx_vitals_hospital_patient_time on public.patient_vitals(hospital_id, patient_id, timestamp desc);
create index if not exists idx_requests_hospital_patient_time on public.patient_requests(hospital_id, patient_id, timestamp desc);
create index if not exists idx_alerts_hospital_patient_status on public.alerts(hospital_id, patient_id, status);
create index if not exists idx_medications_hospital_patient on public.medications(hospital_id, patient_id);
create index if not exists idx_reports_hospital_patient on public.medical_reports(hospital_id, patient_id);
create index if not exists idx_notes_hospital_patient on public.doctor_notes(hospital_id, patient_id);
create index if not exists idx_timeline_hospital_patient_time on public.patient_timeline_events(hospital_id, patient_id, timestamp desc);
create index if not exists idx_notifications_hospital_user_time on public.notifications(hospital_id, user_id, timestamp desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  resource_type text,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success', 'failure', 'denied')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_hospital_time on public.audit_logs(hospital_id, created_at desc);
create index if not exists idx_audit_logs_actor_time on public.audit_logs(actor_id, created_at desc);

create or replace function private.role_has_permission(p_role text, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hospital_role_permissions rp
    where rp.role = p_role and rp.permission = p_permission
  );
$$;

create or replace function private.user_has_hospital_permission(p_hospital_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.hospital_memberships hm
    join public.hospital_role_permissions rp on rp.role = hm.role and rp.permission = p_permission
    where hm.user_id = (select auth.uid())
      and hm.hospital_id = p_hospital_id
      and hm.status = 'active'
  );
$$;

create or replace function private.can_access_patient(p_patient_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hospital_id uuid;
  v_doctor_id uuid;
  v_attender_id uuid;
  v_role text;
  v_permission text;
begin
  if auth.uid() is null then return false; end if;

  select p.hospital_id, p.assigned_doctor_id, p.assigned_attender_id
    into v_hospital_id, v_doctor_id, v_attender_id
  from public.patients p
  where p.id = p_patient_id;
  if not found then return false; end if;

  select hm.role into v_role
  from public.hospital_memberships hm
  where hm.user_id = (select auth.uid())
    and hm.hospital_id = v_hospital_id
    and hm.status = 'active';
  if not found then return false; end if;

  v_permission := p_permission;
  if v_role = 'attender' then
    v_permission := case p_permission
      when 'patients.read' then 'patients.assigned.read'
      when 'vitals.read' then 'vitals.limited.read'
      when 'requests.read' then 'requests.assigned.read'
      when 'alerts.read' then 'alerts.assigned.read'
      else p_permission
    end;
  end if;
  if not private.role_has_permission(v_role, v_permission) then return false; end if;

  if v_role = 'admin' then return true; end if;
  if v_role = 'doctor' then
    return v_doctor_id is not null and exists (
      select 1 from public.doctors d
      where d.id = v_doctor_id and d.hospital_id = v_hospital_id and d.profile_id = (select auth.uid())
    );
  end if;
  if v_role = 'attender' then
    return v_attender_id is not null and exists (
      select 1 from public.attenders a
      where a.id = v_attender_id and a.hospital_id = v_hospital_id and a.profile_id = (select auth.uid())
    );
  end if;
  return false;
end;
$$;

revoke all on function private.role_has_permission(text, text) from public, anon, authenticated;
revoke all on function private.user_has_hospital_permission(uuid, text) from public, anon;
revoke all on function private.can_access_patient(uuid, text) from public, anon;
grant execute on function private.role_has_permission(text, text) to authenticated, service_role;
grant execute on function private.user_has_hospital_permission(uuid, text) to authenticated, service_role;
grant execute on function private.can_access_patient(uuid, text) to authenticated, service_role;

create or replace function private.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit log records are immutable';
end;
$$;
revoke all on function private.prevent_audit_log_mutation() from public, anon, authenticated;
create trigger audit_logs_immutable before update or delete on public.audit_logs
for each row execute function private.prevent_audit_log_mutation();

create or replace function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_hospital_id uuid;
begin
  if tg_op <> 'INSERT' then v_old := jsonb_build_object('role', old.role, 'status', old.status); end if;
  if tg_op <> 'DELETE' then v_new := jsonb_build_object('role', new.role, 'status', new.status); end if;
  if tg_op = 'DELETE' then v_hospital_id := old.hospital_id; else v_hospital_id := new.hospital_id; end if;
  insert into public.audit_logs (hospital_id, actor_id, event_type, resource_type, resource_id, details)
  values (v_hospital_id, (select auth.uid()), 'membership.' || lower(tg_op), 'hospital_membership',
    case when tg_op = 'DELETE' then old.id::text else new.id::text end,
    jsonb_build_object('before', v_old, 'after', v_new));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.audit_membership_change() from public, anon, authenticated;
create trigger hospital_memberships_audit after insert or update or delete on public.hospital_memberships
for each row execute function private.audit_membership_change();

create or replace function private.append_audit_event(
  p_hospital_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_outcome text default 'success',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_outcome not in ('success', 'failure', 'denied') then
    raise exception 'invalid audit outcome';
  end if;
  insert into public.audit_logs (hospital_id, actor_id, event_type, resource_type, resource_id, outcome, details)
  values (p_hospital_id, p_actor_id, p_event_type, p_resource_type, p_resource_id, p_outcome, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.append_audit_event(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.append_audit_event(uuid, uuid, text, text, text, text, jsonb) to service_role;

-- Drop the prototype's broad policies before adding the tenant-specific policies below.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'rooms', 'doctors', 'attenders', 'patients', 'patient_vitals', 'patient_requests', 'alerts',
        'medications', 'medical_reports', 'doctor_notes', 'patient_timeline_events', 'notifications', 'hospitals',
        'hospital_memberships', 'hospital_role_permissions', 'audit_logs', 'devices', 'assets'
      ])
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.hospital_memberships enable row level security;
alter table public.hospital_role_permissions enable row level security;
alter table public.rooms enable row level security;
alter table public.doctors enable row level security;
alter table public.attenders enable row level security;
alter table public.patients enable row level security;
alter table public.patient_vitals enable row level security;
alter table public.patient_requests enable row level security;
alter table public.alerts enable row level security;
alter table public.medications enable row level security;
alter table public.medical_reports enable row level security;
alter table public.doctor_notes enable row level security;
alter table public.patient_timeline_events enable row level security;
alter table public.notifications enable row level security;
alter table public.devices enable row level security;
alter table public.assets enable row level security;
alter table public.audit_logs enable row level security;

-- Remove any prior grants; each table is re-granted only the operations required by its policies.
revoke all on public.profiles, public.hospitals, public.hospital_memberships, public.hospital_role_permissions,
  public.rooms, public.doctors, public.attenders, public.patients, public.patient_vitals, public.patient_requests,
  public.alerts, public.medications, public.medical_reports, public.doctor_notes, public.patient_timeline_events,
  public.notifications, public.devices, public.assets, public.audit_logs from public, anon, authenticated;

grant select on public.profiles, public.hospitals, public.hospital_memberships, public.hospital_role_permissions,
  public.rooms, public.doctors, public.attenders, public.patients, public.patient_vitals, public.patient_requests,
  public.alerts, public.medications, public.medical_reports, public.doctor_notes, public.patient_timeline_events,
  public.notifications, public.devices, public.assets, public.audit_logs to authenticated;
grant insert on public.patients, public.patient_vitals, public.patient_requests, public.alerts,
  public.medications, public.medical_reports, public.doctor_notes, public.patient_timeline_events to authenticated;
grant update on public.patients, public.patient_requests, public.alerts, public.medications,
  public.medical_reports, public.doctor_notes, public.patient_timeline_events to authenticated;
grant update (read) on public.notifications to authenticated;

create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy hospitals_member_read on public.hospitals for select to authenticated
  using (private.user_has_hospital_permission(id, 'hospitals.read'));
create policy memberships_self_or_admin_read on public.hospital_memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.user_has_hospital_permission(hospital_id, 'memberships.read'));
create policy role_permissions_authenticated_read on public.hospital_role_permissions for select to authenticated
  using (true);

create policy rooms_member_read on public.rooms for select to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'rooms.read'));
create policy rooms_admin_manage on public.rooms for all to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'rooms.manage'))
  with check (private.user_has_hospital_permission(hospital_id, 'rooms.manage'));
create policy doctors_member_read on public.doctors for select to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'doctors.read'));
create policy doctors_admin_manage on public.doctors for all to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'doctors.manage'))
  with check (private.user_has_hospital_permission(hospital_id, 'doctors.manage'));
create policy attenders_member_read on public.attenders for select to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'attenders.read'));
create policy attenders_admin_manage on public.attenders for all to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'attenders.manage'))
  with check (private.user_has_hospital_permission(hospital_id, 'attenders.manage'));

create policy patients_authorized_read on public.patients for select to authenticated
  using (private.can_access_patient(id, 'patients.read'));
create policy patients_authorized_insert on public.patients for insert to authenticated
  with check (private.user_has_hospital_permission(hospital_id, 'patients.create'));
create policy patients_authorized_update on public.patients for update to authenticated
  using (private.can_access_patient(id, 'patients.update'))
  with check (private.can_access_patient(id, 'patients.update'));
create policy patients_admin_delete on public.patients for delete to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'patients.delete'));

create policy vitals_patient_read on public.patient_vitals for select to authenticated
  using (private.can_access_patient(patient_id, 'vitals.read'));
create policy vitals_clinician_insert on public.patient_vitals for insert to authenticated
  with check (private.can_access_patient(patient_id, 'vitals.write'));
create policy requests_patient_read on public.patient_requests for select to authenticated
  using (private.can_access_patient(patient_id, 'requests.read'));
create policy requests_attender_create on public.patient_requests for insert to authenticated
  with check (
    private.can_access_patient(patient_id, 'requests.create')
    and created_by = (select auth.uid())
    and status = 'NEW'
    and acknowledged_at is null and acknowledged_by is null
    and resolved_at is null and resolved_by is null
  );
create policy requests_staff_manage on public.patient_requests for update to authenticated
  using (private.can_access_patient(patient_id, 'requests.manage'))
  with check (private.can_access_patient(patient_id, 'requests.manage'));

create policy alerts_patient_read on public.alerts for select to authenticated
  using (private.can_access_patient(patient_id, 'alerts.read'));
create policy alerts_clinician_create on public.alerts for insert to authenticated
  with check (private.can_access_patient(patient_id, 'alerts.manage'));
create policy alerts_clinician_manage on public.alerts for update to authenticated
  using (private.can_access_patient(patient_id, 'alerts.manage'))
  with check (private.can_access_patient(patient_id, 'alerts.manage'));

create policy medications_patient_read on public.medications for select to authenticated
  using (private.can_access_patient(patient_id, 'medications.read'));
create policy medications_clinician_create on public.medications for insert to authenticated
  with check (private.can_access_patient(patient_id, 'medications.manage'));
create policy medications_clinician_manage on public.medications for update to authenticated
  using (private.can_access_patient(patient_id, 'medications.manage'))
  with check (private.can_access_patient(patient_id, 'medications.manage'));

create policy reports_patient_read on public.medical_reports for select to authenticated
  using (private.can_access_patient(patient_id, 'reports.read'));
create policy reports_clinician_create on public.medical_reports for insert to authenticated
  with check (private.can_access_patient(patient_id, 'reports.manage'));
create policy reports_clinician_manage on public.medical_reports for update to authenticated
  using (private.can_access_patient(patient_id, 'reports.manage'))
  with check (private.can_access_patient(patient_id, 'reports.manage'));

create policy notes_clinician_read on public.doctor_notes for select to authenticated
  using (private.can_access_patient(patient_id, 'notes.read'));
create policy notes_clinician_create on public.doctor_notes for insert to authenticated
  with check (private.can_access_patient(patient_id, 'notes.manage'));
create policy notes_clinician_manage on public.doctor_notes for update to authenticated
  using (private.can_access_patient(patient_id, 'notes.manage'))
  with check (private.can_access_patient(patient_id, 'notes.manage'));

create policy timeline_patient_read on public.patient_timeline_events for select to authenticated
  using (private.can_access_patient(patient_id, 'timeline.read'));
create policy timeline_clinician_create on public.patient_timeline_events for insert to authenticated
  with check (private.can_access_patient(patient_id, 'timeline.manage'));
create policy timeline_clinician_manage on public.patient_timeline_events for update to authenticated
  using (private.can_access_patient(patient_id, 'timeline.manage'))
  with check (private.can_access_patient(patient_id, 'timeline.manage'));

create policy notifications_own_read on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.user_has_hospital_permission(hospital_id, 'notifications.read')
  );
create policy notifications_own_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and private.user_has_hospital_permission(hospital_id, 'notifications.read'))
  with check (user_id = (select auth.uid()) and private.user_has_hospital_permission(hospital_id, 'notifications.read'));

create policy devices_member_read on public.devices for select to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'devices.read'));
create policy devices_admin_manage on public.devices for all to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'devices.manage'))
  with check (private.user_has_hospital_permission(hospital_id, 'devices.manage'));
create policy assets_member_read on public.assets for select to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'assets.read'));
create policy assets_admin_manage on public.assets for all to authenticated
  using (private.user_has_hospital_permission(hospital_id, 'assets.manage'))
  with check (private.user_has_hospital_permission(hospital_id, 'assets.manage'));

create policy audit_log_authorized_read on public.audit_logs for select to authenticated
  using (hospital_id is not null and private.user_has_hospital_permission(hospital_id, 'audit.read'));
-- No client insert/update/delete grants or policies. Trusted server/service-role writes are append-only.

revoke all on function public.get_current_role() from public, anon, authenticated;
revoke all on function public.get_current_doctor_id() from public, anon, authenticated;
revoke all on function public.get_current_attender_patient_id() from public, anon, authenticated;

comment on table public.hospitals is 'Hospital tenant root. A hospital is not authorized by a URL or browser-supplied id.';
comment on table public.hospital_memberships is 'Trusted user-to-hospital membership, role and status mapping.';
comment on table public.hospital_role_permissions is 'Static role-to-capability map; roles and permissions remain separate.';
comment on table public.audit_logs is 'Server-generated append-only audit foundation. Patient reads require server/database read-path instrumentation.';
comment on table public.devices is 'Tenant-owned device inventory; device credential registration remains a separate integration task.';
comment on table public.assets is 'Tenant-owned physical asset inventory foundation.';
