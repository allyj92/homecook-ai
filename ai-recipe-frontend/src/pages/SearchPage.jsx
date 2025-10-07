// src/pages/SearchPage.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

// ───── helpers (간단 버전) ─────
const toArr = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.items)) return data.items;
  const firstArray = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => stripHtml(s).toLowerCase(); // 한글은 소문자 변환 영향 거의 없음

const textOf = (p) =>
  [
    p.title,
    p.subtitle,
    p.content,
    p.body,
    p.summary,
    Array.isArray(p.tags) ? p.tags.join(' ') : '',
  ]
    .map(stripHtml)
    .join(' ');

// 간단 커버 추출(있으면 쓰고, 없어도 동작)
const coverOf = (p) =>
  p.coverUrl || p.cover_url || p.thumbnailUrl || p.thumbnail_url || p.imageUrl || p.image_url || null;

export default function SearchPage() {
  const nav = useNavigate();
  const { search } = useLocation();
  const q = useMemo(() => decodeURIComponent(new URLSearchParams(search).get('q') || ''), [search]);

  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const [results, setResults] = useState([]);

  // 목록 로드 (백엔드 수정 없이 최근 n개 가져와 클라에서 필터)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/community/posts?page=0&size=300&sort=createdAt,desc', {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const j = await res.json();
        const items = toArr(j).map((p) => ({
          ...p,
          __cover: coverOf(p),
          __likes: Number(
            p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? p.metrics?.hearts ?? 0
          ),
          __comments: Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0),
          __text: textOf(p),
          __textNorm: norm(textOf(p)),
        }));
        if (alive) setAll(items);
      } catch {
        if (alive) setAll([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 필터링
  const tokens = useMemo(
    () =>
      norm(q)
        .split(/\s+/)
        .filter(Boolean),
    [q]
  );

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    // AND 매칭: 모든 토큰이 포함되어야 함
    const matched = all.filter((p) => tokens.every((t) => p.__textNorm.includes(t)));

    // 간단 랭킹: 일치 횟수 + 참여도(좋아요/댓글 약간 가중)
    const score = (p) => {
      const occur = tokens.reduce((sum, t) => sum + (p.__textNorm.split(t).length - 1), 0);
      return occur * 10 + p.__likes * 0.5 + p.__comments * 0.3;
    };
    matched.sort((a, b) => score(b) - score(a));
    setResults(matched);
  }, [q, all, tokens]);

  return (
    <div className="container-xxl py-3">
      <div className="d-flex align-items-center gap-2 mb-3">
        <button className="btn btn-light border" onClick={() => nav(-1)}>
          ← 뒤로
        </button>
        <h1 className="h5 m-0">검색 결과</h1>
        <div className="ms-auto small text-secondary">“{q}”</div>
      </div>

      {(!q || !q.trim()) && (
        <div className="alert alert-light border">검색어를 입력해 주세요.</div>
      )}

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
      ) : results.length === 0 ? (
        <div className="alert alert-light border">
          “{q}”에 대한 결과가 없어요. 철자나 다른 키워드로 다시 검색해 보세요.
        </div>
      ) : (
        <div className="row g-3">
          {results.map((p) => {
            const to = `/community/${p.id}`;
            return (
              <div className="col-12 col-sm-6 col-lg-3" key={p.id}>
                <article
                  className="card h-100 shadow-sm"
                  role="button"
                  onClick={() => nav(to)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      nav(to);
                    }
                  }}
                >
                  <div className="ratio ratio-4x3 bg-light rounded-top position-relative">
                    {p.__cover && (
                      <img
                        src={p.__cover}
                        alt=""
                        className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                        style={{ objectFit: 'cover' }}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className="card-body">
                    <h3 className="h6 fw-semibold mb-1">{p.title || `게시글 #${p.id}`}</h3>
                    <div className="small d-flex align-items-center gap-3 text-secondary">
                      <span>❤ {p.__likes}</span>
                      <span>💬 {p.__comments}</span>
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