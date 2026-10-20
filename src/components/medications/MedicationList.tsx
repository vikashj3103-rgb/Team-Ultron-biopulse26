import React, { useState } from 'react';
import { Medication } from '../../types';
import { Pill, CheckCircle, Clock, Plus, AlertCircle } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n';

interface MedicationListProps {
  patientId: string;
  medications: Medication[];
  isAttenderView?: boolean;
}

export const MedicationList: React.FC<MedicationListProps> = ({
  patientId,
  medications,
  isAttenderView = false,
}) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState<Medication['route']>('Oral');
  const [frequency, setFrequency] = useState('Once Daily');
  const [duration, setDuration] = useState('5 Days');
  const [scheduledTime, setScheduledTime] = useState('02:00 PM');
  const [instructions, setInstructions] = useState('');

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dosage) return;

    dataStore.addMedication({
      patientId,
      name,
      dosage,
      route,
      frequency,
      scheduledTime,
      instructions: instructions ? `${instructions} (Duration: ${duration})` : `Duration: ${duration}`,
      startDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      prescribedBy: currentUser ? currentUser.name : 'Attending Clinician',
    });

    setName('');
    setDosage('');
    setFrequency('Once Daily');
    setDuration('5 Days');
    setInstructions('');
    setShowAddForm(false);
  };

  const handleStatusChange = (medId: string, status: 'Pending' | 'Given' | 'Missed') => {
    const roleLabel = currentUser?.role === 'attender' ? 'Attender' : currentUser?.role === 'doctor' ? 'Doctor' : 'Nurse';
    const actor = currentUser ? `${currentUser.name} (${roleLabel})` : 'Vikash Kumar (Attender)';
    dataStore.updateMedicationStatus(medId, status, actor);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-600" />
            {t('medication.schedule')}
          </h3>
          <p className="text-xs text-slate-500">
            {isAttenderView
              ? t('medication.bedsideInstructions')
              : t('medication.activePrescriptions')}
          </p>
        </div>

        {!isAttenderView && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('medication.prescribe')}
          </button>
        )}
      </div>

      {/* Doctor Add Form */}
      {showAddForm && !isAttenderView && (
        <form onSubmit={handleAddMedication} className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-900">{t('medication.addInstruction')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.name')}</label>
              <input
                type="text"
                placeholder="e.g. Amlodipine"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.dosage')}</label>
              <input
                type="text"
                placeholder="e.g. 5 mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.route')}</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as Medication['route'])}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Oral">Oral</option>
                <option value="IV">IV</option>
                <option value="IM">IM</option>
                <option value="Sublingual">Sublingual</option>
                <option value="Inhalation">Inhalation</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.frequency')}</label>
              <input
                type="text"
                placeholder="e.g. Once Daily, BID, PRN"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.scheduledTime')}</label>
              <input
                type="text"
                placeholder="e.g. 02:00 PM"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.duration')}</label>
              <input
                type="text"
                placeholder="e.g. 5 Days, Inpatient"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">{t('medication.instructions')}</label>
            <input
              type="text"
              placeholder="e.g. Post-lunch with plenty of water"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              {t('medication.savePrescription')}
            </button>
          </div>
        </form>
      )}

      {/* Medication Items */}
      {medications.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          {t('medication.noActiveOrders')}
        </div>
      ) : (
        <div className="space-y-2.5">
          {medications.map((med) => {
            return (
              <div
                key={med.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{med.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {med.dosage} • {med.route}
                    </span>
                    {med.frequency && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {med.frequency}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{med.scheduledTime}</span> • {med.instructions}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>{t('medication.prescribedBy')}: <strong className="text-slate-700">{med.prescribedBy}</strong></span>
                    {med.status === 'Given' && med.administeredBy && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        {t('medication.administeredBy', { name: med.administeredBy })}
                        {med.administeredAt && ` ${t('medication.atTime', { time: new Date(med.administeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      med.status === 'Given'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : med.status === 'Missed'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {med.status === 'Given' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                    {med.status === 'Missed' && <AlertCircle className="w-3 h-3 text-red-600" />}
                    {med.status === 'Pending' && <Clock className="w-3 h-3 text-amber-600" />}
                    {med.status === 'Given' ? t('medication.statusGiven') : med.status === 'Missed' ? t('medication.statusMissed') : t('medication.statusPending')}
                  </span>

                  {med.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(med.id, 'Given')}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
                      title={t('medication.markAdministered')}
                    >
                      {t('medication.markGiven')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
        * {t('medication.prototypeDisclaimer')}
      </div>
    </div>
  );
};
