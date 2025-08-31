// src/pages/SavedPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../compoments/BottomNav';
import { listFavoritesPage, removeFavorite } from '../lib/wishlist';

const PAGE_SIZE = 12; // 1페이지 아이템 수

export default function SavedPage() {
  const nav = useNavigate();
  const [search, setSearch] = useSearchParams();
  const pageFromUrl = Number(search.get('page') ?? '1'); // 1-based
  const [page, setPage] = useState(Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState({ items: [], page: 0, size: PAGE_SIZE, total: 0, totalPages: 1 });

  async function load(p = 1) {
    setLoading(true);
    setErr('');
    try {
      // 백엔드는 0-based
      const res = await listFavoritesPage({ page: p - 1, size: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setErr(e?.message || '저장한 레시피를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 로그인 확인
    (async () => {
      const me = await fetch('/api/auth/me', { credentials: 'include' });
      if (me.status === 401) return nav('/login-signup', { replace: true, state: { from: '/saved' } });
      await load(page);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, nav]);

  // URL 동기화
  useEffect(() => {
    setSearch(prev => {
      const sp = new URLSearchParams(prev);
      sp.set('page', String(page));
      return sp;
    }, { replace: true });
  }, [page, setSearch]);

  async function onRemove(e, recipeId) {
    e.preventDefault(); e.stopPropagation();
    const prev = data;
    setData(d => ({ ...d, items: d.items.filter(x => Number(x.recipeId) !== Number(recipeId)) }));
    try { await removeFavorite(recipeId); }
    catch {
      alert('삭제 실패');
      setData(prev);
    }
  }

  const canPrev = page > 1;
  const canNext = page < data.totalPages;

  // 단순한 페이지네이터 (현재를 기준으로 좌우 몇 개)
  function renderPager() {
    if (data.totalPages <= 1) return null;
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(data.totalPages, page + window);
    const nums = [];
    for (let i = start; i <= end; i++) nums.push(i);

    return (
      <nav className="d-flex justify-content-center mt-3">
        <ul className="pagination mb-0">
          <li className={`page-item ${!canPrev ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => canPrev && setPage(page - 1)}>‹</button>
          </li>
          {start > 1 && (
            <>
              <li className="page-item"><button className="page-link" onClick={() => setPage(1)}>1</button></li>
              {start > 2 && <li className="page-item disabled"><span className="page-link">…</span></li>}
            </>
          )}
          {nums.map(n => (
            <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => setPage(n)}>{n}</button>
            </li>
          ))}
          {end < data.totalPages && (
            <>
              {end < data.totalPages - 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
              <li className="page-item"><button className="page-link" onClick={() => setPage(data.totalPages)}>{data.totalPages}</button></li>
            </>
          )}
          <li className={`page-item ${!canNext ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => canNext && setPage(page + 1)}>›</button>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <main className="container-xxl py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">저장한 레시피</h1>
        <Link className="btn btn-outline-secondary btn-sm" to="/mypage">마이페이지</Link>
      </div>

      {loading && (
        <div className="p-4 text-center"><div className="spinner-border" role="status" /></div>
      )}

      {!loading && err && <div className="alert alert-danger">{err}</div>}

      {!loading && !err && data.items.length === 0 && (
        <div className="p-4 text-center text-secondary">
          아직 저장한 레시피가 없어요.
          <div className="mt-2"><Link to="/input" className="btn btn-sm btn-success">레시피 받기</Link></div>
        </div>
      )}

      {!loading && !err && data.items.length > 0 && (
        <>
          <div className="list-group list-group-flush">
            {data.items.map((w) => {
              const key = w.id ?? w.recipeId;
              const to  = `/result?id=${encodeURIComponent(w.recipeId)}`;
              return (
                <Link key={key} to={to} className="list-group-item list-group-item-action">
                  <div className="d-flex align-items-center gap-3">
                    <div className="flex-no-shrink">
                      <div
                        className="bookmark-thumb"
                        style={{ backgroundImage: w.image ? `url(${w.image})` : undefined }}
                      />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-semibold line-clamp-1">{w.title ?? `레시피 #${w.recipeId}`}</div>
                      {w.meta && <div className="small text-secondary line-clamp-1">{w.meta}</div>}
                      {w.summary && <div className="small text-secondary line-clamp-2">{w.summary}</div>}
                    </div>
                    <div className="d-flex gap-2 flex-no-shrink">
                      <button className="btn btn-sm btn-outline-danger btn-remove" onClick={(e)=>onRemove(e,w.recipeId)}>제거</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* 카운트/페이지네이터 */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="text-secondary small">
              총 {data.total}개 · {page}/{data.totalPages} 페이지
            </div>
            {renderPager()}
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
