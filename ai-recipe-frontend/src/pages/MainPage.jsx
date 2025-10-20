// src/pages/MainPage.jsx
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import '../index.css';
import BottomNav from '../components/BottomNav';
import { ensureLogin } from '../lib/auth';
import SiteFooter from '../components/SiteFooter';

const BRAND = {
  orange: '#ff7f32',
  teal:   '#009688',
  ink:    '#212529',
  mute:   '#6c757d',
  softBg: '#fff',      // 히어로 배경은 완전 화이트
  softBd: '#eee',      // 더 연한 보더
};

function TopSearchBar({ onSearch }) {
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    onSearch?.(v);
  };

  return (
    <div className="position-sticky top-0 bg-white" style={{ zIndex: 1030, borderBottom: '1px solid #eee' }}>
      <div className="container-xxl py-3" style={{ display: 'flex', justifyContent: 'center' }}>
        <form
          onSubmit={submit}
          style={{
            width: '100%', maxWidth: 640, display: 'flex', alignItems: 'center',
            background: '#fff', borderRadius: 12, border: '1px solid #ddd', padding: '6px 12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="레시피나 재료를 검색하세요"
            className="form-control border-0 bg-transparent"
            style={{ fontSize: '1rem', boxShadow: 'none' }}
            aria-label="검색"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="btn btn-light p-0 border-0 me-2"
              style={{ color: '#999', fontSize: 18 }}
              aria-label="검색어 지우기"
            >✕</button>
          )}
          <button
            type="submit"
            className="btn btn-success rounded-circle d-flex align-items-center justify-content-center"
            aria-label="검색"
            style={{ width: 38, height: 38, padding: 0, background: '#28a745', border: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- 이미지 URL 유틸 ---------------- */
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
    const path = u.pathname.toLowerCase();
    if (/\/(auth|login)/i.test(path)) return false;
    const isHttpsPage = window.location.protocol === 'https:';
    const isExternal = u.host !== window.location.host;
    if (isHttpsPage && isExternal && u.protocol === 'http:') return false;
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
    if (window.location.protocol === 'https:' && u.protocol === 'http:') {
      try { u.protocol = 'https:'; } catch {}
    }
    if (u.host === window.location.host) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch { return url; }
}
function withVersion(url, ver) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    const sameHost = (u.host === window.location.host);
    const hasQuery = !!u.search && u.search.length > 1;
    const looksSigned = /X-Amz-|Signature=|X-Goog-Signature=|token=|expires=|CloudFront/i.test(u.search);
    if (sameHost && !hasQuery && !looksSigned) {
      const v = ver != null ? (typeof ver === 'number' ? ver : Date.parse(ver) || Date.now()) : Date.now();
      u.searchParams.set('v', String(v));
      return u.pathname + u.search + u.hash;
    }
    return u.toString();
  } catch { return url; }
}
const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);

function firstImageFromContent(p) {
  const s = String(p?.content ?? p?.body ?? p?.html ?? '').trim();
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
function pick(obj, keys) { for (const k of keys) { if (obj && obj[k]) return obj[k]; } return null; }
function firstAttachmentUrl(p) {
  const cand = p?.attachments ?? p?.images ?? p?.photos ?? [];
  for (const it of cand) {
    const raw = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
    const u = raw ? unwrapLoginUrl(String(raw)) : null;
    if (u && isUsableImageUrl(u)) return u;
  }
  return null;
}
function buildCover(p) {
  const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;
  const raw = pick(p, [
    'coverUrl','cover_url',
    'repImageUrl','rep_image_url',
    'imageUrl','image_url',
    'thumbnailUrl','thumbnail_url','thumbnail'
  ]) ?? firstAttachmentUrl(p) ?? firstImageFromContent(p);
  const normalized = raw ? withVersion(normalizeCoverUrl(raw), updatedAt) : null;
  const finalUrl = normalized && isUsableImageUrl(normalized) ? normalized : null;
  return finalUrl || ytThumb(p.youtubeId ?? p.youtube_id ?? null) || null;
}

/* ---------------- 유틸 ---------------- */
const ellipsis = (s, n = 48) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1000000) return (x / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1000) return (x / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
};

