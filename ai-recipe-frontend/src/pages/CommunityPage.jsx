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

/* ------------ 이미지 프록시 유틸 ------------- */
const PROXY = '/api/img-proxy?u=';
const toProxied = (u) => (u ? PROXY + encodeURIComponent(u) : null);

function toSafeSrc(u) {
  try {
    const url = new URL(u, window.location.origin);
    // 같은 오리진(상대경로 포함)은 그대로 사용
    if (url.origin === window.location.origin) return url.toString();
    // 외부(https/http)는 Netlify 이미지 프록시로 래핑
    return toProxied(url.toString()); // == '/api/img-proxy?u=' + encodeURIComponent(...)
  } catch {
    return typeof u === 'string' ? u : '';
  }
}

function isAllowedCoverHost() {
  return true;   // 모든 호스트 허용
}

// 🔎 프로필/아바타/로고로 보이는 URL 걸러내기
function isLikelyAvatarOrLogo() {
  return false; // 테스트용
}

/* ------------ 이미지 URL 유틸 ------------- */
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

function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    let raw = unwrapLoginUrl(url);
    if (raw.startsWith('/')) return raw;
    const u = new URL(raw, window.location.origin);
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

function isUsableImageUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (/\/(auth|login)/i.test(u.pathname.toLowerCase())) return false;
  // ⚠️ HTTP 외부라도 일단 통과 → normalizeCoverUrl()에서 https로 승격 시도
    // http/https, data:, / 전부 일단 통과 → 나중에 toSafeSrc에서 http를 프록시로 래핑
   return /^https?:/.test(u.href) || u.href.startsWith('data:') || u.href.startsWith('/');
  } catch {
    return false;
  }
}


// function extractImagesFromAttachments(p, maxImages = 3) {
//   const arr = p?.attachments ?? p?.images ?? p?.photos ?? [];
//   const out = [];
//   for (const it of (Array.isArray(arr) ? arr : [])) {
//     if (out.length >= maxImages) break;
//     const u = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
//     const cleaned = u ? unwrapLoginUrl(u) : null;
//     if (cleaned && isUsableImageUrl(cleaned) && !isLikelyAvatarOrLogo(cleaned)) {
//     out.push(cleaned);
//     }
//   }
//   return out;
// }

function collectCoverCandidates(post) {
  try {
    const updatedAt =
      post.updatedAt ?? post.updated_at ?? post.createdAt ?? post.created_at ?? null;

    // 아바타/프로필로 의심되는 것들 미리 제외
    const ban = new Set(
      [
        post.authorAvatar ?? post.author_avatar ?? null,
        post.userAvatar ?? null,
        post.profileImage ?? null,
        post.repImageUrl ?? post.rep_image_url ?? null, // 서버 오입력 대비
      ]
        .filter(Boolean)
        .map(String)
    );

    // 1) 직접 필드에서 1차 후보
    const direct = [
      post.coverUrl ?? post.cover_url ?? null,
      post.coverImage ?? post.cover_image ?? null,
      post.thumbnail ?? post.thumbUrl ?? post.thumb_url ?? null,
      post.imageUrl ?? post.image_url ?? null,
      post.repImageUrl ?? post.rep_image_url ?? null,
    ].filter(Boolean);

    // 2) 첨부/본문에서 추가 후보
    // const fromAttachments = extractImagesFromAttachments(post, 5);

    // 3) 유튜브 썸네일
    const ytId = post.youtubeId ?? post.youtube_id ?? null;
    const yt = ytThumb(ytId);

    const candidatesRaw = [
      ...direct,
      ...(yt ? [yt] : []),
      // ...fromAttachments,
      // ...fromContent,
    ]
      .filter(Boolean)
      .map(String)
      .filter((u) => !ban.has(u));

    const normalized = candidatesRaw
      .map((u) => withVersion(normalizeCoverUrl(u), updatedAt))
      .filter(Boolean)
      .filter((u) => !isLikelyAvatarOrLogo(u))
      .filter((u) => isAllowedCoverHost(u))
      .map(toSafeSrc)
      .filter((u) => typeof u === 'string' && u.length > 0); 

    if (localStorage.getItem('rf:debug') === '1') {
      console.log('[covers:normalized]', post.id, normalized);
    }

    // 중복 제거(대소문자 무시)
    const seen = new Set();
    const unique = [];
    for (const u of normalized) {
      const key = u.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(u);
      }
    }
    return unique;
  } catch (e) {
    console.error('[collectCoverCandidates] error:', e);
    return [];
  }
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
   if (!s) return '이미지 첨부';

  // 문장 단위로 최대 3문장만 남기기
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, 3);
  s = sentences.join(' ');

  // 전체 길이가 너무 길면 일부만 잘라서 …
  if (s.length > maxLen) s = s.slice(0, maxLen).trim() + '…';
  return s
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
  const [avatarish, setAvatarish] = useState(false);
  const src = sources?.[idx] || null;
  if (!src) return null;

   const width = avatarish ? 36 : 800;
   const height = avatarish ? 36 : 600;

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
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < (sources?.length || 0)) setIdx(idx + 1);
        else if (onHide) onHide();
      }}
       onLoad={(e) => {
       const nw = e.currentTarget.naturalWidth || 0;
       const nh = e.currentTarget.naturalHeight || 0;
       // 작거나(둘 중 하나라도 160px 미만) + 정사각형에 가까우면(아이콘/아바타 패턴)
       const isSmall = nw < 160 || nh < 160;
       const isSquareish = Math.abs(nw - nh) <= 6;
       if (isSmall && isSquareish) {
         setAvatarish(true);
       } else {
         setAvatarish(false);
       }
     }}

     style={{
       objectFit: 'cover',
       // 아바타로 판별되면 카드 전체가 아니라 작은 썸네일로 축소
       width: avatarish ? 96 : '100%',
       height: avatarish ? 96 : undefined,
       borderRadius: avatarish ? 8 : 0,
       margin: avatarish ? '8px auto' : 0,
       display: 'block',
     }}
    />
  );
}

