import { useEffect, useState } from 'react';
import api from '../utils/api';

// The institution's minimum attendance %, set by an admin in Settings.
// Every role must colour and warn by the same number — the BV Leader screens
// used to hard-code 75, so after the threshold was lowered to 60 a student at
// 64% was green for admin, teacher and the student, and red for their leader.
let cached = null;

export default function useThreshold() {
  const [threshold, setThreshold] = useState(cached ?? 75);

  useEffect(() => {
    if (cached != null) return undefined;
    let alive = true;
    api.get('/mentor/defaulters')
      .then((r) => {
        const t = Number(r.data?.threshold);
        if (alive && Number.isFinite(t) && t > 0) {
          cached = t;
          setThreshold(t);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return threshold;
}
