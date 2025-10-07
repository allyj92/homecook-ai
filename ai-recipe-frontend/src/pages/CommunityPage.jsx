// src/pages/CommunityPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureLogin } from '../lib/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
import '../index.css';

/* ------------ 공통 유틸 ------------- */
const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
};

function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ------------ 이미지 URL 유틸 ------------- */
// 로그인 래퍼 URL에서 실제 목적지 꺼내기
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
  } catch { /* ignore */ }
  return url;
}

function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    let raw = unwrapLoginUrl(url);
    if (raw.startsWith('/')) return raw;
    const u = new URL(raw, window.location.origin);
    if (window.location.protocol === 'https:' && u.protocol === 'http:') {
      try { u.protocol = 'https:'; } catch { /* ignore */ }
    }
    if (u.host === window.location.host) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch {
    return url;
  }
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

// 로그인/혼합콘텐츠/형식 등 필터
function isUsableImageUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (/\/(auth|login)/i.test(u.pathname.toLowerCase())) return false;
    const isHttpsPage = window.location.protocol === 'https:';
    const isExternal = u.host !== window.location.host;
    if (isHttpsPage && isExternal && u.protocol === 'http:') return false;
    return /^https?:/.test(u.href) || u.href.startsWith('data:') || u.href.startsWith('/');
  } catch {
    return false;
  }
}

/* ---- 본문/첨부에서 이미지 후보 추출 ---- */
function extractImagesFromContent(p, maxChars = 32 * 1024, maxImages = 3) {
  let s = String(p?.content ?? p?.body ?? p?.html ?? '').trim();
  if (!s) return [];
  if (s.length > maxChars) s = s.slice(0, maxChars);

  const out = [];
  const push = (u) => {
    if (!u || out.length >= maxImages) return;
    const cleaned = unwrapLoginUrl(String(u).trim());
    if (isUsableImageUrl(cleaned)) out.push(cleaned);
  };

  s.replace(/!\[[^\]]*]\(([^)]+)\)/g, (_m, u) => push((u || '').split('"')[0]));
  s.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_m, u) => push(u));
  s.replace(/<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi, (_m, u) => push(u));
  s.replace(/<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi, (_m, list) => {
    const first = String(list || '').split(',')[0].trim().split(' ')[0];
    push(first);
  });

  return out;
}

function extractImagesFromAttachments(p, maxImages = 3) {
  const arr = p?.attachments ?? p?.images ?? p?.photos ?? [];
  const out = [];
  for (const it of (Array.isArray(arr) ? arr : [])) {
    if (out.length >= maxImages) break;
    const u = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
    const cleaned = u ? unwrapLoginUrl(u) : null;
    if (cleaned && isUsableImageUrl(cleaned)) out.push(cleaned);
  }
  return out;
}

function collectCoverCandidates(post) {
  const updatedAt = post.updatedAt ?? post.updated_at ?? post.createdAt ?? post.created_at ?? null;
  const candidatesRaw = [
    post.coverUrl ?? post.cover_url ?? null,
    post.repImageUrl ?? post.rep_image_url ?? null,
    ...extractImagesFromAttachments(post, 3),
    ...extractImagesFromContent(post, 32 * 1024, 3),
    ytThumb(post.youtubeId ?? post.youtube_id ?? null),
  ].filter(Boolean);

  const normalized = candidatesRaw
    .map((u) => withVersion(normalizeCoverUrl(u), updatedAt))
    .filter(Boolean)
    .filter(isUsableImageUrl);

  const seen = new Set();
  const unique = [];
  for (const u of normalized) {
    const key = u.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(u); }
  }
  return unique;
}

