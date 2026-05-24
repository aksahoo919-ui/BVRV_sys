import React, { useEffect, useState, useMemo } from 'react';
import api from '../../utils/api';

function Spinner() {
  return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function GpaBadge({ gpa }) {
  const n = parseFloat(gpa);
  const cls = n >= 8 ? 'bg-emerald-100 text-emerald-700' : n >= 6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{isNaN(n) ? '—' : n.toFixed(2)}</span>;
}

export default function AdminResults() {
  const [semesters, setSemesters] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [loading, setLoading] = useState(false);
  const [semLoading, setSemLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genInfo, setGenInfo] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishInfo, setPublishInfo] = useState('');

  useEffect(() => {
    setSemLoading(true);
    api.get('/admin/semesters')
      .then(r => {
        setSemesters(r.data);
        const cur = r.data.find(s => s.is_current) || r.data[0];
        if (cur) setSelectedSemester(String(cur.id));
      })
      .catch(() => setError('Failed to load semesters'))
      .finally(() => setSemLoading(false));
  }, []);

  async function loadResults(semId) {
    if (!semId) return;
    setLoading(true); setError('');
    try {
      const r = await api.get(`/admin/results?semester_id=${semId}`);
      setResults(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadResults(selectedSemester); }, [selectedSemester]);

  async function handleGenerate() {
    if (!selectedSemester) return;
    if (!window.confirm('Generate results from marks data? Existing results will be overwritten.')) return;
    setGenerating(true); setGenInfo(''); setError('');
    try {
      const r = await api.post(`/admin/results/generate/${selectedSemester}`);
      setGenInfo(`Generated results for ${r.data.generated} student(s).`);
      await loadResults(selectedSemester);
    } catch (e) { setError(e.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  }

  async function handlePublish() {
    if (!selectedSemester) return;
    if (!window.confirm('Publish all results for this semester? Students will be able to see them.')) return;
    setPublishing(true); setPublishInfo(''); setError('');
    try {
      const r = await api.post('/admin/results/publish', { semester_id: selectedSemester });
      setPublishInfo(`Published ${r.data.published} results.`);
      await loadResults(selectedSemester);
    } catch (e) { setError(e.response?.data?.error || 'Publish failed'); }
    finally { setPublishing(false); }
  }

  function downloadRankList(fmt) {
    window.open(`/admin/reports/rank-list/${selectedSemester}?export=${fmt}`, '_blank');
  }

  const publishedCount = useMemo(() => results.filter(r => r.published).length, [results]);
  const sem = semesters.find(s => String(s.id) === selectedSemester);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Results</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
      {genInfo && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">✓ {genInfo}</div>}
      {publishInfo && <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg">✓ {publishInfo}</div>}

      {/* Semester selector + actions */}
      <div className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
          {semLoading ? <div className="input text-gray-400 text-sm">Loading…</div> : (
            <select className="input" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              <option value="">— Select semester —</option>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>
                  Semester {s.number} — {s.year_label}{s.is_current ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary" onClick={handleGenerate} disabled={!selectedSemester || generating}>
            {generating ? '⚙ Generating…' : '⚙ Generate Results'}
          </button>
          <button className="btn-primary" onClick={handlePublish} disabled={!selectedSemester || publishing || results.length === 0}>
            {publishing ? 'Publishing…' : '🚀 Publish'}
          </button>
          {results.length > 0 && (
            <>
              <button className="btn-secondary text-sm" onClick={() => downloadRankList('pdf')}>↓ PDF</button>
              <button className="btn-secondary text-sm" onClick={() => downloadRankList('xlsx')}>↓ Excel</button>
            </>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <p className="text-sm text-gray-500">
          {results.length} students · {publishedCount} published · {results.length - publishedCount} draft
          {sem ? ` · Semester ${sem.number}, ${sem.year_label}` : ''}
        </p>
      )}

      {/* Rank list table */}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Rank','Student','GPA','CGPA','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                  No results yet. Select a semester and click "Generate Results".
                </td></tr>
              ) : results.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-500">#{row.rank ?? i+1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{row.student_name}</p>
                    <p className="text-xs text-gray-400">{row.student_email}</p>
                  </td>
                  <td className="px-4 py-3"><GpaBadge gpa={row.gpa} /></td>
                  <td className="px-4 py-3 text-gray-600">{parseFloat(row.cgpa)?.toFixed(2) ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.published
                      ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Published</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Draft</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
