import React, { useEffect, useState } from 'react';
import api from '../utils/api';

// Manage corrected exam papers for one mark entry — approved 04 Nov 2026
// (Lakshminadh Prabhu's grievance-handling plan). Used by both the teacher
// and admin marks-history pages (apiBase picks '/teacher' or '/admin').
// Students never see this component.

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CorrectedPapersModal({ mark, apiBase, onClose, onMarkUpdated }) {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Add-files form
  const [addPicked, setAddPicked] = useState(null);

  // Grievance "replace" form
  const [showReplace, setShowReplace] = useState(false);
  const [replacePicked, setReplacePicked] = useState(null);
  const [newScore, setNewScore] = useState(mark.scored_marks ?? '');

  function load() {
    api.get(`${apiBase}/corrected-papers/mark/${mark.id}`)
      .then(r => setFiles(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load files'));
  }
  useEffect(() => { load(); }, [mark.id]);

  async function handleDownload(f) {
    setError('');
    try {
      const r = await api.get(`${apiBase}/corrected-papers/${f.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError('Download failed'); }
  }

  async function handleDelete(f) {
    if (!window.confirm(`Remove "${f.file_name}"?`)) return;
    setError('');
    try {
      await api.delete(`${apiBase}/corrected-papers/${f.id}`);
      setFiles(prev => prev.filter(x => x.id !== f.id));
    } catch (e) { setError(e.response?.data?.error || 'Delete failed'); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addPicked?.length) return;
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('mark_id', mark.id);
      for (const f of addPicked) form.append('files', f);
      await api.post(`${apiBase}/corrected-papers`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAddPicked(null);
      load();
    } catch (e) { setError(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleReplace(e) {
    e.preventDefault();
    if (!replacePicked?.length) { setError('Pick at least one file to replace with.'); return; }
    if (newScore === '' || isNaN(Number(newScore)) || Number(newScore) < 0 || Number(newScore) > Number(mark.max_marks)) {
      setError(`Revised score must be between 0 and ${mark.max_marks}.`); return;
    }
    if (!window.confirm('This removes all existing files for this mark and replaces them with the new upload, and updates the score. Continue?')) return;
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('mark_id', mark.id);
      form.append('scored_marks', newScore);
      for (const f of replacePicked) form.append('files', f);
      await api.post(`${apiBase}/corrected-papers/replace`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReplacePicked(null); setShowReplace(false);
      onMarkUpdated?.(mark.id, Number(newScore));
      load();
    } catch (e) { setError(e.response?.data?.error || 'Replace failed'); }
    finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Corrected Paper</h2>
            <p className="text-xs text-gray-500">{mark.student_name} · {mark.assessment_type} · Score {mark.scored_marks}/{mark.max_marks}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600">✕</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Files on record</h3>
          {!files ? <p className="text-sm text-gray-500">Loading…</p> : files.length === 0 ? (
            <p className="text-sm text-gray-500">No corrected paper uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {files.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="truncate">
                    <p className="text-gray-800 truncate">{f.file_name}</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(f.uploaded_at)}{f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ''}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleDownload(f)} className="text-xs font-medium px-2 py-1 rounded-md border border-primary-300 text-primary-700 hover:bg-primary-50">View</button>
                    <button onClick={() => handleDelete(f)} className="text-xs font-medium px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Add file(s)</h3>
          <input
            type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={e => setAddPicked([...e.target.files])}
            className="block w-full text-sm text-gray-600"
          />
          <button type="submit" disabled={!addPicked?.length || uploading} className="btn-secondary text-sm">
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        <div className="border-t border-gray-100 pt-4">
          {!showReplace ? (
            <button onClick={() => setShowReplace(true)} className="text-sm font-medium text-amber-700 hover:text-amber-800">
              Grievance: replace paper & revise score →
            </button>
          ) : (
            <form onSubmit={handleReplace} className="space-y-2">
              <h3 className="text-sm font-semibold text-amber-700">Replace paper & revise score</h3>
              <p className="text-xs text-gray-500">Removes all files currently on record for this mark and replaces them with the new scan, and updates the score to match.</p>
              <input
                type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={e => setReplacePicked([...e.target.files])}
                className="block w-full text-sm text-gray-600"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Revised score</label>
                <input
                  type="number" min={0} max={Number(mark.max_marks)} step={0.5}
                  className="input py-1 px-2 text-sm w-24"
                  value={newScore} onChange={e => setNewScore(e.target.value)}
                />
                <span className="text-sm text-gray-500">/ {mark.max_marks}</span>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={uploading} className="btn-primary text-sm">
                  {uploading ? 'Replacing…' : 'Replace & Update Score'}
                </button>
                <button type="button" onClick={() => setShowReplace(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
