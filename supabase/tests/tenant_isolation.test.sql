begin;

select plan(7);

-- Fixed synthetic identities make the checks repeatable in an isolated local Supabase database.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tenant-admin-a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'tenant-doctor-a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'tenant-attender-a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'tenant-admin-b@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'tenant-unlinked@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, name, email, role)
values
  ('10000000-0000-4000-8000-000000000002', 'Doctor A', 'tenant-doctor-a@test.invalid', 'doctor'),
  ('10000000-0000-4000-8000-000000000003', 'Attender A', 'tenant-attender-a@test.invalid', 'attender'),
  ('10000000-0000-4000-8000-000000000004', 'Doctor B', 'tenant-admin-b@test.invalid', 'doctor')
on conflict (id) do nothing;

insert into public.hospitals (id, name, slug, status)
values
  ('20000000-0000-4000-8000-000000000001', 'Tenant Test Hospital A', 'tenant-test-a', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'Tenant Test Hospital B', 'tenant-test-b', 'active')
on conflict (id) do nothing;

insert into public.hospital_memberships (hospital_id, user_id, role, status)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'doctor', 'active'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'attender', 'active'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'admin', 'active')
on conflict (hospital_id, user_id) do nothing;

insert into public.doctors (id, hospital_id, name, email, specialty, department)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Doctor A', 'doctor-a@test.invalid', 'General Medicine', 'Medicine'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Doctor B', 'doctor-b@test.invalid', 'General Medicine', 'Medicine')
on conflict (id) do nothing;

insert into public.attenders (id, hospital_id, name, email, phone)
values ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Attender A', 'attender-a@test.invalid', '+910000000001')
on conflict (id) do nothing;

update public.doctors set profile_id = '10000000-0000-4000-8000-000000000002' where id = '30000000-0000-4000-8000-000000000001';
update public.doctors set profile_id = '10000000-0000-4000-8000-000000000004' where id = '30000000-0000-4000-8000-000000000002';
update public.attenders set profile_id = '10000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000001';

insert into public.patients (id, hospital_id, mrn, name, age, gender, room, bed, primary_condition, department, assigned_doctor_id, assigned_attender_id)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'TENANT-A-1', 'Patient A', 50, 'Other', 'A-101', 'A', 'Test condition', 'Medicine', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'TENANT-B-1', 'Patient B', 50, 'Other', 'B-101', 'B', 'Test condition', 'Medicine', '30000000-0000-4000-8000-000000000002', null)
on conflict (id) do nothing;

insert into public.patient_vitals (patient_id, hospital_id, systolic_bp, diastolic_bp, pulse, spo2, temperature, status)
values ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 120, 80, 70, 98, 36.7, 'stable');

insert into public.patient_requests (patient_id, hospital_id, request_type, created_by)
values ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'NURSE', '10000000-0000-4000-8000-000000000004');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.patients where id = '50000000-0000-4000-8000-000000000001'), 1, 'Hospital A user reads Hospital A patient');
select is((select count(*)::integer from public.patients where id = '50000000-0000-4000-8000-000000000002'), 0, 'Hospital A user cannot read Hospital B patient');
update public.patients set name = 'Unauthorized change' where id = '50000000-0000-4000-8000-000000000002';
select is((select name from public.patients where id = '50000000-0000-4000-8000-000000000002'), null, 'Hospital A user cannot modify Hospital B patient');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.patient_vitals where hospital_id = '20000000-0000-4000-8000-000000000002'), 0, 'Hospital A doctor cannot access Hospital B vitals');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.patient_requests where hospital_id = '20000000-0000-4000-8000-000000000002'), 0, 'Hospital A attender cannot access Hospital B requests');

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$ select count(*) from public.patients $$, '42501', null, 'Unauthenticated user cannot read patient data');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select is((select count(*)::integer from public.patients), 0, 'Invalid membership cannot read hospital data');

select * from finish();
rollback;