/* ---------------- 데이터 로더 ---------------- */
async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
const toArr = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.items)) return data.items;
  const firstArray = Object.values(data).find(v => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

/** 최신 레시피(최신순) */
async function loadDailyNewRecipe(size = 8) {
  const qs = new URLSearchParams({ page: '0', size: String(size), sort: 'createdAt,desc' });
  const res = await fetch(`/api/community/posts?${qs}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const j = await res.json();
  const posts = toArr(j);
  return posts.map((p) => ({ ...p, __asPost: true }));
}

/** 인기 커뮤니티 */
async function loadPopularCommunity(size = 8) {
  const PAGE_SIZE_FOR_SCORING = 200;
  try {
    const qs = new URLSearchParams({ page: '0', size: String(PAGE_SIZE_FOR_SCORING), sort: 'popular' });
    const res = await fetch(`/api/community/posts?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const items = (Array.isArray(data) ? data
        : Array.isArray(data?.content) ? data.content
        : Array.isArray(data?.items) ? data.items
        : []);
      return scoreAndPick(items, size);
    }
  } catch (_) {}

  try {
    const qs = new URLSearchParams({ page: '0', size: String(PAGE_SIZE_FOR_SCORING) });
    const res = await fetch(`/api/community/trending?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const items = (Array.isArray(data) ? data
        : Array.isArray(data?.content) ? data.content
        : Array.isArray(data?.items) ? data.items
        : []);
      return scoreAndPick(items, size);
    }
  } catch (_) {}

  try {
    const qs = new URLSearchParams({ page: '0', size: String(PAGE_SIZE_FOR_SCORING), sort: 'createdAt,desc' });
    const res = await fetch(`/api/community/posts?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = (Array.isArray(data) ? data
      : Array.isArray(data?.content) ? data.content
      : Array.isArray(data?.items) ? data.items
      : []);
    return scoreAndPick(items, size);
  } catch {
    return [];
  }
}

/* 점수 계산 + 상위 N개 추림 */
function scoreAndPick(items, size) {
  const now = Date.now();
  const scoreOf = (p) => {
    const likes = Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? p.metrics?.hearts ?? 0);
    const comments = Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0);
    const bookmarks = Number(p.bookmarkCount ?? p.bookmark_count ?? p.bookmarks ?? p.metrics?.bookmarks ?? 0);
    const createdAtMs = new Date(p.createdAt ?? p.created_at ?? p.updatedAt ?? p.updated_at ?? now).getTime();
    const ageHours = Math.max(1, (now - createdAtMs) / 36e5);
    const engagement = likes * 3 + comments * 2 + bookmarks * 1;
    const score = engagement / Math.pow(ageHours, 0.6);
    return { score, likes, comments, bookmarks, createdAtMs };
  };

  return [...(items || [])]
    .map((p) => ({ ...p, __rank: scoreOf(p) }))
    .sort((a, b) => {
      if (b.__rank.score !== a.__rank.score) return b.__rank.score - a.__rank.score;
      const aSum = a.__rank.likes + a.__rank.comments + a.__rank.bookmarks;
      const bSum = b.__rank.likes + b.__rank.comments + b.__rank.bookmarks;
      if (bSum !== aSum) return bSum - aSum;
      if (b.__rank.likes !== a.__rank.likes) return b.__rank.likes - a.__rank.likes;
      if (b.__rank.comments !== a.__rank.comments) return b.__rank.comments - a.__rank.comments;
      if (b.__rank.bookmarks !== a.__rank.bookmarks) return b.__rank.bookmarks - a.__rank.bookmarks;
      return b.__rank.createdAtMs - a.__rank.createdAtMs;
    })
    .slice(0, size);
}

