import React, { useState } from 'react';
import { MedicalReport } from '../../types';
import { FileText, Eye, Download, Calendar, User, Activity, FileSpreadsheet, Plus, CheckCircle2 } from 'lucide-react';
import { dataStore } from '../../services/dataStore';
import { useAuth } from '../../context/AuthContext';

interface MedicalReportsListProps {
  reports: MedicalReport[];
  patientId?: string;
  allowAdd?: boolean;
}

export const MedicalReportsList: React.FC<MedicalReportsListProps> = ({
  reports,
  patientId,
  allowAdd = false,
}) => {
  const { currentUser } = useAuth();
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState<MedicalReport['reportType']>('ECG');
  const [summary, setSummary] = useState('');
  const [uploadedBy, setUploadedBy] = useState(currentUser?.name || 'Dr. Arun Kumar');

  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !title.trim() || !summary.trim()) return;

    dataStore.addReport({
      patientId,
      title: title.trim(),
      reportType,
      date: new Date().toISOString().split('T')[0],
      uploadedBy: uploadedBy.trim() || 'Attending Physician',
      status: 'Reviewed',
      summary: summary.trim(),
      fileName: `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.pdf`,
    });

    setTitle('');
    setSummary('');
    setShowAddForm(false);
  };

  const getReportIcon = (type: MedicalReport['reportType']) => {
    switch (type) {
      case 'ECG':
        return <Activity className="w-4 h-4 text-rose-600" />;
      case 'Lab Test':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case 'Radiology':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'Echo':
        return <Activity className="w-4 h-4 text-cyan-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleDownloadDemo = (report: MedicalReport) => {
    const content = `HEALTHCONNECT HOSPITAL SYSTEM — CLINICAL REPORT
===========================================================
Patient ID: ${report.patientId}
Document: ${report.title}
Category: ${report.reportType}
Date Recorded: ${report.date}
Attending Clinician / Lab: ${report.uploadedBy}
Review Status: ${report.status}
Reference: ${report.fileName || 'verified_ehr_document'}
===========================================================
CLINICAL FINDINGS & SUMMARY:
${report.summary}
===========================================================
* NOTICE: This document is an electronic health record artifact generated 
  for HealthConnect Clinical Care Systems.`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.fileName ? report.fileName.replace('.pdf', '_record.txt') : 'clinical_report_record.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between mb-4 pb-2 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Diagnostic Reports & Records
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              DEMO RECORDS
            </span>
          </div>
          <p className="text-xs text-slate-500">Official clinical assessments, laboratory values and imaging summaries</p>
        </div>
        <div className="flex items-center gap-2">
          {allowAdd && patientId && (
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Report
            </button>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {reports.length} Records
          </span>
        </div>
      </div>

      {/* Add Report Form */}
      {showAddForm && (
        <form onSubmit={handleAddReport} className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">Add Clinical Diagnostic Report</h4>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
              Demo Simulation Intake
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Report Title</label>
              <input
                type="text"
                placeholder="e.g. 2D-Echocardiogram or Lipid Panel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as MedicalReport['reportType'])}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ECG">ECG</option>
                <option value="Lab Test">Lab Test</option>
                <option value="Radiology">Radiology</option>
                <option value="Echo">Echocardiogram</option>
                <option value="Discharge Summary">Discharge Summary</option>
                <option value="Vitals Assessment">Vitals Assessment</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Doctor / Diagnostic Lab</label>
              <input
                type="text"
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Clinical Findings Summary</label>
              <input
                type="text"
                placeholder="Key diagnostic findings and conclusion"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
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
              Save Report
            </button>
          </div>
        </form>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-8 px-4 text-xs text-slate-500">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No verified reports available yet.</p>
          <p className="text-slate-500 mt-1">
            Reports will appear here after they are available and reviewed by the clinical care team.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="p-1 rounded bg-white border border-slate-200 shadow-2xs">
                    {getReportIcon(report.reportType)}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{report.title}</h4>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {report.reportType}
                  </span>
                  {report.status === 'Reviewed' || report.status === 'Final' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified by clinical care team
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Awaiting clinical review
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    DEMO
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pl-7">
                  {report.summary}
                </p>

                <div className="flex items-center gap-4 text-[11px] text-slate-400 pl-7">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {report.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {report.uploadedBy}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blue-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDemo(report)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Download verified clinical demo record"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safe Interactive Report Preview Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {getReportIcon(selectedReport.reportType)}
                <h3 className="text-base font-bold text-slate-900">{selectedReport.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-slate-900">{selectedReport.reportType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Recorded Date</span>
                  <span className="font-semibold text-slate-900">{selectedReport.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Attending Author</span>
                  <span className="font-semibold text-slate-900">{selectedReport.uploadedBy}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">File Reference</span>
                  <span className="font-mono text-slate-700">{selectedReport.fileName || 'Verified Document'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Clinical Findings & Interpretations</h4>
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-slate-800 leading-relaxed font-sans">
                  {selectedReport.summary}
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800">
                🔒 Verified Hospital Electronic Health Record (EHR) Synthetic Document. Protected under HIPAA demo simulation standards.
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
