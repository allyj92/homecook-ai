// src/pages/CommunityPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureLogin } from '../lib/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
import '../index.css';

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
     try {
       u.protocol = 'https:';
     } catch {
       // 승격 실패 시 원본으로 두고 SmartImg onError에 맡김
     }
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
       // 로그인 래퍼 자체 URL만 1차 제외 (실제 이미지 src로 쓰일 일 거의 없음)
  if (/\/(auth|login)/i.test(u.pathname.toLowerCase())) return false;
   // 혼합 콘텐츠 방지: https 페이지에서 외부 http 이미지는 제외
   const isHttpsPage = window.location.protocol === 'https:';
   const isExternal = u.host !== window.location.host;
   if (isHttpsPage && isExternal && u.protocol === 'http:') return false;
   return /^https?:/.test(u.href) || u.href.startsWith('data:') || u.href.startsWith('/');
  } catch {
    return false;
  }
}

/* ---- 본문/첨부에서 이미지 후보 추출 ---- */
function extractImagesFromContent(p) {
  const s = String(p?.content ?? p?.body ?? p?.html ?? '').trim();
  const out = [];
  if (!s) return out;

  s.replace(/!\[[^\]]*]\(([^)]+)\)/g, (_m, u) => {
    const cleaned = (u || '').split('"')[0].trim();
    if (cleaned) out.push(unwrapLoginUrl(cleaned));
  });

  s.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_m, u) => u && out.push(unwrapLoginUrl(u)));
  s.replace(/<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi, (_m, u) => u && out.push(unwrapLoginUrl(u)));
  s.replace(/<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi, (_m, list) => {
    const first = String(list || '').split(',')[0].trim().split(' ')[0];
    if (first) out.push(unwrapLoginUrl(first));
  });

  return out;
}
function extractImagesFromAttachments(p) {
  const arr = p?.attachments ?? p?.images ?? p?.photos ?? [];
  const out = [];
  for (const it of (Array.isArray(arr) ? arr : [])) {
    const u = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
    if (u) out.push(unwrapLoginUrl(u));
  }
  return out;
}

// 후보들을 정리해서 배열로 반환
function collectCoverCandidates(post) {
  const updatedAt = post.updatedAt ?? post.updated_at ?? post.createdAt ?? post.created_at ?? null;
  const candidatesRaw = [
    post.coverUrl ?? post.cover_url ?? null,
    post.repImageUrl ?? post.rep_image_url ?? null,
    ...extractImagesFromAttachments(post),
    ...extractImagesFromContent(post),
    ytThumb(post.youtubeId ?? post.youtube_id ?? null),
  ].filter(Boolean);

  const normalized = candidatesRaw
    .map((u) => withVersion(normalizeCoverUrl(u), updatedAt))
    .filter(Boolean)
    .filter(isUsableImageUrl);

  // 중복 제거
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

/* ------------ 단순 광고 슬롯 ------------ */
function AdSlot({ id, height = 250, label = 'AD', sticky = false }) {
  return (
    <div
      id={id}
      className={`adslot border border-dashed rounded-3 d-grid place-items-center text-uppercase text-secondary ${sticky ? 'adslot--sticky' : ''} my-3`}
      style={{ height }}
      role="complementary"
      aria-label={`${label} 광고영역`}
    >
      <span className="small">{label}</span>
    </div>
  );
}

function Badge({ children, tone = 'gray' }) {
  const map = {
    brand: 'text-bg-primary',
    line: 'bg-light text-dark border',
    gray: 'text-bg-secondary',
  };
  const cls = map[tone] || map.gray;
  return <span className={`badge rounded-pill ${cls}`}>{children}</span>;
}

const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
};

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

/* ------------ 이미지 후보 자동 폴백 ------------ */
function SmartImg({ sources, alt = '', className = '', onHide }) {
  const [idx, setIdx] = useState(0);
  const src = sources?.[idx] || null;

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx + 1 < (sources?.length || 0)) setIdx(idx + 1);
        else if (onHide) onHide();
      }}
    />
  );
}

function PostCard({ post, onOpen }) {
  const rawForPreview = post.preview || post.bodyPreview || post.content || post.body || '';
  const preview = makePreviewText(rawForPreview, 100);
  const when = new Date(post.createdAt || post.updatedAt || Date.now()).toLocaleString();
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
        />
      )}
    </article>
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

  useEffect(() => {
    const refresh = () => load(0, tab);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('activity:changed', refresh);
    window.addEventListener('bookmark-changed', refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('activity:changed', refresh);
      window.removeEventListener('bookmark-changed', refresh);
      window.removeEventListener('storage', refresh);
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
      <AdSlot id="ad-comm-top" height={90} label="Top Banner (728/970×90)" />

      <header className="mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-4">
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
              {/* <option value="popular">인기</option> */}
              <option value="question">질문</option>
              <option value="review">후기</option>
              <option value="recipe">레시피</option>
            </select>
          </div>

          <div className="col-12 col-lg-4 text-lg-end">
            <button
              className="btn btn-success"
              onClick={async () => {
                const user = await ensureLogin('/write');
                if (user) navigate('/write');
              }}
            >
              글쓰기
            </button>
          </div>
        </div>
      </header>

      <main className="row g-4">
        <aside className="col-12 col-lg-3 order-lg-2">
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title h6 text-secondary fw-semibold">인기 태그</h5>
              <div className="d-flex flex-wrap gap-2">
                {['저염', '다이어트', '레시피', '질문', '후기', '에어프라이어', '닭가슴살', '곤약'].map((t) => (
                  <button
                    key={t}
                    className="badge rounded-pill bg-light text-dark border btn"
                    onClick={() => { setQ(t); syncQuery({ q: t }); }}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AdSlot id="ad-comm-side" height={600} label="Skyscraper 300×600" sticky />
        </aside>

        <section className="col-12 col-lg-9 order-lg-1">
          <AdSlot id="ad-comm-native" height={120} label="네이티브 인라인 (반응형)" />

          {filtered.length === 0 && !loading && (
            <div className="alert alert-secondary" role="status">
              게시글이 없습니다. 먼저 글을 작성해 보세요!
            </div>
          )}

          {filtered.map((p, i) => (
            <div key={p.id}>
              <PostCard
                post={p}
                onOpen={async () => {
                  const backTo = `/community/${p.id}`;
                  const user = await ensureLogin(backTo);
                  if (user) navigate(backTo);
                }}
              />
              {(i + 1) % 3 === 0 && (
                <div className="card shadow-sm my-3">
                  <div className="card-body">
                    <AdSlot id={`ad-infeed-${i}`} height={250} label="In-Feed 336×280 / 반응형" />
                  </div>
                </div>
              )}
            </div>
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
        </section>
      </main>

      <footer className="text-center text-secondary mt-4">
        <div className="small">
          * 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        </div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
