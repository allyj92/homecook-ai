// src/pages/ActivityPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
import {
  listActivitiesPaged,
  subscribeActivity,
  formatActivityText,
  formatActivityHref,
  ensureActivityNs,        // ✅ 추가
} from '../lib/activity';

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const [params, setParams] = useSearchParams();

  // 0-based page index
  const pageParam = parseInt(params.get('page') || '0', 10);
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  const goPage = (p) =>
    setParams(
      { page: String(Math.max(0, Math.min(p, Math.max(0, totalPages - 1)))) },
      { replace: true }
    );

  const load = async () => {
    setLoading(true);
    try {
      // ✅ 백엔드 세션 → localStorage.authUser 동기화 (서브도메인 이슈 방지)
      await ensureActivityNs();
      const { items, total } = listActivitiesPaged(page, PAGE_SIZE);
      setItems(items);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  };

  // 페이지 변경 시 로드 + 스크롤 상단
  useEffect(() => {
    (async () => { await load(); })();
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 총 건수가 줄어들어 현재 page가 범위를 벗어나면 보정
  useEffect(() => {
    const lastIdx = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    if (page > lastIdx) goPage(lastIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // 다른 탭/동일 탭에서 활동이 추가되면 1페이지로 이동(최신이 위)
  useEffect(() => {
    const off = subscribeActivity(async () => {
      if (page !== 0) goPage(0);
      else await load();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const rangeText =
    total === 0
      ? '0건'
      : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} / ${total}`;

  return (
    <div className="container-xxl py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">활동 내역</h1>
        <div className="text-secondary small">총 {total}건</div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
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
            <ul className="list-group list-group-flush">
              {items.map((a) => {
                const href = formatActivityHref(a);
                const text = formatActivityText(a);
                return (
                  <li key={a.id} className="list-group-item d-flex justify-content-between">
                    <span>
                      {href ? (
                        <Link to={href} className="text-decoration-none">
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </span>
                    <small className="text-secondary">{new Date(a.ts).toLocaleString()}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 페이지네이션 */}
        <div className="card-footer d-flex align-items-center justify-content-between">
          <div className="text-secondary small">{rangeText}</div>
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goPage(0)}
              disabled={page <= 0}
              title="첫 페이지"
              aria-label="첫 페이지"
            >
              «
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goPage(page - 1)}
              disabled={page <= 0}
              title="이전"
              aria-label="이전"
            >
              이전
            </button>
            <span className="btn btn-outline-secondary btn-sm disabled">
              {Math.min(totalPages, page + 1)} / {totalPages}
            </span>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goPage(page + 1)}
              disabled={page + 1 >= totalPages}
              title="다음"
              aria-label="다음"
            >
              다음
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => goPage(totalPages - 1)}
              disabled={page + 1 >= totalPages}
              title="마지막 페이지"
              aria-label="마지막 페이지"
            >
              »
            </button>
          </div>
        </div>
      </div>

      <footer className="text-center text-secondary small mt-4">
        © {new Date().getFullYear()} RecipFree
      </footer>

      <BottomNav />
    </div>
  );
}
