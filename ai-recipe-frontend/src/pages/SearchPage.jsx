// src/pages/SearchPage.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

/* ───────── 공통 유틸 ───────── */
const toArr = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.items)) return data.items;
  const firstArray = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

const stripHtml = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const norm = (s) => stripHtml(s).toLowerCase();

const textOf = (p) =>
  [p.title, p.subtitle, p.content, p.body, p.summary, Array.isArray(p.tags) ? p.tags.join(' ') : '']
    .map(stripHtml)
    .join(' ');

/* ───────── 이미지 URL 유틸 ───────── */
function unwrapLoginUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    const host = u.host.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.startsWith('login.') || /\/(auth|login)/i.test(path)) {
      const keys = ['url','next','redirect','continue','rd','r','to','dest','destination','u','returnUrl','return_to'];
      for (const k of keys) {
        const v = u.searchParams.get(k);
        if (v) {
          const inner = decodeURIComponent(v);
          if (/^https?:\/\//i.test(inner)) return inner;
        }
      }
      if (u.hash && /^#https?:\/\//i.test(u.hash)) return u.hash.slice(1);
    }
  } catch {}
  return url;
}

function isUsableImageUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (/\/(auth|login)/i.test(u.pathname.toLowerCase())) return false;
    const httpsPage = window.location.protocol === 'https:';
    const external  = u.host !== window.location.host;
    if (httpsPage && external && u.protocol === 'http:') return false; // mixed content 차단
    return /^https?:/.test(u.href) || u.href.startsWith('data:') || u.href.startsWith('/');
  } catch { return false; }
}

function normalizeCoverUrl(url) {
  if (!url) return null;
  if (/^(data:|blob:)/i.test(url)) return url;
  try {
    let raw = unwrapLoginUrl(url);
    if (raw.startsWith('/')) return raw;
    const u = new URL(raw, window.location.origin);
    const isHttpsPage = window.location.protocol === 'https:';
    const sameHost    = u.host === window.location.host;

    // sameHost일 때만 http→https 업그레이드 (외부는 건드리지 않음)
    if (isHttpsPage && sameHost && u.protocol === 'http:') {
      try { u.protocol = 'https:'; } catch {}
    }
    return sameHost ? (u.pathname + u.search + u.hash) : u.toString();
  } catch { return url; }
}

/** 혼합콘텐츠 회피: 외부 http 이미지는 프록시로 래핑 */
function wrapHttpImageIfNeeded(u) {
  try {
    const url = new URL(u, window.location.origin);
    const httpsPage = window.location.protocol === 'https:';
    const external  = url.host !== window.location.host;
    if (httpsPage && external && url.protocol === 'http:') {
      return `/api/img-proxy?u=${encodeURIComponent(url.toString())}`;
    }
    return u;
  } catch { return u; }
}

function withVersion(url, ver) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    const sameHost = u.host === window.location.host;
    const hasQuery = !!u.search && u.search.length > 1;
    const signed = /X-Amz-|Signature=|X-Goog-Signature=|token=|expires=|CloudFront/i.test(u.search);
    if (sameHost && !hasQuery && !signed) {
      const v = ver != null ? (typeof ver === 'number' ? ver : Date.parse(ver) || Date.now()) : Date.now();
      u.searchParams.set('v', String(v));
      return u.pathname + u.search + u.hash;
    }
    return u.toString();
  } catch { return url; }
}

const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);

/* 본문/첨부에서 이미지 후보 추출 */
function firstImageFromContent(p) {
  let s = String(p?.content ?? p?.body ?? p?.html ?? '').trim();
  if (!s) return null;

  let m = /!\[[^\]]*]\(([^)]+)\)/.exec(s);
  if (m?.[1]) {
    const u = unwrapLoginUrl(m[1].split('"')[0].trim());
    return isUsableImageUrl(u) ? u : null;
  }
  m = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) {
    const u = unwrapLoginUrl(m[1].trim());
    return isUsableImageUrl(u) ? u : null;
  }
  m = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) {
    const u = unwrapLoginUrl(m[1].trim());
    return isUsableImageUrl(u) ? u : null;
  }
  m = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) {
    const first = m[1].split(',')[0].trim().split(' ')[0];
    if (first) {
      const u = unwrapLoginUrl(first);
      return isUsableImageUrl(u) ? u : null;
    }
  }
  return null;
}

function firstAttachmentUrl(p) {
  const arr = p?.attachments ?? p?.images ?? p?.photos ?? [];
  for (const it of (Array.isArray(arr) ? arr : [])) {
    const raw = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
    const u = raw ? unwrapLoginUrl(String(raw)) : null;
    if (u && isUsableImageUrl(u)) return u;
  }
  return null;
}

/* 후보들을 여러 개 모아서 폴백 가능하게 */
function collectCoverCandidates(p) {
  const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;
  const candidatesRaw = [
    p.coverUrl, p.cover_url,
    p.repImageUrl, p.rep_image_url,
    p.thumbnailUrl, p.thumbnail_url,
    p.imageUrl, p.image_url,
    firstAttachmentUrl(p),
    firstImageFromContent(p),
    ytThumb(p.youtubeId ?? p.youtube_id ?? null),
  ].filter(Boolean);

  const normalized = candidatesRaw
    .map((u) => withVersion(normalizeCoverUrl(u), updatedAt))
    .filter(Boolean)
    .map(wrapHttpImageIfNeeded) // ★ 핵심: 외부 http → 프록시 래핑
    .filter(isUsableImageUrl);

  // 중복 제거
  const seen = new Set();
  const uniq = [];
  for (const u of normalized) {
    const key = String(u).toLowerCase();
    if (!seen.has(key)) { seen.add(key); uniq.push(u); }
  }
  return uniq;
}

/* 폴백 이미지 컴포넌트 */
function SmartImg({ sources, alt = '', className = '' }) {
  const [idx, setIdx] = useState(0);
  const src = sources?.[idx] || null;
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ objectFit: 'cover' }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < (sources?.length || 0)) setIdx(idx + 1);
      }}
    />
  );
}

/* ───────── 페이지 ───────── */
export default function SearchPage() {
  const nav = useNavigate();
  const { search } = useLocation();
  const q = useMemo(() => decodeURIComponent(new URLSearchParams(search).get('q') || ''), [search]);

  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const [results, setResults] = useState([]);

  // 목록 로드
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
          __covers: collectCoverCandidates(p),
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
    return () => { alive = false; };
  }, []);

  // 필터링
  const tokens = useMemo(() => norm(q).split(/\s+/).filter(Boolean), [q]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const matched = all.filter((p) => tokens.every((t) => p.__textNorm.includes(t)));
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
        <button className="btn btn-light border" onClick={() => nav(-1)}>← 뒤로</button>
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
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(to); }
                  }}
                >
                  <div className="ratio ratio-4x3 bg-light rounded-top position-relative">
                    {p.__covers?.length > 0 && (
                      <SmartImg
                        sources={p.__covers}
                        className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
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
