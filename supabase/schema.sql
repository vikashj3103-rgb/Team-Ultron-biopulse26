-- ==============================================================================
-- CareConnect Database Schema & Row Level Security (RLS)
-- Hackathon Prototype & Production Ready
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'attender')),
  phone TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  bed_count INT DEFAULT 1,
  is_occupied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DOCTORS TABLE
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  specialty TEXT NOT NULL,
  department TEXT NOT NULL,
  phone TEXT,
  is_online BOOLEAN DEFAULT TRUE,
  active_patient_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATTENDERS TABLE
CREATE TABLE IF NOT EXISTS public.attenders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  relation TEXT DEFAULT 'Primary Caregiver',
  assigned_patient_id UUID,
  is_online BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PATIENTS TABLE
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mrn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group TEXT,
  room TEXT NOT NULL,
  bed TEXT NOT NULL,
  primary_condition TEXT NOT NULL,
  current_diagnosis TEXT,
  allergies TEXT[],
  care_instructions TEXT,
  department TEXT NOT NULL,
  admission_date TIMESTAMPTZ DEFAULT NOW(),
  discharge_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'stable' CHECK (status IN ('stable', 'attention', 'high', 'critical')),
  assigned_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  assigned_attender_id UUID REFERENCES public.attenders(id) ON DELETE SET NULL,
  hardware_device_id TEXT,
  last_vital_update TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key for attenders referencing patients
ALTER TABLE public.attenders 
  DROP CONSTRAINT IF EXISTS fk_attender_patient,
  ADD CONSTRAINT fk_attender_patient FOREIGN KEY (assigned_patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

-- 6. PATIENT VITALS LOG TABLE
CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  systolic_bp INT NOT NULL,
  diastolic_bp INT NOT NULL,
  pulse INT NOT NULL,
  spo2 INT NOT NULL,
  temperature NUMERIC(4, 1) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('stable', 'attention', 'high', 'critical')),
  bp_status TEXT DEFAULT 'stable',
  pulse_status TEXT DEFAULT 'stable',
  spo2_status TEXT DEFAULT 'stable',
  temp_status TEXT DEFAULT 'stable',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PATIENT HARDWARE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.patient_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('WATER', 'FOOD', 'MEDICINE', 'NURSE', 'EMERGENCY')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  notes TEXT
);

-- 8. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('attention', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  trigger TEXT NOT NULL,
  message TEXT NOT NULL,
  vital_type TEXT NOT NULL CHECK (vital_type IN ('BP', 'PULSE', 'SPO2', 'TEMP', 'GENERAL')),
  value_recorded TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  notes TEXT
);

-- 9. MEDICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  instructions TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Given', 'Missed')),
  prescribed_by TEXT NOT NULL,
  administered_at TIMESTAMPTZ,
  administered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MEDICAL REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.medical_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  uploaded_by TEXT NOT NULL,
  status TEXT DEFAULT 'Reviewed' CHECK (status IN ('Reviewed', 'Pending Review', 'Final')),
  summary TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. DOCTOR NOTES TABLE
CREATE TABLE IF NOT EXISTS public.doctor_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'Observation',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PATIENT TIMELINE EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.patient_timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT,
  severity TEXT DEFAULT 'normal'
);

-- 13. IN-APP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role TEXT,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  link TEXT
);

-- ==============================================================================
-- INDEXES FOR FREQUENTLY QUERIED FIELDS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor ON public.patients(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_attender ON public.patients(assigned_attender_id);
CREATE INDEX IF NOT EXISTS idx_patients_status ON public.patients(status);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_time ON public.patient_vitals(patient_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_patient_time ON public.patient_requests(patient_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_status ON public.alerts(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_timeline_patient_time ON public.patient_timeline_events(patient_id, timestamp DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_doctor_id()
RETURNS UUID AS $$
  SELECT id FROM public.doctors WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_attender_patient_id()
RETURNS UUID AS $$
  SELECT assigned_patient_id FROM public.attenders WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- --- PATIENTS POLICIES ---
-- Admin: full access
CREATE POLICY "Admin full access to patients"
ON public.patients FOR ALL
TO authenticated
USING (public.get_current_role() = 'admin');

-- Doctor: only assigned patients
CREATE POLICY "Doctor view assigned patients"
ON public.patients FOR SELECT
TO authenticated
USING (
  public.get_current_role() = 'doctor' 
  AND assigned_doctor_id = public.get_current_doctor_id()
);

-- Attender: only their assigned patient
CREATE POLICY "Attender view only assigned patient"
ON public.patients FOR SELECT
TO authenticated
USING (
  public.get_current_role() = 'attender' 
  AND id = public.get_current_attender_patient_id()
);

-- --- VITALS POLICIES ---
CREATE POLICY "Admin view all vitals" ON public.patient_vitals FOR ALL TO authenticated
USING (public.get_current_role() = 'admin');

CREATE POLICY "Doctor view assigned vitals" ON public.patient_vitals FOR ALL TO authenticated
USING (
  public.get_current_role() = 'doctor' 
  AND patient_id IN (SELECT id FROM public.patients WHERE assigned_doctor_id = public.get_current_doctor_id())
);

CREATE POLICY "Attender view assigned vitals" ON public.patient_vitals FOR SELECT TO authenticated
USING (
  public.get_current_role() = 'attender' 
  AND patient_id = public.get_current_attender_patient_id()
);

-- --- PATIENT REQUESTS POLICIES ---
CREATE POLICY "Admin requests access" ON public.patient_requests FOR ALL TO authenticated
USING (public.get_current_role() = 'admin');

CREATE POLICY "Doctor view requests" ON public.patient_requests FOR SELECT TO authenticated
USING (
  public.get_current_role() = 'doctor' 
  AND patient_id IN (SELECT id FROM public.patients WHERE assigned_doctor_id = public.get_current_doctor_id())
);

CREATE POLICY "Attender manage requests for their patient" ON public.patient_requests FOR ALL TO authenticated
USING (
  public.get_current_role() = 'attender' 
  AND patient_id = public.get_current_attender_patient_id()
);

-- --- ALERTS POLICIES ---
CREATE POLICY "Admin alerts access" ON public.alerts FOR ALL TO authenticated
USING (public.get_current_role() = 'admin');

CREATE POLICY "Doctor manage alerts" ON public.alerts FOR ALL TO authenticated
USING (
  public.get_current_role() = 'doctor' 
  AND patient_id IN (SELECT id FROM public.patients WHERE assigned_doctor_id = public.get_current_doctor_id())
);

CREATE POLICY "Attender view alerts" ON public.alerts FOR SELECT TO authenticated
USING (
  public.get_current_role() = 'attender' 
  AND patient_id = public.get_current_attender_patient_id()
);

-- --- REALTIME PUBLICATION ---
-- Enable Postgres Realtime on critical live tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'patient_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.patients,
      public.patient_requests, 
      public.patient_vitals, 
      public.alerts, 
      public.medications,
      public.medical_reports,
      public.doctor_notes,
      public.notifications, 
      public.patient_timeline_events;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