/* ---------------- 오늘의 맞춤 ---------------- */
function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts > 1e12 ? ts : ts * 1000);
  const s = String(ts).trim();
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s, 10) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s, 10));
  if (s.includes(' ') && !s.includes('T')) return new Date(s.replace(' ', 'T'));
  return new Date(s);
}
function isSameLocalDay(ts, base = new Date()) {
  const d = toDate(ts);
  if (!d || isNaN(d)) return false;
  return d.getFullYear() === base.getFullYear()
      && d.getMonth() === base.getMonth()
      && d.getDate() === base.getDate();
}
async function loadBestOfToday() {
  const res = await fetch(`/api/community/posts?page=0&size=200&sort=createdAt,desc`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const items = toArr(j);
  const now = Date.now();

  const enrich = (p) => {
    const likes = Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? p.metrics?.hearts ?? 0);
    const comments = Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0);
    const t = p.createdAt ?? p.created_at ?? p.updatedAt ?? p.updated_at;
    const dt = toDate(t);
    const createdMs = dt && !isNaN(dt) ? dt.getTime() : 0;
    return {
      ...p,
      __cover: buildCover(p),
      __likes: likes,
      __comments: comments,
      __sum: likes + comments,
      __createdMs: createdMs,
      __asPost: true,
    };
  };

  const enriched = items.map(enrich);

  const today = enriched.filter((p) => {
    const t = p.createdAt ?? p.created_at ?? p.updatedAt ?? p.updated_at;
    return t && isSameLocalDay(t);
  });
  if (today.length) {
    return { ...today.sort((a,b)=> b.__sum - a.__sum || b.__createdMs - a.__createdMs)[0], __origin: 'today' };
  }

  const last24Cut = now - 24 * 3600 * 1000;
  const last24 = enriched.filter(p => p.__createdMs >= last24Cut);
  if (last24.length) {
    return { ...last24.sort((a,b)=> b.__sum - a.__sum || b.__createdMs - a.__createdMs)[0], __origin: '24h' };
  }

  if (enriched.length) {
    return { ...enriched.sort((a,b)=> b.__sum - a.__sum || b.__createdMs - a.__createdMs)[0], __origin: 'all' };
  }
  return null;
}

/* ---------------- 가로 스크롤 컨트롤 ---------------- */
function useHScrollControls() {
  const ref = useRef(null);
  const [prev, setPrev] = useState(false);
  const [next, setNext] = useState(false);
  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setPrev(scrollLeft > 2);
    setNext(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);
  const scrollBy = useCallback((dx) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dx, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => { ro.disconnect(); el.removeEventListener('scroll', update); };
  }, [update]);
  return { ref, prev, next, scrollBy };
}

