import React, { useState } from 'react';
import { Patient, CallPriority } from '../../types';
import { dataStore } from '../../services/dataStore';
import { useLanguage } from '../../i18n';
import { PhoneCall, AlertTriangle, X, ShieldAlert, HeartPulse, CheckCircle2 } from 'lucide-react';

interface UrgentNurseCallModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
  callerName?: string;
  callerPhone?: string;
}

export const UrgentNurseCallModal: React.FC<UrgentNurseCallModalProps> = ({
  patient,
  isOpen,
  onClose,
  callerName,
  callerPhone,
}) => {
  const { t } = useLanguage();
  const [callCategory, setCallCategory] = useState<'ROUTINE' | 'EMERGENCY'>('ROUTINE');
  const [reason, setReason] = useState<string>('Need Nurse for Bedside Check');
  const [priority, setPriority] = useState<CallPriority>('NORMAL');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isAssigned, setIsAssigned] = useState(false);

  const handleClose = () => {
    setIsSubmitted(false);
    setIsAssigned(false);
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        setIsSubmitted(false);
        setIsAssigned(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectCategory = (cat: 'ROUTINE' | 'EMERGENCY') => {
    setCallCategory(cat);
    if (cat === 'EMERGENCY') {
      setPriority('CRITICAL');
      setReason('Breathing Distress / Choking');
    } else {
      setPriority('NORMAL');
      setReason('Need Nurse for Bedside Check');
    }
  };

  const handleDispatch = () => {
    const call = dataStore.createCallRequest({
      patientId: patient.id,
      patientName: patient.name,
      roomNumber: patient.room,
      bedNumber: patient.bed,
      attenderName: callerName || 'Family Attender',
      attenderPhone: callerPhone || '',
      reason,
      priority,
    });

    setIsAssigned(call.status === 'ASSIGNED');
    setIsSubmitted(true);
  };

  const routineChips = [
    'Water / Oral Fluids',
    'Toileting Assistance',
    'Repositioning in Bed',
    'Blanket / Linen',
    'Assistance Getting Up',
    'Infusion Concern / IV Check',
    'General Bedside Assistance',
  ];

  const emergencyChips = [
    'Breathing Difficulty',
    'Choking',
    'Cardiac Arrest / Severe Chest Pain',
    'Collapse / Unresponsiveness',
    'Severe Bleeding',
    'Unresponsiveness / Loss of Consciousness',
  ];

  const isEmergency = callCategory === 'EMERGENCY';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className={`clinical-modal-enter flex max-h-[calc(100dvh-0.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-white p-4 shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6 ${
          isEmergency ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nurse-call-modal-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isEmergency ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isEmergency ? <ShieldAlert className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="nurse-call-modal-title" className="text-lg font-bold text-slate-900">
                {isEmergency ? 'Critical emergency request' : t('call.modalTitle') || 'Call Duty Nurse'}
              </h3>
              <p className="text-xs text-slate-500">
                Room {patient.room} ({patient.bed}) • {patient.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close duty nurse call modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="flex-1 space-y-2 overflow-y-auto py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-slate-900">
              {isEmergency ? 'Emergency alert sent' : 'Assistance request sent'}
            </h4>
            <p className="text-xs text-slate-600">
              {isEmergency
                ? `The emergency request for Room ${patient.room} is visible to hospital dispatch. If there is immediate danger, alert nearby clinical staff as well.`
                : `The request for Room ${patient.room} is visible to hospital dispatch. ${isAssigned ? 'A hospital team member has been assigned.' : 'It is waiting for a team member to accept.'} Follow progress in Requests.`}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 min-h-11 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3">
              {/* Strict Category Switch: Routine Bedside vs Life-Threatening Emergency */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Request Category:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('ROUTINE')}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                      !isEmergency
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                    <span>Routine Assistance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectCategory('EMERGENCY')}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                      isEmergency
                        ? 'border-red-600 bg-red-50 text-red-900 shadow-xs ring-2 ring-red-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <HeartPulse className="w-4 h-4 text-red-600" />
                    <span>Emergency (Critical)</span>
                  </button>
                </div>
              </div>

              {/* Category Explanation Banner */}
              {isEmergency ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-red-900">Life-threatening emergency</p>
                    <p className="text-[11px] text-red-800">
                      Use only for choking, cardiac arrest, collapse, or severe distress. This request is sent with <strong>Critical</strong> priority to hospital dispatch.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
                  <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-blue-900">Bedside Care Assistance</p>
                    <p className="text-[11px] text-blue-800">
                      Send a request to hospital dispatch for comfort, hydration, toileting, or line checks.
                    </p>
                  </div>
                </div>
              )}

              {/* Priority Selector (Adjustable only in Routine mode; locked to CRITICAL in emergency) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Urgency Level:</label>
                  {isEmergency && (
                    <span className="text-[11px] font-bold text-red-700">Locked to Critical for Emergencies</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'URGENT', 'CRITICAL'] as CallPriority[]).map((pri) => (
                    <button
                      key={pri}
                      type="button"
                      disabled={isEmergency && pri !== 'CRITICAL'}
                      onClick={() => setPriority(pri)}
                      aria-pressed={priority === pri}
                      className={`min-h-11 rounded-lg border px-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        priority === pri
                          ? pri === 'CRITICAL'
                            ? 'border-red-700 bg-red-700 text-white'
                            : pri === 'URGENT'
                            ? 'border-amber-700 bg-amber-700 text-white'
                            : 'border-slate-800 bg-slate-800 text-white'
                          : isEmergency
                          ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pri}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Reason Chips */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  {isEmergency ? 'Select Emergency Symptom:' : 'Select Assistance Reason:'}
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(isEmergency ? emergencyChips : routineChips).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setReason(chip)}
                      aria-pressed={reason === chip}
                      className={`flex min-h-11 items-center rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                        reason === chip
                          ? isEmergency
                            ? 'border-red-600 bg-red-50 text-red-950 font-bold shadow-xs'
                            : 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isEmergency
                      ? 'Describe patient symptoms or emergency condition...'
                      : t('call.reasonPlaceholder') || 'Enter specific instructions or patient needs...'
                  }
                  rows={2}
                  className="mt-2 min-h-16 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white pt-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-11 rounded-lg px-4 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDispatch}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-xs font-bold text-white transition-colors sm:w-auto ${
                  isEmergency ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {isEmergency ? <ShieldAlert className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                {isEmergency ? 'DISPATCH EMERGENCY ALERT NOW' : t('call.dispatchButton') || 'Call nurse now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
