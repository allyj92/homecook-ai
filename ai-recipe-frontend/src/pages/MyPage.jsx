// src/pages/MyPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BottomNav from '../compoments/BottomNav';
import { apiFetch } from '../lib/http';
import { listFavoritesSimple, removeFavorite } from '../lib/wishlist';
import { getMyPosts } from '../api/community';
import { listActivities, subscribeActivity, formatActivityText, logActivity } from '../lib/activity';

/* ─────────────────────────────────────────
   URL 정규화 (혼합콘텐츠/포트 이슈 방지)
   - 같은 호스트면 상대경로로 바꿈
   - https 페이지에서 http 이미지는 https로 업그레이드 시도
────────────────────────────────────────── */
function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) return url;
    const u = new URL(url, window.location.origin);
    const here = window.location;
    if (u.host === here.host) {
      return u.pathname + u.search + u.hash; // 상대경로
    }
    if (here.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
      return u.toString();
    }
    return u.toString();
  } catch {
    return url;
  }
}

/* 캐시 버스터: 이미지 URL에 ?v=updatedAt(또는 now) 붙여서 수정 즉시 반영 */
function withVersion(url, ver) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    const v = ver != null ? (typeof ver === 'number' ? ver : (Date.parse(ver) || Date.now())) : Date.now();
    u.searchParams.set('v', String(v));
    // 같은 호스트면 상대경로로
    if (u.hostname === window.location.hostname && u.port === window.location.port) {
      return u.pathname + (u.search || '') + (u.hash || '');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/* ── 광고 슬롯 ───────────────────── */
function AdSlot({ id, height = 250, label = 'AD', sticky = false }) {
  return (
    <div
      id={id}
      className={`border border-dashed rounded-3 d-flex align-items-center justify-content-center text-secondary small my-3 ${sticky ? 'position-sticky top-0' : ''}`}
      style={{ height }}
      role="complementary"
      aria-label={label}
    >
      {label}
    </div>
  );
}

/* ── 파스텔 톤(갈색 계열) 그라데이션 팔레트 ───────────────────── */
const PASTELS = [
  ['#f3ebe3', '#e7d8c9'],
  ['#efe2d1', '#e4d5c3'],
  ['#f5eadf', '#e8dccb'],
  ['#ede5da', '#e0d2c3'],
  ['#f1e6d8', '#e5d6c6'],
  ['#f2e8de', '#e6d8c9'],
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── 스마트 썸네일 ─────────────────────
   - src가 로드되면 이미지만 보여줌
   - src가 없거나 로드 실패면 파스텔톤 갈색계열 그라데이션 블록
   - src 변경 시 로딩/오류 상태 리셋 (초진입 미표시 이슈 해결)
────────────────────────────────────── */
function SmartThumb({
  src,
  seed = 'fallback',
  alt = 'thumbnail',
  width = 80,
  height = 56,
  rounded = true,
  className = '',
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  // ★ src가 바뀌면 상태 리셋
  useEffect(() => {
    setLoaded(false);
    setBroken(false);
  }, [src]);

  const [c1, c2] = useMemo(() => {
    const idx = hashCode(String(seed)) % PASTELS.length;
    return PASTELS[idx];
  }, [seed]);

  const hasImg = !!src && !broken;

  return (
    <div
      className={`position-relative ${className}`}
      style={{
        width,
        height,
        borderRadius: rounded ? 8 : 0,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
      aria-label={alt}
    >
      {hasImg && (
        <img
          key={src || 'empty'}               
          src={src}
          alt={alt}
          loading="lazy"
          className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
          style={{ display: loaded ? 'block' : 'none' }}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/* 유튜브 썸네일 */
const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);
/* 날짜 포맷 */
const formatDate = (s) => {
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return '';
  }
};

/* 단건 글 조회(북마크 최신화를 위해) */
async function getPostById(id) {
  try {
    const res = await apiFetch(`/api/community/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* 백엔드가 snake_case를 줄 수도 있어 표준화 + 커버 정규화 + 버전 부여 */
function normalizePostMeta(p) {
  if (!p) return null;
  const youtubeId = p.youtubeId ?? p.youtube_id ?? null;
  const repImageUrlRaw = p.repImageUrl ?? p.rep_image_url ?? null;
  const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;

  // 정규화 + 캐시버스터
  const repImageUrl = withVersion(normalizeCoverUrl(repImageUrlRaw), updatedAt);
  const yt = ytThumb(youtubeId);

  return {
    ...p,
    youtubeId,
    repImageUrl,
    title: p.title ?? '',
    category: p.category ?? '',
    __cover: repImageUrl || yt || null,
  };
}

export default function MyPage() {
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 프로필/세션
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  // 환경설정 상태(데모)
  const [notifOn, setNotifOn] = useState(true);
  const [adPref, setAdPref] = useState('balanced');
  const [dietGoal, setDietGoal] = useState('diet');

  // 즐겨찾기(레시피)
  const [wishLoading, setWishLoading] = useState(false);
  const [wishErr, setWishErr] = useState('');
  const [wishlist, setWishlist] = useState([]); // [{ id, recipeId, title, summary, image, meta, createdAt }]

  // 내가 쓴 글
  const [myPosts, setMyPosts] = useState([]); // [{ id, title, category, createdAt, youtubeId, repImageUrl, tags }]
  const [myLoading, setMyLoading] = useState(false);
  const [myErr, setMyErr] = useState('');

  // 최근 활동 (실데이터)
  const [activities, setActivities] = useState([]);
  const [actLoading, setActLoading] = useState(true);

  // me 먼저 → OK일 때 favorites & myPosts 호출
  useEffect(() => {
    let aborted = false;

    (async () => {
      setMeLoading(true);
      try {
        const res = await apiFetch('/api/auth/me', { noAuthRedirect: true });
        if (aborted) return;

        if (res.status === 401) {
          try { localStorage.removeItem('authUser'); } catch {}
          localStorage.setItem('postLoginRedirect', '/mypage');
          navigate('/login-signup', { replace: true, state: { from: '/mypage' } });
          return;
        }
        if (!res.ok) {
          navigate('/login-signup', { replace: true, state: { from: '/mypage' } });
          return;
        }

        const meData = await res.json();
        if (aborted) return;

        if (!meData?.authenticated) {
          try { localStorage.removeItem('authUser'); } catch {}
          localStorage.setItem('postLoginRedirect', '/mypage');
          navigate('/login-signup', { replace: true, state: { from: '/mypage' } });
          return;
        }

        setMe(meData);

        // favorites
        setWishLoading(true);
        setWishErr('');
        try {
          const items = await listFavoritesSimple(3); // credentials: 'include'
          if (!aborted) setWishlist(Array.isArray(items) ? items : []);
        } catch {
          if (!aborted) setWishErr('저장한 레시피를 불러오지 못했어요.');
        } finally {
          if (!aborted) setWishLoading(false);
        }

        // my posts
        setMyLoading(true);
        setMyErr('');
        try {
          const posts = await getMyPosts(5);
          const fixed = (Array.isArray(posts) ? posts : []).map(normalizePostMeta);
          if (!aborted) setMyPosts(fixed);
        } catch {
          if (!aborted) setMyErr('내가 쓴 글을 불러오지 못했어요.');
        } finally {
          if (!aborted) setMyLoading(false);
        }
      } finally {
        if (!aborted) setMeLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [navigate]);

  // 찜 해제: recipeId 기준 (활동 로그 포함)
  async function onRemove(e, recipeId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return;

    const prev = wishlist;
    setWishlist(arr => arr.filter(it => Number(it.recipeId) !== rid)); // 낙관적 업데이트
    try {
      await removeFavorite(rid); // 200 OK
      const removed = prev.find(it => Number(it.recipeId) === rid);
      logActivity("favorite_remove", { recipeId: rid, title: removed?.title });
    } catch {
      alert('삭제에 실패했어요.');
      setWishlist(prev); // 롤백
    }
  }

  // ─────────────────────────────────────────
  // 북마크한 글 (localStorage 기반)
  // ─────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState([]);   // [{ id, title, category, createdAt, repImageUrl, youtubeId, updatedAt, tags }]
  const [bmLoading, setBmLoading] = useState(false);

  function loadBookmarksFromLS() {
    const list = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('postBookmark:')) continue;
        const id = key.split(':')[1];
        if (localStorage.getItem(key) !== '1') continue;

        const dataKey = `postBookmarkData:${id}`;
        let meta = null;
        const raw = localStorage.getItem(dataKey);
        if (raw) {
          try { meta = JSON.parse(raw); } catch {}
        }
        list.push({ id: Number(id), ...(meta || {}) });
      }
      list.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    } catch {}
    return list;
  }

  useEffect(() => {
    const pull = () => {
      setBmLoading(true);
      try {
        setBookmarks(loadBookmarksFromLS());
      } finally {
        setBmLoading(false);
      }
    };
    pull();

    // 북마크 메타 최신화: 서버에서 최신 글 정보를 당겨와 로컬 스냅샷 갱신 (수정 시 자동 반영)
    (async () => {
      try {
        const raw = loadBookmarksFromLS();
        const ids = raw.slice(0, 20).map((b) => b.id); // 과하지 않게 20개까지만
        if (!ids.length) return;
        for (let i = 0; i < ids.length; i += 4) {
          const chunk = ids.slice(i, i + 4);
          const results = await Promise.allSettled(chunk.map((id) => getPostById(id)));
          results.forEach((r) => {
            if (r.status !== 'fulfilled' || !r.value) return;
            const p = r.value;
            const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;
            try {
              localStorage.setItem(
                `postBookmarkData:${p.id}`,
                JSON.stringify({
                  id: p.id,
                  title: p.title,
                  category: p.category,
                  createdAt: p.createdAt ?? p.created_at,
                  updatedAt, // 저장
                  repImageUrl: withVersion(normalizeCoverUrl(p.repImageUrl ?? p.rep_image_url ?? null), updatedAt),
                  youtubeId: p.youtubeId ?? p.youtube_id ?? null,
                })
              );
            } catch {}
          });
        }
        setBookmarks(loadBookmarksFromLS());
      } catch {}
    })();

    const onStorage = (e) => {
      if (!e || !e.key || e.key.startsWith('postBookmark')) pull();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function onUnbookmark(e, postId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const id = String(postId);
    try {
      localStorage.setItem(`postBookmark:${id}`, '0');
      localStorage.removeItem(`postBookmarkData:${id}`);
    } catch {}
    setBookmarks(arr => arr.filter(b => String(b.id) !== id));
  }

  // 최근 활동 로드 & 실시간 반영
  useEffect(() => {
    const pull = () => {
      setActLoading(true);
      try {
        setActivities(listActivities(30));
      } finally {
        setActLoading(false);
      }
    };
    pull();
    const off = subscribeActivity(pull);
    return off;
  }, []);

  // 로딩 스켈레톤 (me)
  if (meLoading) {
    return (
      <div className="container-xxl py-3">
        <AdSlot id="ad-mypage-top" height={90} label="Top Banner (728×90)" />
        <div className="row g-4">
          <aside className="col-12 col-lg-4">
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-4 rounded-circle mb-3" style={{ height: 80 }} />
                  <div className="placeholder col-6 mb-2" />
                  <div className="placeholder col-4 mb-2" />
                  <div className="placeholder col-8" />
                </div>
              </div>
            </div>
            <AdSlot id="ad-mypage-side" height={600} label="Skyscraper 300×600" sticky />
          </aside>
          <section className="col-12 col-lg-8">
            <div className="card shadow-sm mb-3">
              <div className="card-header"><h5 className="m-0">저장한 레시피</h5></div>
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            </div>
          </section>
        </div>
        <BottomNav />
      </div>
    );
  }

  // 데모 유저(표시용)
  const demoUser = {
    name: '레시프리',
    handle: '@recipfree',
    bio: '레시프리와 함께, 자유롭게 창작하는 맞춤형 건강 레시피.',
    avatar: 'https://picsum.photos/seed/recipfree/200/200'
  };

  // 실제 로그인 정보 우선, 없으면 데모
  const user = me ? {
    name: me.name || (me.email ? me.email.split('@')[0] : '회원'),
    handle: me.email ? `@${me.email.split('@')[0]}` : '@member',
    bio: demoUser.bio,
    avatar: me.avatar || me.picture || demoUser.avatar,
  } : demoUser;

  const stats = {
    recipes: myPosts.length,
    saved: wishlist.length,
    comments: 67,
    streak: 6
  };

  // 텍스트 줄임 스타일
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const twoLine = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  };

  return (
    <div className="container-xxl py-3">
      {/* 상단 배너 */}
      <AdSlot id="ad-mypage-top" height={90} label="Top Banner (728×90)" />

      {/* 헤더 */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">마이페이지</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-success btn-sm" onClick={() => navigate('/profile')}>프로필 편집</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/settings')}>계정/보안</button>
        </div>
      </div>

      <div className="row g-4">
        {/* 사이드 프로필 (고정) */}
<aside className="col-12 col-lg-4">
  {/* ★ wrapper에 sticky 적용 */}
  <div className="sticky-lg-top" style={{ top: 16, zIndex: 2 }}>
    <div className="card shadow-sm mb-3">
      <div className="card-body text-center">
        <img src={user.avatar} alt="avatar" className="rounded-circle mb-2" width={80} height={80} />
        <h5 className="fw-bold">{user.name}</h5>
        <div className="text-secondary small mb-1">{user.handle}</div>
        <p className="text-secondary small">{user.bio}</p>
        <div className="row text-center mt-3">
          <div className="col"><strong>{stats.recipes}</strong><div className="small">작성</div></div>
          <div className="col"><strong>{stats.saved}</strong><div className="small">저장</div></div>
          <div className="col"><strong>{stats.comments}</strong><div className="small">댓글</div></div>
          <div className="col"><strong>{stats.streak}일</strong><div className="small">연속</div></div>
        </div>
        <div className="d-grid gap-2 mt-3">
          <button className="btn btn-outline-success btn-sm" onClick={() => navigate('/saved')}>저장한 레시피</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/activity')}>활동 내역</button>
        </div>
      </div>
    </div>

    {/* 광고도 sticky wrapper 안에 포함 (AdSlot의 sticky prop 제거) */}
    <AdSlot id="ad-mypage-side" height={600} label="Skyscraper 300×600" />
  </div>
</aside>

        {/* 메인 */}
        <section className="col-12 col-lg-8">
          {/* 저장한 레시피 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">저장한 레시피</h5>
              <div className="d-flex align-items-center gap-2">
                <span className="text-secondary small">{wishlist.length}개</span>
                <Link className="btn btn-sm btn-outline-primary" to="/saved">전체보기</Link>
              </div>
            </div>

            {wishLoading && (
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            )}

            {!wishLoading && wishErr && (
              <div className="alert alert-danger m-3" role="alert">{wishErr}</div>
            )}

            {!wishLoading && !wishErr && wishlist.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 저장한 레시피가 없어요.
                <div className="mt-2">
                  <Link className="btn btn-sm btn-success" to="/input">레시피 받으러 가기</Link>
                </div>
              </div>
            )}

            {!wishLoading && !wishErr && wishlist.length > 0 && (
              <div className="list-group list-group-flush">
                {wishlist.slice(0, 3).map((w) => {
                  const key = w.id ?? w.recipeId;
                  const to  = `/result?id=${encodeURIComponent(w.recipeId)}`;
                  const cover = normalizeCoverUrl(w.image || null); // 외부 이미지도 정규화
                  return (
                    <Link key={key} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <SmartThumb src={cover} seed={`wish-${w.recipeId}-${w.title || ''}`} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-semibold" style={oneLine}>
                            {w.title ?? `레시피 #${w.recipeId}`}
                          </div>
                          {w.meta && (
                            <div className="small text-secondary" style={oneLine}>
                              {w.meta}
                            </div>
                          )}
                          {w.summary && (
                            <div className="small text-secondary" style={twoLine}>
                              {w.summary}
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-2 flex-shrink-0">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ minWidth: 72, height: 32, padding: '0 12px' }}
                            onClick={(e) => onRemove(e, w.recipeId)}
                            title="찜 해제"
                          >
                            제거
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 🔖 북마크한 글 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">북마크한 글</h5>
              <span className="text-secondary small">{bookmarks.length}개</span>
            </div>

            {bmLoading && (
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            )}

            {!bmLoading && bookmarks.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 북마크한 글이 없어요.
                <div className="mt-2">
                  <Link className="btn btn-sm btn-success" to="/community">커뮤니티로 가기</Link>
                </div>
              </div>
            )}

            {!bmLoading && bookmarks.length > 0 && (
              <div className="list-group list-group-flush">
                {bookmarks.slice(0, 5).map((b) => {
                  const to = `/community/${b.id}`;
                  const coverBase =
                    normalizeCoverUrl(b.repImageUrl || b.rep_image_url) ||
                    ytThumb(b.youtubeId || b.youtube_id) ||
                    null;
                  const cover = withVersion(coverBase, b.updatedAt || b.updated_at || b.createdAt || b.created_at);
                  return (
                    <Link key={b.id} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <SmartThumb src={cover} seed={`bm-${b.id}-${b.title || ''}`} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-semibold" style={oneLine}>
                            {b.title || `게시글 #${b.id}`}
                          </div>
                          <div className="small text-secondary" style={oneLine}>
                            {b.category || '커뮤니티'}{b.createdAt ? ` · ${formatDate(b.createdAt)}` : ''}
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-shrink-0">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ minWidth: 72, height: 32, padding: '0 12px' }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); localStorage.setItem(`postBookmark:${String(b.id)}`, '0'); localStorage.removeItem(`postBookmarkData:${String(b.id)}`); setBookmarks(arr => arr.filter(x => x.id !== b.id)); }}
                            title="북마크 해제"
                          >
                            해제
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내가 쓴 글 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">내가 쓴 글</h5>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-success" onClick={() => navigate('/write')}>글쓰기</button>
              </div>
            </div>

            {myLoading && (
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            )}

            {!myLoading && myErr && (
              <div className="alert alert-danger m-3" role="alert">{myErr}</div>
            )}

            {!myLoading && !myErr && myPosts.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 작성한 글이 없어요.
                <div className="mt-2">
                  <button className="btn btn-sm btn-success" onClick={()=>navigate('/write')}>첫 글 쓰기</button>
                </div>
              </div>
            )}

            {!myLoading && !myErr && myPosts.length > 0 && (
              <div className="list-group list-group-flush">
                {myPosts.map(p => {
                  const to = `/community/${p.id}`;
                  return (
                    <Link key={p.id} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <SmartThumb src={p.__cover} seed={`post-${p.id}-${p.title}`} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-semibold" style={oneLine}>{p.title}</div>
                          <div className="small text-secondary" style={oneLine}>
                            {p.category}{p.createdAt ? ` · ${formatDate(p.createdAt)}` : ''}
                          </div>
                        </div>
                        <div className="text-secondary small d-none d-md-block">
                          {p.tags?.slice(0,3).map(t => (
                            <span key={t} className="badge bg-light text-dark border ms-1">#{t}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 광고 */}
          <AdSlot id="ad-mypage-native" height={120} label="네이티브 인라인" />

          {/* 최근 활동 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">최근 활동</h5>
              <button className="btn btn-link btn-sm" onClick={() => navigate('/activity')}>전체보기</button>
            </div>

            {actLoading ? (
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-4 text-center text-secondary">아직 활동 내역이 없어요.</div>
            ) : (
              <ul className="list-group list-group-flush">
                {activities.map(a => (
                  <li key={a.id} className="list-group-item d-flex justify-content-between">
                    <span>{formatActivityText(a)}</span>
                    <small className="text-secondary">
                      {new Date(a.ts).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 푸터 */}
      <footer className="text-center text-secondary small mt-4">
        * 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.<br/>
        © {new Date().getFullYear()} <span className="fw-semibold">RECIP</span><span className="text-primary fw-semibold">FREE</span>
      </footer>

      {/* 모바일 하단 네비 */}
      <BottomNav />
    </div>
  );
}
