import React, { useState } from 'react';
import { DoctorNote } from '../../types';
import { FileText, Plus, Clock, UserCheck } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';

interface DoctorNotesListProps {
  patientId: string;
  notes: DoctorNote[];
  readOnly?: boolean;
}

export const DoctorNotesList: React.FC<DoctorNotesListProps> = ({
  patientId,
  notes,
  readOnly = false,
}) => {
  const { currentUser } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<DoctorNote['category']>('Observation');

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    dataStore.addNote({
      patientId,
      doctorId: currentUser?.id || 'doc-demo',
      doctorName: currentUser ? currentUser.name : 'Dr. Arun Kumar',
      content: content.trim(),
      category,
    });

    setContent('');
    setShowAddForm(false);
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Clinical Notes & Observations
          </h3>
          <p className="text-xs text-slate-500">Physician assessments and round observations</p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Note
          </button>
        )}
      </div>

      {/* Add Note Form */}
      {showAddForm && !readOnly && (
        <form onSubmit={handleAddNote} className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">New Clinical Note</h4>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DoctorNote['category'])}
              className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="Observation">Observation</option>
              <option value="Treatment Plan">Treatment Plan</option>
              <option value="Consultation">Consultation</option>
              <option value="Discharge Plan">Discharge Plan</option>
            </select>
          </div>

          <textarea
            rows={3}
            required
            placeholder="Record clinical assessment, medication changes, or instructions for nursing/caregiver staff..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          No physician notes logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{note.doctorName}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {note.category}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(note.timestamp)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
