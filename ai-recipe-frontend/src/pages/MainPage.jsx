// src/pages/MainPage.jsx
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import '../index.css';
import BottomNav from '../components/BottomNav';
import { ensureLogin } from '../auth/ensureLogin';

const BRAND = {
  orange: '#ff7f32',
  teal:   '#009688',
  ink:    '#212529',
  mute:   '#6c757d',
  softBg: '#fff7f1',
  softBd: '#ffd7bf',
};

function AdSlot({ id, height = 90, label = 'AD', fullBleed = false, sticky = false }) {
  if (fullBleed) {
    return (
      <div className={`container-fluid px-0 ${sticky ? 'position-sticky top-0' : ''}`} id={id} role="complementary" aria-label={`${label} 광고영역`}>
        <div className="border-top border-bottom" style={{ background: BRAND.softBg, borderColor: BRAND.softBd }}>
          <div className="container-xxl d-flex align-items-center" style={{ minHeight: height }}>
            <span className="small" style={{ color: BRAND.mute }}>{label}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="my-3" id={id} role="complementary" aria-label={`${label} 광고영역`}>
      <div
        className="border rounded-4 d-flex align-items-center justify-content-center py-3"
        style={{ minHeight: height, background: BRAND.softBg, borderColor: BRAND.softBd }}
      >
        <span className="small" style={{ color: BRAND.mute }}>{label}</span>
      </div>
    </div>
  );
}

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

const BrandButton = ({ outline = false, className = '', style = {}, ...props }) => (
  <button
    className={`btn ${outline ? 'btn-outline' : ''} ${className}`}
    style={{
      borderRadius: 10,
      borderColor: BRAND.orange,
      background: outline ? 'transparent' : BRAND.orange,
      color: outline ? BRAND.orange : '#fff',
      ...style
    }}
    {...props}
  />
);

const BrandBadge = ({ tone = 'soft', children, className = '' }) => {
  const styles = useMemo(() => {
    if (tone === 'solid') return { background: BRAND.orange, color: '#fff', borderColor: BRAND.orange };
    if (tone === 'teal')  return { background: BRAND.teal,   color: '#fff', borderColor: BRAND.teal };
    return { background: BRAND.softBg, color: BRAND.ink, borderColor: BRAND.softBd };
  }, [tone]);
  return (
    <span className={`badge border ${className}`} style={{ ...styles, borderWidth: 1.5 }}>
      {children}
    </span>
  );
};

/* ---------------- 이미지 URL 정리 ---------------- */
function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) return url;
    const u = new URL(url, window.location.origin);
    if (window.location.protocol === 'https:' && u.protocol === 'http:') u.protocol = 'https:';
    if (u.host === window.location.host) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch { return url; }
}
function withVersion(url, ver) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    const v = ver != null ? (typeof ver === 'number' ? ver : Date.parse(ver) || Date.now()) : Date.now();
    u.searchParams.set('v', String(v));
    if (u.host === window.location.host) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch { return url; }
}
const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);
function buildCover(p) {
  const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;
  const raw = p.repImageUrl ?? p.rep_image_url ?? null;
  const normalized = withVersion(normalizeCoverUrl(raw), updatedAt);
  return normalized || ytThumb(p.youtubeId ?? p.youtube_id ?? null) || null;
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
  if (Array.isArray(data.content)) return data.content;     // PageImpl
  if (Array.isArray(data.items)) return data.items;         // items
  const firstArray = Object.values(data).find(v => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

/** 최신 레시피(최신순) */
async function loadDailyNewRecipe(size = 8) {
  // 1) 정식: /api/recipes (Page)
  try {
    const qs = new URLSearchParams({ page:'0', size:String(size), sort:'createdAt,desc' });
    const res = await fetch(`/api/recipes?${qs}`, { credentials:'include', cache:'no-store', headers:{Accept:'application/json'} });
    if (res.ok) {
      const j = await res.json();
      const arr = toArr(j);
      if (arr.length) return arr;
    }
  } catch {}

  // 2) 폴백: /api/recipes/latest (List)
  try {
    const qs = new URLSearchParams({ size:String(size) });
    const res = await fetch(`/api/recipes/latest?${qs}`, { credentials:'include', cache:'no-store', headers:{Accept:'application/json'} });
    if (res.ok) {
      const j = await res.json();
      const arr = toArr(j);
      if (arr.length) return arr;
    }
  } catch {}

  // 3) 최종 폴백: 커뮤니티 최신글을 레시피 카드 모양으로 매핑해서 보여주기
  try {
    // createdAt 내림차순
    const res = await fetch(`/api/community/posts?page=0&size=${size}&sort=createdAt,desc`, {
      credentials:'include', cache:'no-store', headers:{Accept:'application/json'}
    });
    if (res.ok) {
      const j = await res.json();
      const posts = toArr(j);
      return posts.map(p => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt ?? p.created_at ?? null,
        likeCount: p.likeCount ?? p.metrics?.likes ?? 0,
        commentCount: p.commentCount ?? p.metrics?.comments ?? 0,
        repImageUrl: p.coverUrl ?? p.repImageUrl ?? null,  // 있으면 썸네일로
      }));
    }
  } catch {}

  return [];
}
/** 인기 커뮤니티(백엔드 sort=popular 우선, 폴백 클라이언트 점수) */
async function loadPopularCommunity(size = 8) {
  try {
    const qs = new URLSearchParams({ size: String(size), sort: 'popular' });
    const res = await fetchJson(`/api/community/posts?${qs}`);
    const arr = toArr(res);
    if (arr.length) return arr;
  } catch { /* pass */ }

  try {
    const qs = new URLSearchParams({ size: String(size) });
    const res = await fetchJson(`/api/community/trending?${qs}`);
    const arr = toArr(res);
    if (arr.length) return arr;
  } catch { /* pass */ }

  try {
    const res = await fetchJson(`/api/community/posts?page=0&size=50`);
    const items = toArr(res);
    const now = Date.now();

    const scoreOf = (p) => {
      const likes = Number(p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ?? p.metrics?.likes ?? 0);
      const comments = Number(p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0);
      const bookmarks = Number(p.bookmarkCount ?? p.bookmark_count ?? p.bookmarks ?? p.metrics?.bookmarks ?? 0);
      const createdAt = new Date(p.createdAt ?? p.created_at ?? p.updatedAt ?? p.updated_at ?? now).getTime();
      const ageHours = Math.max(1, (now - createdAt) / 36e5);
      const engagement = likes * 3 + comments * 2 + bookmarks * 1;
      return engagement / Math.pow(ageHours, 0.6);
    };

    return [...items]
      .map(p => ({ ...p, __score: scoreOf(p) }))
      .sort((a, b) => b.__score - a.__score)
      .slice(0, size);
  } catch {
    return [];
  }
}