/* ------------ 프리뷰 텍스트 ------------ */
function makePreviewText(input, maxLen = 120) {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_m, alt) => (alt || '').trim());
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text) => (text || '').trim());
  s = s.replace(/<img[^>]*alt=["']?([^"'>]*)["']?[^>]*>/gi, (_m, alt) => (alt || '').trim());
  s = s.replace(/<a[^>]*>(.*?)<\/a>/gi, (_m, inner) => (inner || '').trim());
  s = s.replace(/\bhttps?:\/\/[^\s)]+/gi, '');
  s = s.replace(/\bwww\.[^\s)]+/gi, '');
  s = s.replace(/<\/?[^>]+>/g, ' ');
  s = s.replace(/[#>*`_~\-]{1,}/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) s = '이미지 첨부';
  if (s.length > maxLen) s = s.slice(0, maxLen) + '…';
  return s;
}

/* ------------ 배지 ------------ */
function Badge({ children, tone = 'gray' }) {
  const map = {
    brand: 'text-bg-primary',
    line: 'bg-light text-dark border',
    gray: 'text-bg-secondary',
  };
  const cls = map[tone] || map.gray;
  return <span className={`badge rounded-pill ${cls}`}>{children}</span>;
}

function extractCounts(p) {
  const likeCount =
    p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? p.metrics?.hearts ?? 0;
  const commentCount =
    p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0;
  const bookmarkCount =
    p.bookmarkCount ?? p.bookmark_count ?? p.bookmarks ?? p.metrics?.bookmarks ?? 0;
  return {
    __likes: Number(likeCount || 0),
    __comments: Number(commentCount || 0),
    __bookmarks: Number(bookmarkCount || 0),
  };
}

/* ------------ 이미지 후보 자동 폴백 + 성능 힌트 ------------ */
function SmartImg({ sources, alt = '', className = '', onHide, priority = false }) {
  const [idx, setIdx] = useState(0);
  const src = sources?.[idx] || null;
  if (!src) return null;

  const width = 800;  // 레이아웃 안정 힌트
  const height = 600;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : 'low'}
      onError={() => {
        if (idx + 1 < (sources?.length || 0)) setIdx(idx + 1);
        else if (onHide) onHide();
      }}
      style={{ objectFit: 'cover' }}
    />
  );
}

function PostCard({ post, onOpen, priority = false, dateFmt }) {
  const rawForPreview = post.preview || post.bodyPreview || post.content || post.body || '';
  const preview = makePreviewText(rawForPreview, 140);
  const when = dateFmt.format(new Date(post.createdAt || post.updatedAt || Date.now()));
  const [showImg, setShowImg] = useState(true);

  return (
    <article className="card shadow-sm mb-3">
      <div className="card-body position-relative">
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {post.pinned && <Badge tone="brand">고정</Badge>}
            {post.category && <Badge tone="line">{post.category}</Badge>}
            <a
              href={`/community/${post.id}`}
              className="stretched-link text-decoration-none fw-bold h6 mb-0"
              onClick={(e) => { e.preventDefault(); onOpen?.(); }}
            >
              {post.title}
            </a>
          </div>
          <div className="text-secondary small d-inline-flex gap-2">
            <span title="좋아요">❤ {fmtNum(post.__likes)}</span>
            <span title="댓글">💬 {fmtNum(post.__comments)}</span>
            <span title="북마크">📌 {fmtNum(post.__bookmarks)}</span>
          </div>
        </div>

        {preview && (
          <p className="text-body-secondary small mb-2 mt-2">{preview}</p>
        )}

        <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
          <div className="d-flex flex-wrap gap-2">
            {(post.tags || []).map((t) => (
              <span key={t} className="badge rounded-pill bg-light text-dark border">#{t}</span>
            ))}
          </div>
          <span className="small text-secondary">{when}</span>
        </div>
      </div>

      {showImg && post.__covers?.length > 0 && (
        <SmartImg
          sources={post.__covers}
          className="card-img-bottom"
          onHide={() => setShowImg(false)}
          priority={priority}
        />
      )}
    </article>
  );
}

