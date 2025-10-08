import { useEffect, useState } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString();

export default function VisitBadge() {
  const [today, setToday] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/metrics/hit', { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('Server error');
        const j = await res.json();
        setToday(j.today);
        setTotal(j.total);
      } catch {
        console.warn('Metrics failed (offline mode)');
      }
    })();
  }, []);

  return (
    <span className="badge bg-light text-dark border small px-3 py-2">
      오늘 <strong>{fmt(today)}</strong> · 전체 <strong>{fmt(total)}</strong>
    </span>
  );
}