export default function MainPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const hsc = useHScrollControls();

  // 🔥 인기 커뮤니티 섹션 상태
  const [popLoading, setPopLoading] = useState(true);
  const [popular, setPopular] = useState([]);

  // ✅ 매일매일 새로운 레시피 섹션 상태
  const [dailyNewLoading, setDailyNewLoading] = useState(true);
  const [dailyNewRecipe, setDailyNewRecipe] = useState([]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onCardKey = (e, to) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } };

  // 🔐 로그인 가드
  const requireLogin = useCallback(async (backTo, onOk) => {
    const safeBack = backTo ?? (
      window.location.hash
        ? window.location.hash.slice(1)
        : (window.location.pathname + window.location.search)
    );
    const me = await ensureLogin(safeBack);
    if (!me) return;
    if (onOk) onOk();
  }, []);

  /* ✅ 인기 커뮤니티 로딩 */
  const reloadPopular = useCallback(async () => {
    setPopLoading(true);
    try {
      const arr = await loadPopularCommunity(8);
      const fixed = (Array.isArray(arr) ? arr : []).map(p => {
        const cover = buildCover(p);
        const likeCount = Number(
          p.likeCount ?? p.like_count ?? p.likes ?? p.hearts ??
          p.metrics?.likes ?? p.metrics?.hearts ?? 0
        );
        const commentCount = Number(
          p.commentCount ?? p.comment_count ?? p.comments ?? p.metrics?.comments ?? 0
        );
        const bookmarkCount = Number(
          p.bookmarkCount ?? p.bookmark_count ?? p.bookmarks ?? p.metrics?.bookmarks ?? 0
        );
        return {
          ...p,
          __cover: cover,
          __likes: likeCount,
          __comments: commentCount,
          __bookmarks: bookmarkCount,
        };
      });
      setPopular(fixed);
    } finally {
      setPopLoading(false);
    }
  }, []);

  /* ✅ 최신 레시피 로딩 */
  const reloadDailyNew = useCallback(async () => {
    setDailyNewLoading(true);
    try {
      const arr = await loadDailyNewRecipe(8);
      const fixed = (Array.isArray(arr) ? arr : []).map(r => ({
        ...r,
        __cover: buildCover(r),
        __likes: Number(r.likeCount ?? r.like_count ?? r.metrics?.likes ?? 0),
        __comments: Number(r.commentCount ?? r.comment_count ?? r.metrics?.comments ?? 0),
      }));
      setDailyNewRecipe(fixed);
    } finally {
      setDailyNewLoading(false);
    }
  }, []);

  useEffect(() => { reloadPopular(); }, [reloadPopular]);
  useEffect(() => { reloadDailyNew(); }, [reloadDailyNew]);

  // 같은/다른 탭에서 좋아요/북마크/댓글/레시피가 생기면 새로고침
  useEffect(() => {
    const refreshBoth = () => { reloadPopular(); reloadDailyNew(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refreshBoth(); };
    const onFocus = () => refreshBoth();
    const onStorage = (e) => {
      if (!e?.key) return;
      if (
        e.key.startsWith('rf:activity:') ||
        e.key.startsWith('postBookmark:') ||
        e.key.startsWith('postBookmarkData:') ||
        e.key.startsWith('recipe:') // 여유 키워드
      ) refreshBoth();
    };

    window.addEventListener('activity:changed', refreshBoth);
    window.addEventListener('bookmark-changed', refreshBoth);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('activity:changed', refreshBoth);
      window.removeEventListener('bookmark-changed', refreshBoth);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [reloadPopular, reloadDailyNew]);

  return (
    <div className="container-xxl py-3">
      <AdSlot id="ad-top-banner" height={96} label="Top Banner (728/970×90)" fullBleed />

      <main className="row g-4 mt-1">
        <aside className="col-12 col-lg-3 d-none d-lg-block">
          <div className="position-sticky" style={{ top: 12 }}>
            <AdSlot id="ad-side-1" height={600} label="Skyscraper 300×600" />
            <AdSlot id="ad-side-2" height={250} label="Rectangle 300×250" />
          </div>
        </aside>

        <section className="col-12 col-lg-9">
          {/* HERO */}
          <section className="rounded-4 border p-4 p-lg-5" style={{ background: '#fff', borderColor: BRAND.softBd }}>
            <div className="row align-items-center g-4">
              <div className="col-12 col-lg-7">
                <h1 className="display-6 fw-bold mb-2" style={{ color: BRAND.ink }}>
                  <span style={{ color: BRAND.orange }}>Recip</span>
                  <span style={{ color: BRAND.teal }}>Free</span> — 자유롭게, 그러나 건강하게
                </h1>
                <p className="text-secondary mb-3">
                  레시프리는 <strong>집밥 기준</strong>의 저염·저당 원칙을 지키면서도,
                  당신의 취향과 상황에 맞춰 <strong>창의적인 레시피를 제안</strong>합니다.
                </p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {/* 🔐 로그인 게이트 */}
                  <BrandButton onClick={() => requireLogin('/input', () => navigate('/input'))}>
                    나만의 레시피 시작하기
                  </BrandButton>
                  <BrandButton outline className="ms-1" onClick={() => navigate('/community')}>커뮤니티 구경</BrandButton>
                </div>

                <div className="d-flex flex-wrap gap-2 small">
                  <BrandBadge>🍽️ 집밥 기준의 손쉬운 조리</BrandBadge>
                  <BrandBadge>🧂 나트륨·정제당 최소화</BrandBadge>
                  <BrandBadge>🥗 자연스러운 단맛·건강한 기름</BrandBadge>
                </div>

                <AdSlot id="ad-hero-native" height={120} label="네이티브 인라인 (반응형)" />
              </div>

              <div className="col-12 col-lg-5">
                <div className="card shadow-sm border-0">
                  <div className="card-header bg-white border-0 d-flex align-items-center gap-2">
                    <BrandBadge tone="solid">오늘의 맞춤</BrandBadge>
                    <span className="small" style={{ color: BRAND.mute }}>목표·재료·시간 반영</span>
                  </div>
                  <div className="ratio ratio-4x3 bg-light position-relative rounded-top">
                    <img
                      src="/images/chicken-broccoli.jpg"
                      alt="저염 닭가슴살 볶음"
                      className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div className="card-body">
                    <h3 className="h5 fw-semibold mb-1" style={{ color: BRAND.ink }}>저염 닭가슴살 볶음</h3>
                    <div className="small" style={{ color: BRAND.mute }}>단백질 35g · 나트륨 480mg · 18분</div>
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
                <BrandButton
                  outline
                  className="btn-sm"
                  onClick={() => navigate('/community?tab=all&sort=popular')}
                >
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
                {popular.slice(0, 8).map((p) => {
                  const to = `/community/${p.id}`;
                  return (
                    <div className="col-12 col-sm-6 col-lg-3" key={p.id}>
                      <article
                        className="card h-100 shadow-sm"
                        onClick={() => navigate(to)}
                        onKeyDown={(e) => onCardKey(e, to)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${p.title || '게시글'} 보기`}
                      >
                        <div className="position-relative">
                          <div className="ratio ratio-4x3 bg-light rounded-top">
                            {p.__cover && (
                              <img
                                src={p.__cover}
                                alt=""
                                className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                                style={{ objectFit: 'cover' }}
                                loading="lazy"
                                referrerPolicy="no-referrer"
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
                {dailyNewRecipe.slice(0, 8).map((r) => (
                  <div className="col-12 col-sm-6 col-lg-3" key={r.id}>
                    <article
                      className="card h-100 shadow-sm"
                      onClick={() => navigate(`/recipe/${r.id}`)}
                      onKeyDown={(e)=>onCardKey(e, `/recipe/${r.id}`)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${r.title || '레시피'} 보기`}
                    >
                      <div className="position-relative">
                        <div className="ratio ratio-4x3 bg-light rounded-top">
                          {r.__cover && (
                            <img
                              src={r.__cover}
                              alt=""
                              className="position-absolute top-0 start-0 w-100 h-100 rounded-top"
                              style={{ objectFit: 'cover' }}
                              loading="lazy"
                              referrerPolicy="no-referrer"
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
                ))}
              </div>
            )}
          </section>

          <div className="mt-4">
            <AdSlot id="ad-infeed-1" height={250} label="In-Feed 336×280 / 반응형" />
          </div>

          {/* 안내 섹션 */}
          <section className="mt-4">
            <div className="mb-2">
              <h2 className="h5 fw-bold m-0" id="how-title" style={{ color: BRAND.ink }}>어떻게 추천하나요?</h2>
            </div>

            <ul className="list-group">
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">📝</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>기본 정보만 입력</div>
                  <div className="small" style={{ color: BRAND.mute }}>키·몸무게·목표·보유 재료만 있으면 충분해요.</div>
                </div>
                <BrandBadge>30초</BrandBadge>
              </li>
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">🧠</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>개인화 분석</div>
                  <div className="small" style={{ color: BRAND.mute }}>목표별 영양 지표(단백질/나트륨/칼로리)로 스코어링해 최적 조합을 제안합니다.</div>
                </div>
                <BrandBadge>실시간</BrandBadge>
              </li>
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">🍳</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>조리 가이드 제공</div>
                  <div className="small" style={{ color: BRAND.mute }}>15–20분 레시피·영양정보·대체 재료까지 한 번에 제공합니다.</div>
                </div>
                <BrandBadge tone="solid">맞춤</BrandBadge>
              </li>
            </ul>

            <div className="small mt-3" style={{ color: BRAND.mute }}>
              * 레시프리는 과도한 소금·정제당·포화지방을 지양하고, 집밥에서 구현 가능한 조리법을 우선합니다.
              레시피의 영양 정보는 추정치이며 개인의 상태에 따라 달라질 수 있습니다.
            </div>

            <div className="d-grid d-sm-flex justify-content-sm-center mt-3">
              {/* 🔐 로그인 게이트 */}
              <BrandButton onClick={() => requireLogin('/input', () => navigate('/input'))}>
                내 레시피 받기
              </BrandButton>
            </div>
          </section>
        </section>
      </main>

      <footer className="text-center mt-4">
        <div className="small" style={{ color: BRAND.mute }}>
          * 일부 영역에는 제휴/광고 링크가 포함될 수 있으며, 구매 시 서비스 운영을 위한 수익이 발생할 수 있습니다.
        </div>
        <div className="small" style={{ color: BRAND.mute }}>
          © {new Date().getFullYear()} <strong style={{ color: BRAND.orange }}>Recip</strong><strong style={{ color: BRAND.teal }}>Free</strong>
        </div>
      </footer>

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
                      style={{ scrollSnapAlign: 'start' }}
                      tabIndex={0}
                      onClick={() => r.id && navigate(`/recipe/${r.id}`)}
                      onKeyDown={(e)=> r.id && onCardKey(e, `/recipe/${r.id}`)}
                      aria-label={`${r.title || '레시피'} 보기`}
                    >
                      <div className="position-relative">
                        <div className="ratio ratio-4x3 bg-light rounded-top" />
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