/* ---------------- 브랜드 UI ---------------- */
const BrandButton = ({ outline = false, size = 'md', className = '', style = {}, ...props }) => {
  const sz = {
    md: { fontSize: '1rem',   padding: '10px 16px', minHeight: 44, borderRadius: 12 },
    lg: { fontSize: '1.125rem', padding: '12px 20px', minHeight: 50, borderRadius: 14 },
  }[size] || {};

  const base = {
    borderWidth: 1.5,
    borderColor: BRAND.orange,
    background: outline ? '#fff' : BRAND.orange,
    color: outline ? BRAND.orange : '#fff',
    boxShadow: outline ? '0 0 0 rgba(0,0,0,0)' : '0 8px 18px rgba(255,127,50,0.22)',
    transition: 'transform .15s ease, box-shadow .2s ease, background .2s ease, color .2s ease, border-color .2s ease',
  };

  return (
    <button
      className={`btn ${outline ? 'btn-outline' : ''} ${className}`}
      style={{ ...sz, ...base, ...style }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      {...props}
    />
  );
};
const BrandBadge = ({ tone = 'soft', size = 'sm', children, className = '', style = {}, ...props }) => {
  const styles = useMemo(() => {
    if (tone === 'solid') return { background: BRAND.orange, color: '#fff', borderColor: BRAND.orange };
    if (tone === 'teal')  return { background: BRAND.teal,   color: '#fff', borderColor: BRAND.teal };
    return { background: '#f8f9fa', color: BRAND.ink, borderColor: BRAND.softBd };
  }, [tone]);
  const pad = size === 'lg' ? '8px 12px' : size === 'sm' ? '2px 6px' : '4px 8px';
  const fz  = size === 'lg' ? '1.05rem'  : size === 'sm' ? '0.8rem' : '0.9rem';
  return (
    <span className={`badge border d-inline-flex align-items-center ${className}`}
      style={{ ...styles, borderWidth: 1.5, borderRadius: 9999, padding: pad, fontSize: fz, lineHeight: 1.1, width: 'auto', height: 'auto', ...style }}
      {...props}
    >
      {children}
    </span>
  );
};

/* ---------------- 이미지 컴포넌트 ---------------- */
function SmartImg({ src, alt = '', priority = false, className = '', onError, onLoad }) {
  const width = 800, height = 600;
  return (
    <img
      src={src} alt={alt} width={width} height={height}
      decoding="async" loading={priority ? 'eager' : 'lazy'} fetchpriority={priority ? 'high' : 'low'}
      className={className} referrerPolicy="no-referrer" style={{ objectFit: 'cover' }}
      onError={onError} onLoad={onLoad}
    />
  );
}

/* ---------------- 하단 고정 광고 (커뮤니티와 동일) ---------------- */
function StickyBottomAd({
  id = 'ad-sticky-bottom',
  heightMobile = 80,
  heightDesktop = 120,
  label = 'Bottom Sticky 320×50 / 728×90',
}) {
  const [offset, setOffset] = useState(0);
  const [height, setHeight] = useState(heightDesktop);

  const recompute = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 992px)').matches;
    setHeight(isDesktop ? heightDesktop : heightMobile);

    const sp = document.querySelector('.bottom-nav-spacer');
    const spH = sp ? sp.getBoundingClientRect().height : 0;
    setOffset(isDesktop ? 0 : spH);
  }, [heightDesktop, heightMobile]);

  useEffect(() => {
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
    };
  }, [recompute]);

  return (
    <>
      <div style={{ height: height + 8 }} aria-hidden="true" />
      <div
        id={id}
        className="position-fixed border-top bg-light d-flex align-items-center justify-content-center"
        role="complementary"
        aria-label="하단 광고영역"
        style={{
          left: 0, right: 0,
          bottom: `calc(${offset}px + env(safe-area-inset-bottom))`,
          minHeight: height,
          zIndex: 1040,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
        }}
      >
        <span className="fw-semibold text-secondary text-uppercase small">{label}</span>
      </div>
    </>
  );
}

