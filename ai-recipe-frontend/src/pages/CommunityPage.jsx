// src/pages/CommunityPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureLogin } from '../lib/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
import '../index.css';

/* ---- 이미지 URL 정리/대체 ---- */
function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) return url; // 같은 도메인 상대경로 그대로
    const u = new URL(url, window.location.origin);
    // https 페이지에 http 이미지면 업그레이드(혼합콘텐츠 방지)
    if (window.location.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
    }
    // 같은 호스트면 경로만 사용(쿠키/리다이렉션 이슈 최소화)
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
   // 서명/토큰 붙은 URL은 절대 건드리면 안 됨
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

// 본문에서 첫 이미지 (MD/HTML/data-src/srcset 모두 커버)
function firstImageFromContent(p) {
  const s = String(p?.content ?? p?.body ?? p?.html ?? '').trim();
  if (!s) return null;
  // Markdown: ![alt](url "title")
  let m = /!\[[^\]]*]\(([^)]+)\)/.exec(s);
  if (m?.[1]) return m[1].split('"')[0].trim();
  // HTML: <img src="...">
  m = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) return m[1];
  // data-src
  m = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) return m[1];
  // srcset의 첫 번째 후보
  m = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/i.exec(s);
  if (m?.[1]) {
    const first = m[1].split(',')[0].trim().split(' ')[0];
    if (first) return first;
  }
  return null;
}

// 첨부 배열(images/photos/attachments 등)에서도 첫 이미지
function firstAttachmentUrl(p) {
  const cand = p?.attachments ?? p?.images ?? p?.photos ?? [];
  for (const it of cand) {
    const u = it?.url ?? it?.src ?? it?.imageUrl ?? it?.downloadUrl;
    if (u) return u;
  }
  return null;
}

function buildCover(post) {
  const updatedAt = post.updatedAt ?? post.updated_at ?? post.createdAt ?? post.created_at ?? null;
  const raw =
   post.coverUrl ?? post.cover_url ??
   post.repImageUrl ?? post.rep_image_url ??
   firstAttachmentUrl(post) ??
   firstImageFromContent(post) ?? null;
  const normalized = withVersion(normalizeCoverUrl(raw), updatedAt);
  // 1순위: 대표이미지, 2순위: 유튜브 썸네일
  return normalized || ytThumb(post.youtubeId ?? post.youtube_id ?? null) || null;
}

/* ---------------- 목록 프리뷰 전용 텍스트 정리 ---------------- */
function makePreviewText(input, maxLen = 120) {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_m, alt) => (alt || '').trim());       // MD 이미지 alt
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text) => (text || '').trim());     // MD 링크 텍스트
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

/** 숫자 포맷 (k/M 축약) */
const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(x);
};

/** 서버에서 내려오는 다양한 키들을 흡수해서 count 정규화 */
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

function PostCard({ post, onOpen }) {
  const rawForPreview = post.preview || post.bodyPreview || post.content || post.body || '';
  const preview = makePreviewText(rawForPreview, 100);
  const when = new Date(post.createdAt || post.updatedAt || Date.now()).toLocaleString();

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
            {/* 우상단 메타 오른쪽에 간단 숫자도 표시 */}
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
        </div>
      </div>

      {post.__cover && (
        <img
          src={post.__cover}
          alt=""
          className="card-img-bottom"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
  const [sort, setSort] = useState(params.get('sort') ?? 'new'); // 서버 기준: 최신순

  // 서버 데이터 상태
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const size = 12;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 탭→카테고리 매핑
  const tabToCategory = (t) => {
    if (t === 'question') return '질문';
    if (t === 'review') return '후기';
    if (t === 'recipe') return '레시피';
    return ''; // all은 전체
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
      const fixed = arr.map(p => ({
        ...p,
        ...extractCounts(p),
        __cover: buildCover(p),
      }));

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

  // 최초 로드
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { load(0, tab); }, [load, tab]);

  // 탭/검색/정렬 쿼리 동기화 헬퍼
  function syncQuery(next = {}) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v == null ? merged.delete(k) : merged.set(k, String(v))));
    setParams(merged, { replace: true });
  }

  // 같은/다른 탭 활동 발생 시 목록 갱신 (좋아요/북마크/댓글)
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

  // 클라이언트 측 필터/정렬(서버는 최신순 반환)
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
        (a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime()
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
