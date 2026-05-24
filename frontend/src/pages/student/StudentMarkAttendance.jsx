import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import TodayPill from '../../components/dashboard/TodayPill';
import SessionCountdown from '../../components/dashboard/SessionCountdown';

const SHAKE_DURATION = 600; // ms

export default function StudentMarkAttendance() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]); // today's sessions
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error'|'warning', message }
  const [shake, setShake] = useState(false);
  const [successBoxes, setSuccessBoxes] = useState(false);

  const hiddenInputRef = useRef(null);

  // ── load today's sessions ────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get('/student/attendance/today');
      const data = res.data ?? [];
      setSessions(data);

      const open = data.filter((s) => s.session_open && !s.already_marked);
      if (open.length === 1) setSelectedSubjectId(String(open[0].subject_id));
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ── derived ──────────────────────────────────────────────────────────────

  const openSessions = sessions.filter((s) => s.session_open && !s.already_marked);

  const selectedSession = sessions.find(
    (s) => String(s.subject_id) === String(selectedSubjectId),
  );

  // ── PIN input handling ───────────────────────────────────────────────────

  function handleOverlayChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
    setFeedback(null);
  }

  function focusInput() {
    hiddenInputRef.current?.focus();
  }

  // ── submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (pin.length < 6 || !selectedSubjectId || submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      await api.post('/student/attendance/submit', {
        pin,
        subject_id: selectedSubjectId,
      });

      setSuccessBoxes(true);
      setFeedback({ type: 'success', message: '✓ Attendance marked!' });
      setPin('');
      await loadSessions();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'Submission failed';

      if (status === 409) {
        setFeedback({ type: 'warning', message: 'Already marked for this session.' });
        await loadSessions();
      } else if (status === 410) {
        setFeedback({ type: 'warning', message: 'This session has expired.' });
        await loadSessions();
      } else {
        // 400 or other → shake + clear PIN
        setFeedback({ type: 'error', message: msg || 'Invalid PIN' });
        triggerShake();
        setTimeout(() => {
          setPin('');
          hiddenInputRef.current?.focus();
        }, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), SHAKE_DURATION);
  }

  // ── box styles ───────────────────────────────────────────────────────────

  function boxStyle(index) {
    const filled = index < pin.length;
    const digit = pin[index];

    if (successBoxes && feedback?.type === 'success') {
      return {
        base: 'w-12 h-14 flex items-center justify-center rounded-xl text-xl font-mono font-bold border-2 transition-all',
        state: 'border-green-500 bg-green-50 text-green-700',
      };
    }

    if (filled) {
      return {
        base: 'w-12 h-14 flex items-center justify-center rounded-xl text-xl font-mono font-bold border-2 transition-all',
        state: 'border-primary-500 bg-primary-50 text-primary-700',
      };
    }

    return {
      base: 'w-12 h-14 flex items-center justify-center rounded-xl text-xl font-mono font-bold border-2 transition-all',
      state: 'border-gray-200 bg-gray-50 text-gray-300',
    };
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-6px); }
          30%  { transform: translateX(6px); }
          45%  { transform: translateX(-5px); }
          60%  { transform: translateX(5px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        .shake-anim {
          animation: shake ${SHAKE_DURATION}ms ease-in-out;
        }
      `}</style>

      <div className="max-w-sm mx-auto px-4 py-8 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Mark Attendance</h1>

        {/* ── No sessions ── */}
        {!loadingSessions && openSessions.length === 0 && (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-gray-500 text-sm font-medium">
              No active sessions right now — ask your teacher to open one.
            </p>
          </div>
        )}

        {/* ── Session form ── */}
        {(loadingSessions || openSessions.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            {/* Subject selector — only shown when multiple open sessions */}
            {openSessions.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Subject
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setPin('');
                    setFeedback(null);
                    setSuccessBoxes(false);
                  }}
                >
                  <option value="" disabled>
                    — choose subject —
                  </option>
                  {openSessions.map((s) => (
                    <option key={s.subject_id} value={String(s.subject_id)}>
                      {s.subject_code ? `${s.subject_code} — ` : ''}{s.subject_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {openSessions.length === 1 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                  Subject
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {openSessions[0].subject_code
                    ? `${openSessions[0].subject_code} — `
                    : ''}
                  {openSessions[0].subject_name}
                </p>
              </div>
            )}

            {/* PIN boxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Enter 6-digit PIN
              </label>

              {/* Box + hidden input wrapper */}
              <div
                className={`relative cursor-text ${shake ? 'shake-anim' : ''}`}
                onClick={focusInput}
              >
                {/* Visual boxes */}
                <div className="flex gap-2 justify-center pointer-events-none select-none">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const { base, state } = boxStyle(i);
                    const digit = pin[i];
                    return (
                      <div key={i} className={`${base} ${state}`}>
                        {digit ? (
                          <span>{digit}</span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-200" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Invisible capture input */}
                <input
                  ref={hiddenInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={handleOverlayChange}
                  autoFocus
                  className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin.length === 6) handleSubmit();
                  }}
                  aria-label="PIN entry"
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {/* Countdown */}
            {selectedSession?.expires_at && (
              <div className="flex justify-center">
                <SessionCountdown expiresAt={selectedSession.expires_at} />
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div
                className={`text-sm font-medium text-center rounded-lg py-2.5 px-4 ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : feedback.type === 'warning'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* Submit */}
            <button
              disabled={pin.length < 6 || !selectedSubjectId || submitting}
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all
                bg-primary-600 text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-primary-700 active:scale-95"
            >
              {submitting ? 'Submitting…' : 'Submit Attendance'}
            </button>
          </div>
        )}

        {/* ── Today's sessions strip ── */}
        {sessions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Today's Sessions
            </p>
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => {
                let status = 'none';
                if (s.already_marked) status = 'present';
                else if (s.session_open) status = 'pending';
                return (
                  <TodayPill
                    key={s.subject_id}
                    subjectName={s.subject_name}
                    status={status}
                    onClick={
                      status === 'pending'
                        ? () => {
                            setSelectedSubjectId(String(s.subject_id));
                            setPin('');
                            setFeedback(null);
                            setSuccessBoxes(false);
                            hiddenInputRef.current?.focus();
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