export default function MainPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const hsc = useHScrollControls();

  const [popLoading, setPopLoading] = useState(true);
  const [popular, setPopular] = useState([]);

  const [dailyNewLoading, setDailyNewLoading] = useState(true);
  const [dailyNewRecipe, setDailyNewRecipe] = useState([]);

  const [bestLoading, setBestLoading] = useState(true);
  const [bestToday, setBestToday] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onCardKey = (e, to) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } };

  const requireLogin = useCallback(async (backTo, onOk) => {
    const safeBack = backTo ?? (window.location.hash ? window.location.hash.slice(1) : (window.location.pathname + window.location.search));
    const me = await ensureLogin(safeBack);
    if (!me) return;
    onOk?.();
  }, []);

  const reloadPopular = useCallback(async () => {
    setPopLoading(true);
    try {
      const arr = await loadPopularCommunity(8);
      const fixed = (Array.isArray(arr) ? arr : []).map(p => ({
        ...p,
        __cover: buildCover(p),
        __likes: Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? p.metrics?.hearts ?? 0),
        __comments: Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0),
        __bookmarks: Number(p.bookmarkCount ?? p.bookmark_count ?? p.bookmarks ?? p.metrics?.bookmarks ?? 0),
      }));
      setPopular(fixed);
    } finally {
      setPopLoading(false);
    }
  }, []);

  const reloadDailyNew = useCallback(async () => {
    setDailyNewLoading(true);
    try {
      const arr = await loadDailyNewRecipe(8);
      const fixed = (Array.isArray(arr) ? arr : []).map(r => ({
        ...r,
        __cover: buildCover(r),
        __likes: Number(r.likeCount ?? r.like_count ?? r.likes ?? r.hearts ?? r.metrics?.likes ?? r.metrics?.hearts ?? 0),
        __comments: Number(r.commentCount ?? r.comment_count ?? r.comments ?? r.metrics?.comments ?? 0),
      }));
      setDailyNewRecipe(fixed);
    } finally {
      setDailyNewLoading(false);
    }
  }, []);

  const reloadBestToday = useCallback(async () => {
    setBestLoading(true);
    try {
      const best = await loadBestOfToday();
      setBestToday(best);
    } finally {
      setBestLoading(false);
    }
  }, []);

  useEffect(() => { reloadPopular(); }, [reloadPopular]);
  useEffect(() => { reloadDailyNew(); }, [reloadDailyNew]);
  useEffect(() => { reloadBestToday(); }, [reloadBestToday]);

  useEffect(() => {
    const refreshAll = () => { reloadPopular(); reloadDailyNew(); reloadBestToday(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll(); };
    const onFocus = () => refreshAll();
    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key.startsWith('rf:activity:') || e.key.startsWith('postBookmark:') || e.key.startsWith('postBookmarkData:') || e.key.startsWith('recipe:')) {
        refreshAll();
      }
    };
    window.addEventListener('activity:changed', refreshAll);
    window.addEventListener('bookmark-changed', refreshAll);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('activity:changed', refreshAll);
      window.removeEventListener('bookmark-changed', refreshAll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [reloadPopular, reloadDailyNew, reloadBestToday]);

  return (
    <div className="container-xxl py-3">
      <TopSearchBar onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)} />

      <main className="row g-4 mt-1">
        <section className="col-12">
          {/* === HERO: 심플 & 큰 핵심 포인트 === */}
          <section
            className="rounded-4 border p-4 p-lg-5"
            style={{ background: BRAND.softBg, borderColor: BRAND.softBd }}
          >
            <div className="row align-items-center g-4">
              <div className="col-12 col-lg-7">
                <h1 className="fw-bold mb-2" style={{ color: BRAND.ink, fontSize: '2rem' }}>
                  <span style={{ color: BRAND.orange }}>Recip</span>
                  <span style={{ color: BRAND.teal }}>Free</span> — 자유롭게, 그러나 건강하게
                </h1>
                <p className="mb-3" style={{ color: BRAND.mute, fontSize: '1.05rem' }}>
                  최소한의 입력으로, 당신에게 꼭 맞는 건강 레시피.
                </p>

                {/* 큼직한 핵심 포인트(배지 대신 큰 필) */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <BrandBadge size="lg">🍽️ 집밥 기준의 손쉬운 조리</BrandBadge>
                  <BrandBadge size="lg">🧂 나트륨·정제당 최소화</BrandBadge>
                  <BrandBadge size="lg">🥗 자연스러운 단맛·건강한 기름</BrandBadge>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <BrandButton onClick={() => requireLogin('/input', () => navigate('/input'))}>
                    나만의 레시피 시작하기
                  </BrandButton>
                  <BrandButton outline className="ms-1" onClick={() => navigate('/community')}>
                    커뮤니티 구경
                  </BrandButton>
                </div>
              </div>

              {/* 오늘의 맞춤 카드 */}
              <div className="col-12 col-lg-5">
                <div
                  className="card shadow-sm border-0"
                  role="button"
                  tabIndex={0}
                  onClick={() => bestToday && navigate(`/community/${bestToday.id}`)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && bestToday) { e.preventDefault(); navigate(`/community/${bestToday.id}`); } }}
                  aria-label="오늘의 맞춤 보기"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
                >
                  <div className="card-header bg-white border-0 d-flex align-items-center gap-2">
                    <BrandBadge tone="solid">오늘의 맞춤</BrandBadge>
                    <span className="small" style={{ color: BRAND.mute }}>오늘 가장 반응이 좋은 글</span>
                  </div>
                  <div className="ratio ratio-4x3 bg-light position-relative rounded-top">
                    {bestLoading ? (
                      <div className="w-100 h-100 rounded-top placeholder" />
                    ) : bestToday?.__cover ? (
                      <SmartImg
                        src={bestToday.__cover}
                        alt=""
                        priority
                        className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    {bestToday?.__likes >= 0 && bestToday?.__comments >= 0 && (
                      <BrandBadge tone="teal" size="sm" className="position-absolute top-0 start-0 m-2" style={{ zIndex: 2 }}>
                        ❤ {fmtNum(bestToday.__likes)} · 💬 {fmtNum(bestToday.__comments)}
                      </BrandBadge>
                    )}
                  </div>
                  <div className="card-body">
                    <h3 className="h5 fw-semibold mb-1" style={{ color: BRAND.ink }}>
                      {bestLoading ? <span className="placeholder col-8" style={{ display:'inline-block', height:22 }} /> : ellipsis(bestToday?.title || '오늘의 추천', 48)}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ✅ 지금 인기 커뮤니티 */}
          <section className="mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 fw-bold m-0" style={{ color: BRAND.ink }}>지금 인기 커뮤니티</h2>
              <div className="d-flex gap-2">
                <BrandButton outline className="btn-sm" onClick={() => navigate('/community?tab=all&sort=popular')}>
                  더보기
                </BrandButton>
              </div>
            </div>

            {popLoading ? (
              <div className="row g-3">
                {Array.from({ length: 4 }).map((_, i) => (
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
            ) : popular.length === 0 ? (
              <div className="alert alert-light border small">아직 인기 게시글이 없어요. 첫 글을 올려보세요!</div>
            ) : (
              <div className="row g-3">
                {popular.slice(0, 8).map((p, i) => {
                  const to = `/community/${p.id}`;
                  const priority = i < 4;
                  return (
                    <div className="col-12 col-sm-6 col-lg-3" key={p.id}>
                      <article
                        className="card h-100 shadow-sm"
                        onClick={() => navigate(to)}
                        onKeyDown={(e) => onCardKey(e, to)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${p.title || '게시글'} 보기`}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
                      >
                        <div className="position-relative">
                          <div className="ratio ratio-4x3 bg-light rounded-top">
                            {p.__cover && (
                              <SmartImg
                                src={p.__cover}
                                alt=""
                                priority={priority}
                                className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                          </div>
                          {p.__likes > 0 && (
                            <BrandBadge tone="teal" className="position-absolute top-0 start-0 m-2">
                              ❤ {fmtNum(p.__likes)}
                            </BrandBadge>
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
          </section>

          {/* ✅ 매일매일 새로운 레시피 (최신순) */}
          <section className="mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 fw-bold m-0" style={{ color: BRAND.ink }}>매일매일 새로운 레시피</h2>
              <div className="d-flex gap-2">
                <BrandButton outline className="btn-sm" onClick={() => setModalOpen(true)}>
                  전체 보기
                </BrandButton>
              </div>
            </div>

            {dailyNewLoading ? (
              <div className="row g-3">
                {Array.from({ length: 4 }).map((_, i) => (
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
            ) : dailyNewRecipe.length === 0 ? (
              <div className="alert alert-light border small">아직 등록된 레시피가 없어요. 첫 레시피를 올려보세요!</div>
            ) : (
              <div className="row g-3">
                {dailyNewRecipe.slice(0, 8).map((r, i) => {
                  const to = r.__asPost ? `/community/${r.id}` : `/recipe/${r.id}`;
                  const priority = i < 4;
                  return (
                    <div className="col-12 col-sm-6 col-lg-3" key={r.id}>
                      <article
                        className="card h-100 shadow-sm"
                        onClick={() => navigate(to)}
                        onKeyDown={(e)=> onCardKey(e, to)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${r.title || '레시피'} 보기`}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
                      >
                        <div className="position-relative">
                          <div className="ratio ratio-4x3 bg-light rounded-top">
                            {r.__cover && (
                              <SmartImg
                                src={r.__cover}
                                alt=""
                                priority={priority}
                                className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="card-body">
                          <h3 className="h6 fw-semibold mb-1" style={{ color: BRAND.ink }}>
                            {ellipsis(r.title || `레시피 #${r.id}`, 48)}
                          </h3>
                          <div className="small d-flex align-items-center gap-3" style={{ color: BRAND.mute }}>
                            <span aria-label={`좋아요 ${r.__likes}개`}>❤ {fmtNum(r.__likes)}</span>
                            <span aria-label={`댓글 ${r.__comments}개`}>💬 {fmtNum(r.__comments)}</span>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </main>

      {/* 사이트 푸터 */}
      <SiteFooter />

      {/* 하단 고정 띠배너 광고 + 네비게이션 (커뮤니티와 동일 순서/구조) */}
      <StickyBottomAd label="Bottom Sticky 320×50 / 728×90" />
      <BottomNav />
      <div className="bottom-nav-spacer" aria-hidden="true" />

      {/* 모달: 최신 레시피 전체보기 */}
      <div className={`modal fade ${modalOpen ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" aria-hidden={!modalOpen} onClick={() => setModalOpen(false)}>
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" style={{ color: BRAND.ink }}>매일매일 새로운 레시피</h5>
              <button type="button" className="btn-close" onClick={() => setModalOpen(false)} />
            </div>

            <div className="modal-body">
              <ModalScroller dailyNewRecipe={dailyNewRecipe} onNavigate={navigate} onCardKey={onCardKey} hsc={hsc} />
            </div>

            <div className="modal-footer">
              <BrandButton outline onClick={() => setModalOpen(false)}>닫기</BrandButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 모달 내부 가로 스크롤 카드 */
function ModalScroller({ dailyNewRecipe, onNavigate, onCardKey, hsc }) {
  return (
    <div className="position-relative">
      <button
        type="button"
        className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm"
        aria-label="이전"
        disabled={!hsc.prev}
        onClick={() => hsc.scrollBy(-320)}
        style={{ zIndex: 2, borderColor: BRAND.softBd }}
      >‹</button>

      <div
        className="d-grid gap-3 overflow-auto px-1"
        ref={hsc.ref}
        role="list"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') hsc.scrollBy(-320);
          if (e.key === 'ArrowRight') hsc.scrollBy(320);
        }}
        style={{
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(240px, 280px)',
          scrollSnapType: 'x mandatory'
        }}
      >
        {(dailyNewRecipe.length ? dailyNewRecipe : Array.from({length:8}).map((_,i)=>({id:`sk-${i}`}))).map((r, i) => (
          <article
            key={r.id ?? i}
            className="card shadow-sm h-100"
            role="listitem"
            style={{ scrollSnapAlign: 'start', contentVisibility: 'auto', containIntrinsicSize: '600px' }}
            tabIndex={0}
            onClick={() => r.id && onNavigate(r.__asPost ? `/community/${r.id}` : `/recipe/${r.id}`)}
            onKeyDown={(e)=> r.id && onCardKey(e, r.__asPost ? `/community/${r.id}` : `/recipe/${r.id}`)}
            aria-label={`${r.title || '레시피'} 보기`}
          >
            <div className="position-relative">
              <div className="ratio ratio-4x3 bg-light rounded-top">
                {r.__cover && (
                  <SmartImg
                    src={r.__cover}
                    alt=""
                    priority={false}
                    className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
            <div className="card-body">
              <h3 className="h6 fw-semibold mb-1" style={{ color: BRAND.ink }}>
                {r.title ? ellipsis(r.title, 48) : <span className="placeholder col-8" style={{ display:'inline-block', height:18 }} />}
              </h3>
              <p className="small mb-0" style={{ color: BRAND.mute }}>
                {r.id ? '방금 올라온 레시피' : <span className="placeholder col-6" style={{ display:'inline-block', height:14 }} />}
              </p>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm"
        aria-label="다음"
        disabled={!hsc.next}
        onClick={() => hsc.scrollBy(320)}
        style={{ zIndex: 2, borderColor: BRAND.softBd }}
      >›</button>
    </div>
  );
}
