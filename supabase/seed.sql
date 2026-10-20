-- ==============================================================================
-- CareConnect Synthetic Demo Data (Seed)
-- 100% Synthetic / De-identified for demonstration and judging
-- ==============================================================================

-- Demo Rooms
INSERT INTO public.rooms (room_number, department, bed_count, is_occupied) VALUES
('ICU-204', 'Cardiology', 1, true),
('ICU-205', 'Pulmonology', 1, true),
('SURG-102', 'Orthopedics', 2, true),
('NEURO-301', 'Neurology', 1, true),
('GEN-405', 'General Medicine', 2, false)
ON CONFLICT (room_number) DO NOTHING;

-- Demo Doctors
INSERT INTO public.doctors (id, name, email, specialty, department, phone, is_online, active_patient_count) VALUES
('d1111111-1111-1111-1111-111111111111', 'Dr. Arun Kumar', 'doctor.cardio@careconnect.demo', 'Cardiology', 'Cardiology', '+91 98401 23456', true, 2),
('d2222222-2222-2222-2222-222222222222', 'Dr. Priya Sharma', 'doctor.ortho@careconnect.demo', 'Orthopedics', 'Orthopedics', '+91 98402 34567', true, 1),
('d3333333-3333-3333-3333-333333333333', 'Dr. Rajesh Menon', 'doctor.neuro@careconnect.demo', 'Neurology', 'Neurology', '+91 98403 45678', true, 1),
('d4444444-4444-4444-4444-444444444444', 'Dr. Sneha Reddy', 'doctor.pulmo@careconnect.demo', 'Pulmonology', 'Pulmonology', '+91 98404 56789', false, 0)
ON CONFLICT (id) DO NOTHING;

-- Demo Attenders
INSERT INTO public.attenders (id, name, email, phone, relation, is_online) VALUES
('a1111111-1111-1111-1111-111111111111', 'Suresh Kumar', 'attender.suresh@careconnect.demo', '+91 97890 12345', 'Son', true),
('a2222222-2222-2222-2222-222222222222', 'Anita Devi', 'attender.anita@careconnect.demo', '+91 97890 23456', 'Spouse', true),
('a3333333-3333-3333-3333-333333333333', 'Karthik Raja', 'attender.karthik@careconnect.demo', '+91 97890 34567', 'Brother', true)
ON CONFLICT (id) DO NOTHING;

-- Demo Patients (3-5 with varied statuses: Stable, Attention, High, Critical)
INSERT INTO public.patients (
  id, mrn, name, age, gender, blood_group, room, bed, 
  primary_condition, department, status, 
  assigned_doctor_id, assigned_attender_id, 
  hardware_device_id, admission_date
) VALUES
(
  'p1111111-1111-1111-1111-111111111111', 'CC-2026-101', 'Ramesh Kumar', 62, 'Male', 'O+', 
  'ICU-204', 'Bed-A', 'Post-MI Cardiac Monitoring', 'Cardiology', 'critical',
  'd1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 
  'GLOVE-ESP32-DEV01', NOW() - INTERVAL '3 days'
),
(
  'p2222222-2222-2222-2222-222222222222', 'CC-2026-102', 'Meenakshi Sundaram', 48, 'Female', 'B+', 
  'SURG-102', 'Bed-1', 'Femur Fracture Post-Fixation', 'Orthopedics', 'stable',
  'd2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 
  'GLOVE-ESP32-DEV02', NOW() - INTERVAL '2 days'
),
(
  'p3333333-3333-3333-3333-333333333333', 'CC-2026-103', 'Vikramaditya Roy', 55, 'Male', 'A+', 
  'NEURO-301', 'Bed-A', 'Ischemic Stroke Rehabilitation', 'Neurology', 'attention',
  'd3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 
  'GLOVE-ESP32-DEV03', NOW() - INTERVAL '5 days'
),
(
  'p4444444-4444-4444-4444-444444444444', 'CC-2026-104', 'Lakshmi Narayanan', 71, 'Female', 'AB+', 
  'ICU-205', 'Bed-B', 'Acute COPD Exacerbation', 'Pulmonology', 'high',
  'd1111111-1111-1111-1111-111111111111', NULL, 
  'GLOVE-ESP32-DEV04', NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- Link attender assigned_patient_id
UPDATE public.attenders SET assigned_patient_id = 'p1111111-1111-1111-1111-111111111111' WHERE id = 'a1111111-1111-1111-1111-111111111111';
UPDATE public.attenders SET assigned_patient_id = 'p2222222-2222-2222-2222-222222222222' WHERE id = 'a2222222-2222-2222-2222-222222222222';
UPDATE public.attenders SET assigned_patient_id = 'p3333333-3333-3333-3333-333333333333' WHERE id = 'a3333333-3333-3333-3333-333333333333';
