import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/* ---- 브랜딩 컬러 ---- */
const BRAND = {
  orange: '#ff7f32',
  teal:   '#009688',
  ink:    '#212529',
  mute:   '#6c757d',
  softBg: '#fff7f1',
  softBd: '#ffd7bf',
};

/* ---- 유틸(필요 최소) ---- */
const ellipsis = (s, n = 48) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1000000) return (x/1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1000)    return (x/1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
};
const toArr = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.items)) return data.items;
  const firstArray = Object.values(data).find(v => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/* 이미지 커버 추출(간단 버전) */
function pick(obj, keys) { for (const k of keys) { if (obj && obj[k]) return obj[k]; } return null; }
function buildCover(p) {
  return (
    pick(p, ['coverUrl','cover_url','imageUrl','image_url','thumbnailUrl','thumbnail_url','thumbnail']) ||
    (p.attachments && p.attachments[0]?.url) ||
    null
  );
}

/* 검색: 가능한 엔드포인트를 순차 시도 + 없으면 프런트 필터 */
async function searchEverywhere(q) {
  const size = 40;
  const endpoints = [
    `/api/search?q=${encodeURIComponent(q)}&size=${size}`,
    `/api/community/posts?query=${encodeURIComponent(q)}&size=${size}`,
    `/api/community/posts?q=${encodeURIComponent(q)}&size=${size}`,
    `/api/community/posts?search=${encodeURIComponent(q)}&size=${size}`,
  ];

  for (const url of endpoints) {
    try {
      const j = await fetchJson(url);
      const arr = toArr(j);
      if (arr.length) {
        return arr.map(p => ({
          ...p,
          __cover: buildCover(p),
          __likes: Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? 0),
          __comments: Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0),
          __asPost: true,
        }));
      }
    } catch { /* 다음 후보로 */ }
  }

  // Fallback: 최근 글 받아서 클라에서 필터
  try {
    const j = await fetchJson(`/api/community/posts?page=0&size=200&sort=createdAt,desc`);
    const items = toArr(j);
    const qLower = q.toLowerCase();
    return items
      .filter(p => (String(p.title||'') + ' ' + String(p.content||'')).toLowerCase().includes(qLower))
      .map(p => ({
        ...p,
        __cover: buildCover(p),
        __likes: Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? 0),
        __comments: Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0),
        __asPost: true,
      }));
  } catch {
    return [];
  }
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const keyword = useMemo(() => String(params.get('q') || '').trim(), [params]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    if (!keyword) { setResults([]); return; }
    setLoading(true); setError('');
    try {
      const r = await searchEverywhere(keyword);
      setResults(r);
    } catch (e) {
      setError('검색 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="container-xxl py-3">
      {/* 상단 (검색창 간단 복붙) */}
      <div
        className="position-sticky top-0"
        style={{
          zIndex: 1030,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(6px)',
          borderBottom: `1px solid ${BRAND.softBd}`,
        }}
      >
        <div className="container-xxl py-2">
          <form
            onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.q.value.trim(); if (v) navigate(`/search?q=${encodeURIComponent(v)}`); }}
            className="mx-auto"
            style={{ maxWidth: 880 }}
          >
            <div
              className="d-flex align-items-center"
              style={{
                border: `1px solid ${BRAND.softBd}`,
                borderRadius: 9999,
                background: '#fff',
                padding: '6px 8px',
                gap: 8,
              }}
            >
              <input
                name="q"
                defaultValue={keyword}
                placeholder="레시피를 검색하세요"
                className="form-control border-0"
                style={{ boxShadow: 'none', height: 44, fontSize: '1rem' }}
                aria-label="레시피 검색"
              />
              <button
                type="submit"
                className="btn p-0"
                aria-label="검색"
                title="검색"
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'grid', placeItems: 'center', background: BRAND.orange,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                        fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 본문 */}
      <div className="d-flex align-items-center justify-content-between mt-3 mb-2">
        <h2 className="h5 fw-bold m-0" style={{ color: BRAND.ink }}>
          {keyword ? `“${keyword}” 검색 결과` : '검색'}
        </h2>
        {!loading && keyword && (
          <span className="small" style={{ color: BRAND.mute }}>
            {results.length.toLocaleString()}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="row g-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="col-12 col-sm-6 col-lg-3" key={i}>
              <div className="card shadow-sm">
                <div className="ratio ratio-4x3 bg-light rounded-top placeholder" />
                <div className="card-body">
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-6" style={{ height: 14 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-danger small">{error}</div>
      ) : results.length === 0 ? (
        <div className="alert alert-light border small">검색 결과가 없어요.</div>
      ) : (
        <div className="row g-3">
          {results.map((p) => {
            const to = `/community/${p.id}`; // 현재는 커뮤니티 글 기준
            return (
              <div className="col-12 col-sm-6 col-lg-3" key={p.id}>
                <article
                  className="card h-100 shadow-sm"
                  onClick={() => navigate(to)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.title || '게시글'} 보기`}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
                >
                  <div className="position-relative">
                    <div className="ratio ratio-4x3 bg-light rounded-top">
                      {p.__cover && (
                        <img
                          src={p.__cover}
                          alt=""
                          className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                          style={{ objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                    {p.__likes > 0 && (
                      <span
                        className="badge border position-absolute top-0 start-0 m-2"
                        style={{ background: BRAND.teal, color: '#fff', borderColor: BRAND.teal }}
                      >
                        ❤ {fmtNum(p.__likes)}
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    <h3 className="h6 fw-semibold mb-1" style={{ color: BRAND.ink }}>
                      {ellipsis(p.title || `게시글 #${p.id}`, 48)}
                    </h3>
                    <div className="small d-flex align-items-center gap-3" style={{ color: BRAND.mute }}>
                      <span aria-label={`좋아요 ${p.__likes}개`}>❤ {fmtNum(p.__likes)}</span>
                      <span aria-label={`댓글 ${p.__comments}개`}>💬 {fmtNum(p.__comments)}</span>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}