function PostCard({ post, onOpen, priority = false, dateFmt }) {
  const rawForPreview = post.preview || post.bodyPreview || post.content || post.body || '';
  const preview = makePreviewText(rawForPreview, 140);
  const when = dateFmt.format(new Date(post.createdAt || post.updatedAt || Date.now()));

  // 🔁 SmartImg 대체(인라인) — 후보 순회 + onError 폴백
  const [showImg, setShowImg] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const imgSources = (post.__covers || []).filter(u => !isLikelyAvatarOrLogo(u));
  const imgSrc = imgSources[imgIdx];

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
            {(post.tags || []).slice(0, 3).map((t) => (
              <span key={t} className="badge rounded-pill bg-light text-dark border">#{t}</span>
            ))}
            {(post.tags?.length ?? 0) > 3 && (
              <span className="badge rounded-pill bg-light text-secondary border">…</span>
            )}
          </div>
          <span className="small text-secondary">{when}</span>
        </div>
      </div>

      {/* 🔽 이미지 인라인 렌더 (SmartImg 대체) */}
      {showImg && imgSrc && (
        <img
          src={imgSrc}
          alt={post.title || 'cover'}
          className="card-img-bottom"
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchpriority={priority ? 'high' : 'low'}
          referrerPolicy="no-referrer"
          style={{ objectFit: 'cover', width: '100%', display: 'block' }}
          onError={() => {
            // 다음 후보로 폴백, 없으면 감춤
            if (imgIdx + 1 < imgSources.length) setImgIdx(imgIdx + 1);
            else setShowImg(false);
          }}
        />
      )}
    </article>
  );
}

/* ------------ 하단 고정 광고 ------------ */
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
          left: 0,
          right: 0,
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

function MobileWriteMiniBtnTopRight({ onClick }) {
  const [top, setTop] = useState(12);

  const recompute = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 992px)').matches;
    if (isDesktop) return;

    // 헤더(사이트 상단바) 바로 아래로 붙이기
    const header = document.querySelector('.site-header, header.sticky-top, .navbar');
    const rect = header ? header.getBoundingClientRect() : null;
    const headerBottom = rect ? rect.bottom : 0;

    // 기본 여유 8px + 노치 대응
    const gap = 8;
    setTop(Math.max(8, headerBottom + gap));
  }, []);

  useEffect(() => {
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    const onVis = () => { if (document.visibilityState === 'visible') recompute(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [recompute]);

  return (
    <button
      type="button"
      className="btn btn-success btn-sm d-lg-none mobile-write-mini"
      onClick={onClick}
      aria-label="글쓰기"
      title="글쓰기"
      style={{
        position: 'fixed',
        right: '12px',
        top: `calc(${top}px + env(safe-area-inset-top))`,
        zIndex: 1101,
        borderRadius: 9999,
        padding: '6px 10px',
        lineHeight: 1
      }}
    >
      🖋️
    </button>
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

  // ✅ 글쓰기: 로그인 요구 후 /write 이동
  const onWrite = useCallback(async () => {
    const me = await ensureLogin('/community');
    if (!me) return;
    navigate('/write');
  }, [navigate]);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();

      // ✅ 응답 형태 호환: Array | {content[]} | {items[]}
      const arr =
        Array.isArray(list) ? list
        : Array.isArray(list?.content) ? list.content
       : Array.isArray(list?.items) ? list.items
        : [];

      // ✅ 총 개수/마지막 페이지 판단
      const totalElements =
        typeof list?.totalElements === 'number' ? list.totalElements
        : typeof list?.total === 'number' ? list.total
        : arr.length;
      const isLast =
        typeof list?.last === 'boolean' ? list.last
        : ((pageToLoad + 1) * size >= totalElements);

      const fixed = arr.map(p => {
        const covers = collectCoverCandidates(p);
        // created_at/updated_at 케이스도 호환
        const createdAt = p.createdAt ?? p.created_at ?? null;
        const updatedAt = p.updatedAt ?? p.updated_at ?? null;
        return {
          ...p,
          createdAt,
          updatedAt,
          ...extractCounts(p),
          __covers: covers,
        };
      });

      if (pageToLoad === 0) setPosts(fixed);
      else setPosts(prev => [...prev, ...fixed]);

      setHasMore(!isLast);
      setPage(pageToLoad);
    } catch (e) {
      console.error(e);
      if (pageToLoad === 0) { setPosts([]); setHasMore(false); }
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
    <div className="container-xxl py-3 community-page">
      {/* 헤더 */}
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

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={sort}
              onChange={(e) => { setSort(e.target.value); syncQuery({ sort: e.target.value }); }}
              aria-label="정렬"
            >
              <option value="new">최신순</option>
            </select>
          </div>

          <div className="col-6 col-lg-2">
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

          {/* ✅ 글쓰기 버튼 (데스크톱 표시) */}
          <div className="col-12 col-lg-2 d-none d-lg-block">
            <div className="d-grid">
              <button type="button" className="btn btn-success" onClick={onWrite}>
                🖋️ 글쓰기
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 본문 */}
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

      {/* ✅ 모바일 FAB */}
      <MobileWriteMiniBtnTopRight onClick={onWrite} />

      {/* 하단 고정 광고 + 네비게이션 */}
      <StickyBottomAd label="Bottom Sticky 320×50 / 728×90" />
      <BottomNav />
      <div className="bottom-nav-spacer" aria-hidden="true" />
    </div>
  );
}
