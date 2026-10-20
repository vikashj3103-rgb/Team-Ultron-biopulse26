import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { Doctor } from '../../types';
import { Stethoscope, UserPlus, CheckCircle2, Clock, Phone, Mail } from 'lucide-react';

export const DoctorsManagementPage: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [department, setDepartment] = useState('Cardiology');
  const [phone, setPhone] = useState('+91 98405 12345');

  useEffect(() => {
    const refresh = () => setDoctors(dataStore.getDoctors());
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  const handleToggleOnline = (id: string) => {
    dataStore.toggleDoctorOnline(id);
  };

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    dataStore.addDoctor({
      name,
      email,
      specialty,
      department,
      phone,
      isOnline: true,
    });

    setName('');
    setEmail('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Physician Staff Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage medical specialists, toggle on-call availability, and monitor active patient workloads.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Register Physician
        </button>
      </div>

      {/* Grid of Doctor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {doc.name.replace('Dr. ', '').charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {doc.specialty}
                  </span>
                </div>
              </div>

              {/* Online status toggle */}
              <button
                type="button"
                onClick={() => handleToggleOnline(doc.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  doc.isOnline
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
                title="Click to toggle availability"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    doc.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                {doc.isOnline ? 'Online' : 'Offline'}
              </button>
            </div>

            {/* Contact details */}
            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{doc.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{doc.phone}</span>
              </div>
            </div>

            {/* Active Patients Badge */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Assigned Inpatients:</span>
              <span className="font-extrabold text-slate-900 text-sm font-mono">
                {doc.activePatientCount} {doc.activePatientCount === 1 ? 'Patient' : 'Patients'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Register Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Register Clinical Specialist</h3>
            <form onSubmit={handleAddDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Menon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="doctor.neuro@careconnect.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medical Specialty</label>
                  <select
                    value={specialty}
                    onChange={(e) => {
                      setSpecialty(e.target.value);
                      setDepartment(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="General Surgery">General Surgery</option>
                    <option value="General Medicine">General Medicine</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold"
                >
                  Save Physician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
