import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataStore } from '../../services/dataStore';
import { recommendSpecialtyAndDoctor } from '../../services/assignmentEngine';
import { Patient, Doctor, Attender, VitalStatus } from '../../types';
import { StatusBadge } from '../../components/common/Badge';
import { 
  UserPlus, BedDouble, Stethoscope, UserCheck, 
  Trash2, Edit3, CheckCircle2, ArrowRight, Sparkles, AlertCircle,
  Search, Copy, Check, Users, Lock, ShieldCheck, HeartHandshake, Key, SlidersHorizontal, X
} from 'lucide-react';
import { AttenderProvisionInput } from '../../types';

interface CensusFilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel: string;
}

const CensusFilterSelect: React.FC<CensusFilterSelectProps> = ({ label, value, options, onChange, allLabel }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      <option value="all">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

export const PatientsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [attenders, setAttenders] = useState<Attender[]>([]);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [bedFilter, setBedFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VitalStatus>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Admission Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(55);
  const [gender, setGender] = useState<Patient['gender']>('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [room, setRoom] = useState('ICU-206');
  const [bed, setBed] = useState('Bed-A');
  const [department, setDepartment] = useState('Cardiology');
  const [primaryCondition, setPrimaryCondition] = useState('Post-MI Cardiac Monitoring');
  const [hardwareDeviceId, setHardwareDeviceId] = useState('GLOVE-ESP32-DEV05');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Initial vital simulation defaults
  const [initSys, setInitSys] = useState(124);
  const [initDia, setInitDia] = useState(82);
  const [initPulse, setInitPulse] = useState(76);
  const [initSpO2, setInitSpO2] = useState(98);
  const [initTemp, setInitTemp] = useState(36.8);

  // Dynamic Family Attender Provisioning State
  const [assignAttender, setAssignAttender] = useState<boolean>(false);
  const [attenderCount, setAttenderCount] = useState<1 | 2>(1);

  // Attender 1 Form
  const [attender1Name, setAttender1Name] = useState('');
  const [attender1Relation, setAttender1Relation] = useState('Grandson');
  const [attender1Phone, setAttender1Phone] = useState('+91 98765 10001');
  const [attender1UserId, setAttender1UserId] = useState('');
  const [attender1TempPass, setAttender1TempPass] = useState('Care@2026');

  // Attender 2 Form
  const [attender2Name, setAttender2Name] = useState('');
  const [attender2Relation, setAttender2Relation] = useState('Daughter');
  const [attender2Phone, setAttender2Phone] = useState('+91 98765 10002');
  const [attender2UserId, setAttender2UserId] = useState('');
  const [attender2TempPass, setAttender2TempPass] = useState('Care@2026');

  // Admission Confirmation Modal
  const [admissionConfirmation, setAdmissionConfirmation] = useState<{
    patient: Patient;
    createdAttenders: Attender[];
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setPatients(dataStore.getPatients());
      setDoctors(dataStore.getDoctors());
      setAttenders(dataStore.getAttenders());
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  const roomOptions = [...new Set(patients.map((patient) => patient.currentLocation?.room || patient.room))].sort();
  const bedOptions = [...new Set(patients.map((patient) => patient.currentLocation?.bed || patient.bed))].sort();
  const departmentOptions = [...new Set(patients.map((patient) => patient.department).filter(Boolean))].sort();
  const doctorOptions = [...new Set(patients.map((patient) => patient.assignedDoctorName || 'Unassigned'))].sort();
  const hasActiveFilters = Boolean(searchQuery || roomFilter !== 'all' || bedFilter !== 'all' || departmentFilter !== 'all' || doctorFilter !== 'all' || statusFilter !== 'all');

  const clearFilters = () => {
    setSearchQuery('');
    setRoomFilter('all');
    setBedFilter('all');
    setDepartmentFilter('all');
    setDoctorFilter('all');
    setStatusFilter('all');
  };

  // Filtered patients for the census controls; all source records remain in the data store.
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const roomValue = p.currentLocation?.room || p.room;
    const bedValue = p.currentLocation?.bed || p.bed;
    const doctorValue = p.assignedDoctorName || 'Unassigned';
    const matchesQuery = !q || [p.name, p.mrn, roomValue, bedValue, p.department, doctorValue]
      .some((value) => value?.toLowerCase().includes(q));
    return matchesQuery
      && (roomFilter === 'all' || roomValue === roomFilter)
      && (bedFilter === 'all' || bedValue === bedFilter)
      && (departmentFilter === 'all' || p.department === departmentFilter)
      && (doctorFilter === 'all' || doctorValue === doctorFilter)
      && (statusFilter === 'all' || p.status === statusFilter);
  });

  // Compute rule-based specialty recommendation live based on selected condition and department
  const recommendation = recommendSpecialtyAndDoctor(primaryCondition, department, doctors);

  // Auto-fill recommended doctor if no manual selection yet
  useEffect(() => {
    if (recommendation.recommendedDoctor && !selectedDoctorId) {
      setSelectedDoctorId(recommendation.recommendedDoctor.id);
    }
  }, [recommendation, selectedDoctorId]);

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !primaryCondition || !room) return;

    const chosenDoctor = doctors.find((d) => d.id === selectedDoctorId);

    const attendersToProvision: AttenderProvisionInput[] = [];
    if (assignAttender) {
      if (attender1Name.trim()) {
        const fallbackId = attender1UserId.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${attender1Relation.toLowerCase()}`;
        attendersToProvision.push({
          name: attender1Name.trim(),
          relation: attender1Relation.trim(),
          phone: attender1Phone.trim(),
          userId: fallbackId,
          temporaryPassword: attender1TempPass.trim() || 'Care@2026',
        });
      }

      if (attenderCount === 2 && attender2Name.trim()) {
        const fallbackId2 = attender2UserId.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${attender2Relation.toLowerCase()}_2`;
        attendersToProvision.push({
          name: attender2Name.trim(),
          relation: attender2Relation.trim(),
          phone: attender2Phone.trim(),
          userId: fallbackId2,
          temporaryPassword: attender2TempPass.trim() || 'Care@2026',
        });
      }
    }

    const result = dataStore.addPatientWithDynamicAttenders(
      {
        name,
        age: Number(age),
        gender,
        bloodGroup,
        room,
        bed,
        primaryCondition,
        department: department || recommendation.department,
        admissionDate: new Date().toISOString(),
        assignedDoctorId: chosenDoctor?.id,
        assignedDoctorName: chosenDoctor?.name,
        assignedDoctorSpecialty: chosenDoctor?.specialty,
        hardwareDeviceId,
        notes,
        initialVitals: {
          systolicBP: initSys,
          diastolicBP: initDia,
          pulse: initPulse,
          spO2: initSpO2,
          temperature: initTemp,
        },
      },
      attendersToProvision
    );

    // Show Confirmation Modal with generated account details
    setAdmissionConfirmation(result);
    setShowAdmitModal(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setAge(55);
    setPrimaryCondition('Post-MI Cardiac Monitoring');
    setDepartment('Cardiology');
    setSelectedDoctorId('');
    setNotes('');
    setAssignAttender(false);
    setAttenderCount(1);
    setAttender1Name('');
    setAttender1Relation('Grandson');
    setAttender1Phone('+91 98765 10001');
    setAttender1UserId('');
    setAttender1TempPass('Care@2026');
    setAttender2Name('');
    setAttender2Relation('Daughter');
    setAttender2Phone('+91 98765 10002');
    setAttender2UserId('');
    setAttender2TempPass('Care@2026');
  };

  const handleDischarge = (id: string, patientName: string) => {
    if (confirm(`Confirm discharge of patient ${patientName}? This will archive bedside monitoring and release caregiver pairing.`)) {
      dataStore.dischargePatient(id);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    dataStore.updatePatient(editingPatient.id, {
      room: editingPatient.room,
      bed: editingPatient.bed,
      primaryCondition: editingPatient.primaryCondition,
      notes: editingPatient.notes,
    });
    setEditingPatient(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Patient Inpatient Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Admit new patients, configure rule-based doctor assignments, and track active room/bed allocations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAdmitModal(true);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Admit New Inpatient
        </button>
      </div>

      {/* Patient Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Admitted Patients Directory</h3>
            <p className="text-xs text-slate-600">Patient records, care-team assignments, and bedside device-link status</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search patients by name or MRN"
                placeholder="Search patient or MRN"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 py-2 pl-8 pr-11 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear patient search"
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="census-filters"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
            </button>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {filteredPatients.length} of {patients.length} patients
            </span>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div id="census-filters" className={`grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 md:grid-cols-3 xl:grid-cols-6 ${filtersOpen ? '' : 'hidden md:grid'}`}>
          <CensusFilterSelect label="Room" value={roomFilter} options={roomOptions} onChange={setRoomFilter} allLabel="All rooms" />
          <CensusFilterSelect label="Bed" value={bedFilter} options={bedOptions} onChange={setBedFilter} allLabel="All beds" />
          <CensusFilterSelect label="Department" value={departmentFilter} options={departmentOptions} onChange={setDepartmentFilter} allLabel="All departments" />
          <CensusFilterSelect label="Doctor" value={doctorFilter} options={doctorOptions} onChange={setDoctorFilter} allLabel="All doctors" />
          <CensusFilterSelect label="Clinical status" value={statusFilter} options={['stable', 'attention', 'high', 'critical']} onChange={(value) => setStatusFilter(value as 'all' | VitalStatus)} allLabel="All statuses" />
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
              <tr>
                <th className="p-3.5">Patient / MRN</th>
                <th className="p-3.5">Room & Bed</th>
                <th className="p-3.5">Condition / Dept</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Assigned Doctor</th>
                <th className="p-3.5">Attender(s)</th>
                <th className="p-3.5">Device ID</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{p.mrn} • {p.age}y {p.gender}</div>
                  </td>

                  <td className="p-3.5 font-medium text-slate-800">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">
                      {p.room} • {p.bed}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-slate-800">{p.primaryCondition}</div>
                    <div className="text-[11px] text-slate-400">{p.department}</div>
                  </td>

                  <td className="p-3.5">
                    <StatusBadge status={p.status} size="sm" />
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-slate-900">{p.assignedDoctorName || 'Unassigned'}</div>
                    <div className="text-[11px] text-blue-700">{p.assignedDoctorSpecialty}</div>
                  </td>

                  <td className="p-3.5 text-slate-700">
                    {p.assignedAttenders && p.assignedAttenders.filter((a) => a.status === 'active').length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {p.assignedAttenders
                          .filter((a) => a.status === 'active')
                          .map((att) => (
                            <div key={att.id} className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">{att.attenderName}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                                {att.relation}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : p.assignedAttenderName ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{p.assignedAttenderName}</span>
                        {p.assignedAttenderRelation && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                            {p.assignedAttenderRelation}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </td>

                  <td className="p-3.5 font-mono text-blue-700 font-semibold">
                    {p.hardwareDeviceId || 'Not linked'}
                  </td>

                  <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/doctor/patients/${p.id}`)}
                      aria-label={`Open clinical record for ${p.name}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                      title="Open Telemetry View"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPatient(p)}
                      aria-label={`Edit room and bed for ${p.name}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700"
                      title="Edit Room/Bed"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDischarge(p.id, p.name)}
                      aria-label={`Discharge ${p.name}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
                      title="Discharge Patient"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-slate-600">
                    {hasActiveFilters ? 'No patients match these filters.' : 'No patient records are available.'}
                    {hasActiveFilters && <button type="button" onClick={clearFilters} className="ml-2 min-h-11 px-2 font-semibold text-blue-800">Clear filters</button>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 xl:hidden sm:p-4">
          {filteredPatients.map((p) => {
            const activeAttenders = p.assignedAttenders?.filter((att) => att.status === 'active') ?? [];
            const location = p.currentLocation;
            return (
              <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-panel)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-base font-semibold text-slate-950">{p.name}</h4>
                    <p className="mt-0.5 text-xs text-slate-600">
                      <span className="font-mono">{p.mrn}</span> · {p.age}y · {p.gender}
                    </p>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Room · Bed</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">{location?.room || p.room} · {location?.bed || p.bed}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Department</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">{p.department || 'Not assigned'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Condition</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-900">{p.primaryCondition}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Attending physician</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">{p.assignedDoctorName || 'Unassigned'}</dd>
                    {p.assignedDoctorSpecialty && <dd className="text-xs text-slate-600">{p.assignedDoctorSpecialty}</dd>}
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Family attender{activeAttenders.length === 1 ? '' : 's'}</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-900">
                      {activeAttenders.length > 0
                        ? activeAttenders.map((att) => `${att.attenderName} (${att.relation})`).join(', ')
                        : p.assignedAttenderName
                          ? `${p.assignedAttenderName}${p.assignedAttenderRelation ? ` (${p.assignedAttenderRelation})` : ''}`
                          : 'None assigned'}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Bedside device</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{p.hardwareDeviceId || 'Not linked'}</dd>
                  </div>
                </dl>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/patients/${p.id}`)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPatient(p)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Room/bed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDischarge(p.id, p.name)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Discharge
                  </button>
                </div>
              </article>
            );
          })}
          {filteredPatients.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">{hasActiveFilters ? 'No matching patients' : 'No patient records'}</p>
              <p className="mt-1 text-sm text-slate-600">{hasActiveFilters ? 'Change or clear the active census filters.' : 'Patient records will appear here when available.'}</p>
              {hasActiveFilters && <button type="button" onClick={clearFilters} className="mt-2 min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Clear filters</button>}
            </div>
          )}
        </div>
      </div>

      {/* ADMIT PATIENT MODAL WITH RULE-BASED SPECIALTY RECOMMENDATION */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Inpatient Clinical Admission</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmitModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdmitSubmit} className="space-y-4 text-xs">
              {/* Patient Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Patient['gender'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                  <input
                    type="text"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room</label>
                  <input
                    type="text"
                    required
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bed</label>
                  <input
                    type="text"
                    required
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Condition & Department Trigger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Condition / Diagnosis</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Heart attack, Femur Fracture, Stroke"
                    value={primaryCondition}
                    onChange={(e) => setPrimaryCondition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="General Surgery">General Surgery</option>
                  </select>
                </div>
              </div>

              {/* RULE-BASED SPECIALTY RECOMMENDATION BOX */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Rule-Based Specialty Assignment Engine</span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  {recommendation.rationale}
                </p>
                {recommendation.recommendedDoctor && (
                  <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-blue-200">
                    <span className="font-semibold text-slate-900">
                      Recommended: {recommendation.recommendedDoctor.name} ({recommendation.matchedSpecialty})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDoctorId(recommendation.recommendedDoctor!.id)}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold"
                    >
                      Apply Recommendation
                    </button>
                  </div>
                )}
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attending Physician (Override Allowed)</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty}) • {d.activePatientCount} active
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Bedside Attender Account Provisioning */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <HeartHandshake className="w-4 h-4 text-emerald-600" />
                      <span>Assign Family Attender(s)?</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Provision secure inpatient portal access for the patient's family caregivers.
                    </p>
                  </div>

                  {/* [No] [Yes] Toggle */}
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => setAssignAttender(false)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        !assignAttender
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignAttender(true)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        assignAttender
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {assignAttender && (
                  <div className="space-y-4 pt-2 border-t border-slate-200">
                    {/* Attender Count Selection: [1] [2] */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">How many family attenders?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAttenderCount(1)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            attenderCount === 1
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          1 Attender
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttenderCount(2)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            attenderCount === 2
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          2 Attenders
                        </button>
                      </div>
                    </div>

                    {/* Attender 1 Form Card */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] flex items-center justify-center font-bold">1</span>
                          <span>Primary Family Attender</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Bedside Caregiver
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Full Name *</label>
                          <input
                            type="text"
                            required={assignAttender}
                            placeholder="e.g. Ramesh Kumar Jr."
                            value={attender1Name}
                            onChange={(e) => {
                              setAttender1Name(e.target.value);
                              if (!attender1UserId) {
                                const slug = (e.target.value || name).toLowerCase().replace(/[^a-z0-9]/g, '');
                                setAttender1UserId(`${slug || 'attender'}_${attender1Relation.toLowerCase()}`);
                              }
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Relationship to Patient</label>
                          <select
                            value={attender1Relation}
                            onChange={(e) => setAttender1Relation(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="Grandson">Grandson</option>
                            <option value="Daughter">Daughter</option>
                            <option value="Son">Son</option>
                            <option value="Spouse">Spouse / Partner</option>
                            <option value="Mother">Mother</option>
                            <option value="Father">Father</option>
                            <option value="Brother">Brother</option>
                            <option value="Sister">Sister</option>
                            <option value="Guardian">Legal Guardian</option>
                            <option value="Other">Other Relative</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Phone Number</label>
                          <input
                            type="tel"
                            placeholder="+91 98765 10001"
                            value={attender1Phone}
                            onChange={(e) => setAttender1Phone(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Login User ID</label>
                          <input
                            type="text"
                            placeholder="e.g. ramesh_grandson"
                            value={attender1UserId}
                            onChange={(e) => setAttender1UserId(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-blue-700"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">
                            Initial Temporary Password
                            <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Password change forced on 1st login)</span>
                          </label>
                          <input
                            type="text"
                            value={attender1TempPass}
                            onChange={(e) => setAttender1TempPass(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Attender 2 Form Card (Optional 2nd Attender) */}
                    {attenderCount === 2 && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] flex items-center justify-center font-bold">2</span>
                            <span>Secondary Family Attender</span>
                          </div>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            Secondary Contact
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Full Name *</label>
                            <input
                              type="text"
                              required={assignAttender && attenderCount === 2}
                              placeholder="e.g. Anitha Kumar"
                              value={attender2Name}
                              onChange={(e) => {
                                setAttender2Name(e.target.value);
                                if (!attender2UserId) {
                                  const slug = (e.target.value || name).toLowerCase().replace(/[^a-z0-9]/g, '');
                                  setAttender2UserId(`${slug || 'attender'}_${attender2Relation.toLowerCase()}_2`);
                                }
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Relationship to Patient</label>
                            <select
                              value={attender2Relation}
                              onChange={(e) => setAttender2Relation(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            >
                              <option value="Daughter">Daughter</option>
                              <option value="Grandson">Grandson</option>
                              <option value="Son">Son</option>
                              <option value="Spouse">Spouse / Partner</option>
                              <option value="Mother">Mother</option>
                              <option value="Father">Father</option>
                              <option value="Brother">Brother</option>
                              <option value="Sister">Sister</option>
                              <option value="Guardian">Legal Guardian</option>
                              <option value="Other">Other Relative</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Phone Number</label>
                            <input
                              type="tel"
                              placeholder="+91 98765 10002"
                              value={attender2Phone}
                              onChange={(e) => setAttender2Phone(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">Login User ID</label>
                            <input
                              type="text"
                              placeholder="e.g. anitha_daughter"
                              value={attender2UserId}
                              onChange={(e) => setAttender2UserId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-blue-700"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">
                              Initial Temporary Password
                              <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Password change forced on 1st login)</span>
                            </label>
                            <input
                              type="text"
                              value={attender2TempPass}
                              onChange={(e) => setAttender2TempPass(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hardware Glove ID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Smart Glove Hardware Unit ID</label>
                <input
                  type="text"
                  value={hardwareDeviceId}
                  onChange={(e) => setHardwareDeviceId(e.target.value)}
                  placeholder="e.g. GLOVE-ESP32-DEV05"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-blue-700"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-xs"
                >
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PATIENT MODAL */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Edit Room / Bed Allocation</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Patient Name</label>
                <input
                  type="text"
                  disabled
                  value={editingPatient.name}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room</label>
                  <input
                    type="text"
                    required
                    value={editingPatient.room}
                    onChange={(e) => setEditingPatient({ ...editingPatient, room: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bed</label>
                  <input
                    type="text"
                    required
                    value={editingPatient.bed}
                    onChange={(e) => setEditingPatient({ ...editingPatient, bed: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Condition</label>
                <input
                  type="text"
                  required
                  value={editingPatient.primaryCondition}
                  onChange={(e) => setEditingPatient({ ...editingPatient, primaryCondition: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMISSION CONFIRMATION MODAL WITH ATTENDER PROVISIONING CREDENTIALS */}
      {admissionConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Inpatient Clinical Admission Confirmed</h3>
                <p className="text-xs text-slate-500">Record created and telemetry initialized successfully</p>
              </div>
            </div>

            {/* Patient Summary Pill */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">{admissionConfirmation.patient.name}</span>
                <span className="font-mono text-[11px] text-blue-700 font-semibold">{admissionConfirmation.patient.mrn}</span>
              </div>
              <div className="text-slate-600">
                Room {admissionConfirmation.patient.room} • {admissionConfirmation.patient.bed} • {admissionConfirmation.patient.department}
              </div>
              <div className="text-slate-500 text-[11px]">
                Attending Physician: <strong className="text-slate-700">{admissionConfirmation.patient.assignedDoctorName}</strong>
              </div>
            </div>

            {/* Attender Credentials Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                  Provisioned Family Attender Accounts ({admissionConfirmation.createdAttenders.length})
                </h4>
              </div>

              {admissionConfirmation.createdAttenders.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 italic text-center">
                  No family attender accounts were requested for this patient.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {admissionConfirmation.createdAttenders.map((att, idx) => (
                    <div key={att.id} className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900">{att.name}</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            {att.relation}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">{att.phone}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-emerald-100 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-sans font-semibold">Login User ID</span>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="font-bold text-slate-900">{att.userId || att.id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(att.userId || att.id);
                                setCopiedId(att.userId || att.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-0.5"
                              title="Copy User ID"
                            >
                              {copiedId === (att.userId || att.id) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-sans font-semibold">Temp Password</span>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="font-bold text-emerald-700">{att.temporaryPassword || 'Care@2026'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(att.temporaryPassword || 'Care@2026');
                                setCopiedId(`pwd_${att.id}`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-0.5"
                              title="Copy Password"
                            >
                              {copiedId === `pwd_${att.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Warning Banner */}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Important:</strong> Provide these initial temporary credentials to the family caregiver(s). Upon their first login, they will be strictly required to establish a secure permanent password.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAdmissionConfirmation(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
