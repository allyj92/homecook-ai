// src/pages/SavedPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { listFavorites, removeFavorite } from '../lib/wishlist';
import BottomNav from '../compoments/BottomNav';
import { Link, useNavigate } from 'react-router-dom';

const PAGE_SIZE = 12;

export default function SavedPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const rows = await listFavorites();
        if (!aborted) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!aborted) setErr('저장한 레시피를 불러오지 못했어요.');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, pageSafe]);

  async function onRemove(recipeId) {
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return;
    const prev = items;
    setItems(arr => arr.filter(it => Number(it.recipeId) !== rid));
    try {
      await removeFavorite(rid);
    } catch {
      alert('삭제에 실패했어요.');
      setItems(prev);
    }
  }

  return (
    <div className="container-xxl py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">저장한 레시피</h1>
        <Link className="btn btn-outline-secondary btn-sm" to="/mypage">마이페이지로</Link>
      </div>

      {loading && (
        <div className="card shadow-sm">
          <div className="p-3">
            <div className="placeholder-glow">
              <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
              <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
              <div className="placeholder col-8" style={{ height: 18 }} />
            </div>
          </div>
        </div>
      )}

      {!loading && err && (
        <div className="alert alert-danger">{err}</div>
      )}

      {!loading && !err && total === 0 && (
        <div className="card shadow-sm">
          <div className="p-4 text-center text-secondary">
            아직 저장한 레시피가 없어요.
            <div className="mt-2">
              <Link className="btn btn-sm btn-success" to="/input">레시피 받으러 가기</Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !err && total > 0 && (
        <>
          <div className="list-group list-group-flush card shadow-sm">
            {paged.map((w) => (
              <div key={w.recipeId} className="list-group-item">
                <div className="d-flex align-items-start gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className="rounded"
                      style={{
                        width: 96, height: 64, background: '#f3f3f3',
                        backgroundImage: w.image ? `url(${w.image})` : undefined,
                        backgroundSize: 'cover', backgroundPosition: 'center'
                      }}
                    />
                  </div>

                  {/* 텍스트 묶음: 한 줄 타이틀, 한 줄 메타, 한 줄 요약(… 처리) */}
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-truncate">{w.title ?? `레시피 #${w.recipeId}`}</div>
                    {w.meta && <div className="small text-secondary text-truncate">{w.meta}</div>}
                    {w.summary && (
                      <div
                        className="small text-secondary"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {w.summary}
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-column align-items-end gap-2">
                    <Link className="btn btn-sm btn-outline-primary" to={`/result?id=${w.recipeId}`}>
                      보기
                    </Link>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      style={{ minWidth: 64, height: 32, padding: '0 12px' }}
                      onClick={() => onRemove(w.recipeId)}
                    >
                      제거
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          <nav className="mt-3 d-flex justify-content-center">
            <ul className="pagination mb-0">
              <li className={`page-item ${pageSafe === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))}>이전</button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, pageSafe - 3), Math.max(0, pageSafe - 3) + 5)
                .map(n => (
                  <li key={n} className={`page-item ${n === pageSafe ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setPage(n)}>{n}</button>
                  </li>
                ))}
              <li className={`page-item ${pageSafe === totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>다음</button>
              </li>
            </ul>
          </nav>
        </>
      )}

      <div className="d-md-none mt-4">
        <BottomNav />
      </div>
    </div>
  );
}
