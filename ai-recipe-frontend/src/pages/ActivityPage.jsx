// src/pages/ActivityPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
import { listActivitiesPaged, subscribeActivity, formatActivityText, formatActivityHref, countActivities } from '../lib/activity';

export default function ActivityPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const size = 20;

  const pageParam = parseInt(params.get('page') || '0', 10);
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = () => {
    setLoading(true);
    try {
      const { items, total } = listActivitiesPaged(page, size);
      setItems(items);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const off = subscribeActivity(load);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goPage = (p) => setParams({ page: String(Math.max(0, Math.min(p, totalPages - 1))) }, { replace: true });

  return (
    <div className="container-xxl py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">활동 내역</h1>
        <div className="text-secondary small">총 {total}건</div>
      </div>

      <div className="card shadow-sm">
        {loading ? (
          <div className="p-3">
            <div className="placeholder-glow">
              <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
              <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
              <div className="placeholder col-8" style={{ height: 18 }} />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-secondary">활동 내역이 없습니다.</div>
        ) : (
          <>
            <ul className="list-group list-group-flush">
              {items.map((a) => {
                const href = formatActivityHref(a);
                const text = formatActivityText(a);
                return (
                  <li key={a.id} className="list-group-item d-flex justify-content-between">
                    <span>{href ? <Link to={href} className="text-decoration-none">{text}</Link> : text}</span>
                    <small className="text-secondary">{new Date(a.ts).toLocaleString()}</small>
                  </li>
                );
              })}
            </ul>

            <nav className="p-3 d-flex justify-content-between align-items-center">
              <button
                className="btn btn-outline-secondary"
                disabled={page <= 0}
                onClick={() => goPage(page - 1)}
              >
                ← 이전
              </button>
              <div className="text-secondary small">
                {page + 1} / {totalPages}
              </div>
              <button
                className="btn btn-outline-secondary"
                disabled={(page + 1) >= totalPages}
                onClick={() => goPage(page + 1)}
              >
                다음 →
              </button>
            </nav>
          </>
        )}
      </div>

      <footer className="text-center text-secondary small mt-4">
        © {new Date().getFullYear()} RecipFree
      </footer>

      <BottomNav />
    </div>
  );
}
