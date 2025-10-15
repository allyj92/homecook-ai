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

/* ------------ 썸네일/프리뷰 유틸 ------------- */
const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);

/** 의미 없는 이미지 대체 텍스트인지 판단 */
function isGenericAlt(altRaw = '') {
  const alt = String(altRaw).trim().toLowerCase();
  if (!alt) return true;
  // 흔한 제너릭 토큰/패턴
  const genericWords = [
    'image','img','photo','picture','screenshot','thumbnail','thumb','cover',
    '이미지','사진','스크린샷','섬네일','썸네일','표지'
  ];
  if (genericWords.includes(alt)) return true;
  // 파일명/기기캡처 패턴
  if (/^(img|image|photo|screenshot)[-_ ]?\d+/i.test(alt)) return true;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|heic|heif)$/i.test(alt)) return true;
  // 너무 짧은(잡음) alt
  if (alt.length <= 2) return true;
  return false;
}

/** 카드용 본문 프리뷰 생성 */
function makePreviewText(input, maxLen = 120) {
  if (!input) return '';

  let s = String(input);

  // 1) 마크다운 이미지: alt가 의미 있을 때만 남기고, 아니면 제거
  s = s.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_m, alt) => {
    return isGenericAlt(alt) ? ' ' : (` ${String(alt).trim()} `);
  });

  // 2) HTML IMG: alt가 의미 있을 때만 남기고, 아니면 제거
  s = s.replace(/<img[^>]*alt=["']?([^"'>]*)["']?[^>]*>/gi, (_m, alt) => {
    return isGenericAlt(alt) ? ' ' : (` ${String(alt).trim()} `);
  });

  // 3) 마크다운 링크는 텍스트만 유지
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text) => (text || '').trim());

  // 4) HTML 링크는 내부 텍스트만 유지
  s = s.replace(/<a[^>]*>(.*?)<\/a>/gi, (_m, inner) => (inner || '').trim());

  // 5) URL 제거
  s = s.replace(/\bhttps?:\/\/[^\s)]+/gi, '');
  s = s.replace(/\bwww\.[^\s)]+/gi, '');

  // 6) 나머지 HTML 태그 제거
  s = s.replace(/<\/?[^>]+>/g, ' ');

  // 7) 마크다운 기호 정리
  s = s.replace(/[#>*`_~\-]{1,}/g, ' ');

  // 8) 중복 단어 연속 축약 (image image → image), 한글엔 영향 거의 없음
  s = s.replace(/\b(\S+)(\s+\1\b)+/gi, '$1');

  // 9) 공백 정리
  s = s.replace(/\s+/g, ' ').trim();

  // 10) 텍스트가 거의 없으면 이미지 전용 안내
  if (!s || s.length < 2) return '이미지 첨부';

  // 11) 문장 3개 이내로 줄이기
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, 3);
  s = sentences.join(' ');

  // 12) 길이 제한
  if (s.length > maxLen) s = s.slice(0, maxLen).trim() + '…';
  return s;
}

/* ------------ 집계 필드 추출 ------------ */
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

/* ------------ 카드 ------------ */
function Badge({ children, tone = 'gray' }) {
  const map = {
    brand: 'text-bg-primary',
    line: 'bg-light text-dark border',
    gray: 'text-bg-secondary',
  };
  const cls = map[tone] || map.gray;
  return <span className={`badge rounded-pill ${cls}`}>{children}</span>;
}

function PostCard({ post, onOpen, priority = false, dateFmt }) {
  const rawForPreview = post.preview || post.bodyPreview || post.content || post.body || '';
  const preview = makePreviewText(rawForPreview, 140);
  const when = dateFmt.format(new Date(post.createdAt || post.updatedAt || Date.now()));

  // ✅ 이미지 프록시/커버 후보 제거: 대표이미지 → 유튜브 썸네일 순서로만 사용
  const imgSrc =
    (post.repImageUrl ?? post.rep_image_url ?? '').trim() ||
    (post.youtubeId ? ytThumb(post.youtubeId) : (post.youtube_id ? ytThumb(post.youtube_id) : ''));

  const [showImg, setShowImg] = useState(Boolean(imgSrc));

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
          onError={() => setShowImg(false)}
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

/* ------------ 모바일 플로팅 글쓰기 버튼 ------------ */
function MobileWriteMiniBtnTopRight({ onClick }) {
  const [top, setTop] = useState(12);

  const recompute = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 992px)').matches;
    if (isDesktop) return;

    const header = document.querySelector('.site-header, header.sticky-top, .navbar');
    const rect = header ? header.getBoundingClientRect() : null;
    const headerBottom = rect ? rect.bottom : 0;

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

/* ------------ 페이지 ------------ */
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
        const createdAt = p.createdAt ?? p.created_at ?? null;
        const updatedAt = p.updatedAt ?? p.updated_at ?? null;
        return {
          ...p,
          createdAt,
          updatedAt,
          ...extractCounts(p),
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

      <SiteFooter />

      {/* ✅ 모바일 FAB */}
      <MobileWriteMiniBtnTopRight onClick={onWrite} />

      {/* 하단 고정 광고 + 네비게이션 */}
      <StickyBottomAd label="Bottom Sticky 320×50 / 728×90" />
      <BottomNav />
      <div className="bottom-nav-spacer" aria-hidden="true" />
    </div>
  );
}
