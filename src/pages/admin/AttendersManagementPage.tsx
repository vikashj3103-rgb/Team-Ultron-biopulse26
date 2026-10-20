import React, { useState, useEffect } from 'react';
import { dataStore } from '../../services/dataStore';
import { Attender, Patient } from '../../types';
import { HeartHandshake, UserPlus, Phone, Mail, Link as LinkIcon, Unlink } from 'lucide-react';

export const AttendersManagementPage: React.FC = () => {
  const [attenders, setAttenders] = useState<Attender[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 97890 45678');
  const [relation, setRelation] = useState('Primary Caregiver');
  const [assignedPatientId, setAssignedPatientId] = useState('');

  useEffect(() => {
    const refresh = () => {
      setAttenders(dataStore.getAttenders());
      setPatients(dataStore.getPatients());
    };
    refresh();
    return dataStore.subscribe(refresh);
  }, []);

  const handleAddAttender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    dataStore.addAttender({
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@careconnect.demo`,
      phone,
      relation,
      assignedPatientId: assignedPatientId || undefined,
      isOnline: true,
    });

    if (assignedPatientId) {
      dataStore.assignAttender(assignedPatientId, attenders[attenders.length - 1]?.id || 'new');
    }

    setName('');
    setEmail('');
    setShowAddModal(false);
  };

  const handlePatientReassign = (attenderId: string, newPatientId: string) => {
    if (!newPatientId) {
      // Unlink
      const att = attenders.find((a) => a.id === attenderId);
      if (att && att.assignedPatientId) {
        const p = dataStore.getPatientById(att.assignedPatientId);
        if (p) {
          dataStore.updatePatient(p.id, {
            assignedAttenderId: undefined,
            assignedAttenderName: undefined,
          });
        }
        att.assignedPatientId = undefined;
      }
      return;
    }

    dataStore.assignAttender(newPatientId, attenderId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Caregiver / Attender Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register bedside caregivers and strictly pair accounts to individual inpatients.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Register Bedside Attender
        </button>
      </div>

      {/* Attenders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attenders.map((att) => {
          const linkedPatient = patients.find((p) => p.id === att.assignedPatientId);

          return (
            <div
              key={att.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    {att.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{att.name}</h3>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {att.relation}
                    </span>
                  </div>
                </div>

                {att.status === 'revoked' ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    Revoked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active
                  </span>
                )}
              </div>

              {/* Contact & ID info */}
              <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">User ID:</span>
                  <span className="font-mono font-bold text-slate-800">{att.userId || att.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{att.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{att.email}</span>
                </div>
              </div>

              {/* Linked Inpatient Scoping Box */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Linked Inpatient:</span>
                  {linkedPatient ? (
                    <span className="font-bold text-slate-900">
                      {linkedPatient.name} ({linkedPatient.room})
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </div>

                {/* Change assigned patient dropdown */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Reassign Patient Channel:
                  </label>
                  <select
                    value={att.assignedPatientId || ''}
                    onChange={(e) => handlePatientReassign(att.id, e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">No Inpatient Linked</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.room} • {p.primaryCondition})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Attender Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Register Caregiver Account</h3>
            <form onSubmit={handleAddAttender} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikash Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Relation to Patient</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="e.g. Grandson, Daughter, Wife"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="attender.vikash@careconnect.demo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pair with Inpatient</label>
                <select
                  value={assignedPatientId}
                  onChange={(e) => setAssignedPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Select Inpatient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.room} • {p.primaryCondition})
                    </option>
                  ))}
                </select>
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
                  Create Attender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