/* ------------ 하단 고정 광고 (메인과 동일 스타일) ------------ */
function StickyBottomAd({
  id = 'ad-sticky-bottom',
  heightMobile = 80,
  heightDesktop = 120,
  label = 'Bottom Sticky',
}) {
  const [offset, setOffset] = useState(0);        // 하단 네비 높이(보일 때만)
  const [height, setHeight] = useState(heightDesktop);

  const recompute = useCallback(() => {
    // Bootstrap 기준: lg(>=992px)부터 데스크탑
    const isDesktop = window.matchMedia('(min-width: 992px)').matches;
    setHeight(isDesktop ? heightDesktop : heightMobile);

    // 하단 네비가 있다면 spacer 높이로 오프셋 계산 (없으면 0)
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
      {/* 본문 가림 방지용 여백(광고 높이만큼) */}
      <div style={{ height: height + 8 }} aria-hidden="true" />

      {/* 풀블리드 하단 고정 */}
      <div
        id={id}
        className="position-fixed border-top bg-light d-flex align-items-center justify-content-center"
        role="complementary"
        aria-label="하단 광고영역"
        style={{
          left: 0,
          right: 0,
          // 모바일: 네비 높이만큼 올림, 데스크탑: 0으로 바닥에 딱
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

export default function CommunityPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [tab, setTab] = useState(params.get('tab') ?? 'all');
  const [sort, setSort] = useState(params.get('sort') ?? 'new');

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const size = 12;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }), []);

  const tabToCategory = (t) => {
    if (t === 'question') return '질문';
    if (t === 'review') return '후기';
    if (t === 'recipe') return '레시피';
    return '';
  };

  const load = useCallback(async (pageToLoad = 0, tabToLoad = tab) => {
    setLoading(true);
    try {
      const category = tabToCategory(tabToLoad);
      const qs = new URLSearchParams({
        page: String(pageToLoad),
        size: String(size),
        ...(category ? { category } : {}),
      });
      const res = await fetch(`/api/community/posts?${qs.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', 'Accept': 'application/json' },
      });
      const list = await res.json();
      const arr = Array.isArray(list) ? list : (Array.isArray(list?.items) ? list.items : []);

      const fixed = arr.map(p => {
        const covers = collectCoverCandidates(p);
        return {
          ...p,
          ...extractCounts(p),
          __covers: covers,
        };
      });

      if (pageToLoad === 0) setPosts(fixed);
      else setPosts(prev => [...prev, ...fixed]);

      setHasMore(arr.length === size);
      setPage(pageToLoad);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { load(0, tab); }, [load, tab]);

  function syncQuery(next = {}) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v == null ? merged.delete(k) : merged.set(k, String(v))));
    setParams(merged, { replace: true });
  }

  // refresh 이벤트 필터링 + 디바운스
  useEffect(() => {
    const refresh = debounce(() => load(0, tab), 300);

    const onStorage = (e) => {
      const k = e?.key || '';
      if (k.startsWith('rf:activity:') || k.startsWith('postBookmark:') || k.startsWith('postBookmarkData:')) {
        refresh();
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };

    window.addEventListener('activity:changed', refresh);
    window.addEventListener('bookmark-changed', refresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('activity:changed', refresh);
      window.removeEventListener('bookmark-changed', refresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, tab]);

  const filtered = useMemo(() => {
    let arr = posts;
    if (q) {
      const k = q.toLowerCase();
      arr = arr.filter((p) =>
        [p.title, p.content, ...(p.tags || [])].join(' ').toLowerCase().includes(k)
      );
    }
    if (sort === 'new') {
      arr = [...arr].sort(
        (a, b) =>
          new Date(b.createdAt || b.updatedAt || 0).getTime() -
          new Date(a.createdAt || a.updatedAt || 0).getTime()
      );
    }
    return arr;
  }, [posts, q, sort]);

  return (
    <div className="container-xxl py-3">
      {/* 헤더: 검색/필터만 유지 (탑 배너 제거) */}
      <header className="mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-6">
            <div className="input-group">
              <input
                className="form-control"
                placeholder="검색: 제목, 태그, 내용…"
                value={q}
                onChange={(e) => { setQ(e.target.value); syncQuery({ q: e.target.value }); }}
              />
              {q && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setQ(''); syncQuery({ q: null }); }}
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <select
              className="form-select"
              value={sort}
              onChange={(e) => { setSort(e.target.value); syncQuery({ sort: e.target.value }); }}
              aria-label="정렬"
            >
              <option value="new">최신순</option>
            </select>
          </div>

          <div className="col-6 col-lg-3">
            <select
              className="form-select"
              value={tab}
              onChange={(e) => { setTab(e.target.value); syncQuery({ tab: e.target.value }); }}
              aria-label="탭"
            >
              <option value="all">전체</option>
              <option value="question">질문</option>
              <option value="review">후기</option>
              <option value="recipe">레시피</option>
            </select>
          </div>
        </div>
      </header>

      {/* 본문: 사이드 영역/인피드 광고 제거, 단일 컬럼 */}
      <main className="row g-4">
        <section className="col-12">
         <div className="content-narrow">
          {filtered.length === 0 && !loading && (
            <div className="alert alert-secondary" role="status">
              게시글이 없습니다. 먼저 글을 작성해 보세요!
            </div>
          )}

          {filtered.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              priority={i < 3}
              dateFmt={dateFmt}
              onOpen={() => navigate(`/community/${p.id}`)}
            />
          ))}

          <div className="d-flex justify-content-center my-3">
            <button
              className="btn btn-outline-secondary"
              disabled={loading || !hasMore}
              onClick={() => load(page + 1, tab)}
            >
              {loading ? '불러오는 중…' : hasMore ? '더 불러오기' : '더 이상 없음'}
            </button>
          </div>
          </div>
        </section>
      </main>

      <footer className="text-center text-secondary mt-4">
        <div className="small">
          * 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        </div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      {/* 하단 고정 광고 + 네비게이션 */}
      <StickyBottomAd label="Bottom Sticky 320×50 / 728×90" />
      <BottomNav />
      <div className="bottom-nav-spacer" aria-hidden="true" />
    </div>
  );
}
