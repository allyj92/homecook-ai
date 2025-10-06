
// src/pages/MyPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { apiFetch } from '../lib/http';
import { listFavoritesSimple, removeFavorite } from '../lib/wishlist';
import { getMyPosts } from '../api/community';
import {
  listActivitiesPaged,
  subscribeActivity,
  formatActivityText,
  formatActivityHref,
  logActivity,
} from '../lib/activity';

/* 숫자 ID만 허용(최대 19자리: Long 범위) */
function isNumericId(id) {
  return typeof id === 'string' && /^[0-9]{1,19}$/.test(id);
}

/* URL 정규화 */
function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) return url;
    const u = new URL(url, window.location.origin);
    const here = window.location;
    if (u.host === here.host) return u.pathname + u.search + u.hash;
    if (here.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
      return u.toString();
    }
    return u.toString();
  } catch {
    return url;
  }
}

/* 캐시 버스터 */
function withVersion(url, ver) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    const v =
      ver != null
        ? (typeof ver === 'number' ? ver : Date.parse(ver) || Date.now())
        : Date.now();
    u.searchParams.set('v', String(v));
    if (u.hostname === window.location.hostname && u.port === window.location.port) {
      return u.pathname + (u.search || '') + (u.hash || '');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/* 광고 슬롯 */
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

/* 파스텔 */
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

/* 썸네일 (현재 화면에선 미사용이지만 남겨둠) */
function SmartThumb({ src, seed = 'fallback', alt = 'thumbnail', width = 80, height = 56, rounded = true, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
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
      style={{ width, height, borderRadius: rounded ? 8 : 0, overflow: 'hidden', background: `linear-gradient(135deg, ${c1}, ${c2})` }}
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

const ytThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);
const formatDate = (s) => {
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return '';
  }
};

/* 단건 글 조회 (메타 최신화 때 사용 가능) */
async function getPostById(id) {
  try {
    const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* 🔥 글 삭제 API */
async function deleteCommunityPost(id) {
  let res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.status === 405 || res.status === 400 || res.status === 501) {
    res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  }
  if (!res.ok) {
    let msg = '삭제에 실패했어요.';
    try {
      msg = (await res.text()) || msg;
    } catch {}
    throw new Error(msg);
  }
  return true;
}

/* snake_case → 표준화 */
function normalizePostMeta(p) {
  if (!p) return null;
  const youtubeId = p.youtubeId ?? p.youtube_id ?? null;
  const repImageUrlRaw = p.repImageUrl ?? p.rep_image_url ?? p.image ?? null;
  const updatedAt = p.updatedAt ?? p.updated_at ?? p.createdAt ?? p.created_at ?? null;
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

  /* 세션 */
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  /* 즐겨찾기(레시피) */
  const [wishLoading, setWishLoading] = useState(false);
  const [wishErr, setWishErr] = useState('');
  const [wishlist, setWishlist] = useState([]);

  /* 내가 쓴 글 */
  const [myPosts, setMyPosts] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myErr, setMyErr] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  /* 최근 활동 */
  const [activities, setActivities] = useState([]);
  const [actLoading, setActLoading] = useState(true);
  const [actTotal, setActTotal] = useState(0);

  /* 북마크(서버) */
  const [bookmarks, setBookmarks] = useState([]);
  const [bmLoading, setBmLoading] = useState(false);

  +  /* 북마크 변경/화면 복귀 시 새로고침 */
  useEffect(() => {
    const onBM = () => fetchBookmarks();
    const onVis = () => { if (document.visibilityState === 'visible') fetchBookmarks(); };
    window.addEventListener('bookmark-changed', onBM);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('bookmark-changed', onBM);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchBookmarks]);

  /* me 먼저 로드 */
  useEffect(() => {
    let aborted = false;
    (async () => {
      setMeLoading(true);
      try {
        const res = await apiFetch('/api/auth/me', { noAuthRedirect: true });
        if (aborted) return;

        if (res.status === 401) {
          try {
            localStorage.removeItem('authUser');
          } catch {}
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
          try {
            localStorage.removeItem('authUser');
          } catch {}
          localStorage.setItem('postLoginRedirect', '/mypage');
          navigate('/login-signup', { replace: true, state: { from: '/mypage' } });
          return;
        }

        setMe(meData);

        /* 저장한 레시피 */
        setWishLoading(true);
        setWishErr('');
        try {
          const items = await listFavoritesSimple(3);
          if (!aborted) setWishlist(Array.isArray(items) ? items : []);
        } catch {
          if (!aborted) setWishErr('저장한 레시피를 불러오지 못했어요.');
        } finally {
          if (!aborted) setWishLoading(false);
        }

        /* 내가 쓴 글 */
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
    return () => {
      aborted = true;
    };
  }, [navigate]);

  /* 찜 해제(레시피) */
  async function onRemove(e, recipeId) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return;

    const prev = wishlist;
    setWishlist((arr) => arr.filter((it) => Number(it.recipeId) !== rid));
    try {
      await removeFavorite(rid);
      const removed = prev.find((it) => Number(it.recipeId) === rid);
      try {
        logActivity('favorite_remove', {
          recipeId: rid,
          recipeTitle: removed?.title || `#${rid}`,
        });
      } catch {}
    } catch {
      alert('삭제에 실패했어요.');
      setWishlist(prev);
    }
  }

  /* ✅ 내가 쓴 글 삭제 */
  const onDeletePost = async (e, post) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!post?.id) return;
    const id = String(post.id);
    const title = post.title || `게시글 #${id}`;

    if (!window.confirm(`정말 삭제할까요?\n\n"${title}"`)) return;

    setDeletingId(id);
    // 북마크 목록에서도 제거 시도(있다면)
    onUnbookmark(undefined, id);
    try {
      await deleteCommunityPost(id);
      setMyPosts((arr) => arr.filter((p) => String(p.id) !== id));
      try {
        logActivity('post_delete', { postId: id, postTitle: title });
      } catch {}
    } catch (err) {
      alert((err && err.message) ? err.message : '삭제에 실패했어요.');
    } finally {
      setDeletingId(null);
    }
  };

  /* 북마크 로드(서버 기반) */
    const fetchBookmarks = useCallback(async () => {
    if (!me) return;
    setBmLoading(true);
    try {
      // 캐시버스터 & 캐시 비활성화
      const res = await apiFetch(`/api/community/bookmarks?page=0&size=5&_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('bookmark_list_failed');
      const page = await res.json();
      setBookmarks((page?.content ?? []).map(normalizePostMeta));
    } catch {
      setBookmarks([]);
    } finally {
      setBmLoading(false);
    }
  }, [me]);



  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  /* 북마크 해제(서버 호출) */
  async function onUnbookmark(e, postId) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = String(postId);
    const prev = bookmarks;
    // UI 즉시 반영(낙관적)
    setBookmarks((arr) => arr.filter((b) => String(b.id) !== id));

    try {
      const res = await apiFetch(`/api/community/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('bookmark_remove_failed');
    } catch {
      // 실패 시 복구
      setBookmarks(prev);
      alert('북마크 해제에 실패했어요.');
    }
  }

  /* 최근 활동: 상위 3개만 */
  useEffect(() => {
    const pull = () => {
      setActLoading(true);
      try {
        const { items, total } = listActivitiesPaged(0, 3);
        setActivities(items);
        setActTotal(total);
      } finally {
        setActLoading(false);
      }
    };
    pull();
    const off = subscribeActivity(pull);
    return off;
  }, []);

  /* 로딩 스켈레톤 (me) */
  if (meLoading) {
    return (
      <div className="container-xxl py-3">
        <AdSlot id="ad-mypage-top" height={90} label="Top Banner (728×90)" />
        <div className="row g-4">
          <aside className="col-12 col-lg-4">
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <div className="placeholder-glow">
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
              <div className="card-header">
                <h5 className="m-0">저장한 레시피</h5>
              </div>
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

  /* 데모 유저 */
  const demoUser = {
    name: '레시프리',
    handle: '@recipfree',
    bio: '레시프리와 함께, 자유롭게 창작하는 맞춤형 건강 레시피.',
    avatar: 'https://picsum.photos/seed/recipfree/200/200',
  };

  /* 실제 로그인 정보 */
  const user = me
    ? {
        name: me.name || (me.email ? me.email.split('@')[0] : '회원'),
        handle: me.email ? `@${me.email.split('@')[0]}` : '@member',
        bio: demoUser.bio,
        avatar: me.avatar || me.picture || demoUser.avatar,
      }
    : demoUser;

  const stats = { recipes: myPosts.length, saved: wishlist.length, comments: 67, streak: 6 };
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <div className="container-xxl py-3 mypage">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">마이페이지</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-success btn-sm" onClick={() => navigate('/profile')}>
            프로필 편집
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/settings')}>
            계정/보안
          </button>
        </div>
      </div>

      <AdSlot id="ad-mypage-top" height={90} label="Top Banner (728×90)" />

      <div className="row g-4">
        <aside className="col-12 col-lg-4">
          <div className="sticky-lg-top" style={{ top: 0, zIndex: 2 }}>
            <div className="card shadow-sm mb-3">
              <div className="card-body text-center">
                <h5 className="fw-bold">{user.name}</h5>
                <div className="text-secondary small mb-1">{user.handle}</div>
                <p className="text-secondary small">{user.bio}</p>
                <div className="row text-center mt-3">
                  <div className="col">
                    <strong>{stats.recipes}</strong>
                    <div className="small">작성</div>
                  </div>
                  <div className="col">
                    <strong>{stats.saved}</strong>
                    <div className="small">저장</div>
                  </div>
                  <div className="col">
                    <strong>{stats.comments}</strong>
                    <div className="small">댓글</div>
                  </div>
                  <div className="col">
                    <strong>{stats.streak}일</strong>
                    <div className="small">연속</div>
                  </div>
                </div>
                <div className="d-grid gap-2 mt-3">
                  <button className="btn btn-outline-success btn-sm" onClick={() => navigate('/saved')}>
                    저장한 레시피
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/activity')}>
                    활동 내역
                  </button>
                </div>
              </div>
            </div>
            <AdSlot id="ad-mypage-side" height={600} label="Skyscraper 300×600" />
          </div>
        </aside>

        <section className="col-12 col-lg-8">
          {/* 저장한 레시피 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">저장한 레시피</h5>
              <div className="d-flex align-items-center gap-2">
                <span className="text-secondary small">{wishlist.length}개</span>
                <Link className="btn btn-sm btn-outline-primary" to="/saved">
                  전체보기
                </Link>
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
              <div className="alert alert-danger m-3" role="alert">
                {wishErr}
              </div>
            )}

            {!wishLoading && !wishErr && wishlist.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 저장한 레시피가 없어요.
                <div className="mt-2">
                  <Link className="btn btn-sm btn-success" to="/input">
                    레시피 받으러 가기
                  </Link>
                </div>
              </div>
            )}

            {!wishLoading && !wishErr && wishlist.length > 0 && (
              <div className="list-group list-group-flush">
                {wishlist.slice(0, 3).map((w) => {
                  const key = w.id ?? w.recipeId;
                  const to = `/result?id=${encodeURIComponent(w.recipeId)}`;
                  return (
                    <Link key={key} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
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
                            <div
                              className="small text-secondary"
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
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

          {/* 북마크한 글 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">북마크한 글</h5>
              <div className="d-flex align-items-center gap-2">
                <span className="text-secondary small">{bookmarks.length}개</span>
                <Link className="btn btn-sm btn-outline-primary" to="/bookmarks">
                  전체보기
                </Link>
              </div>
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
                  <Link className="btn btn-sm btn-success" to="/community">
                    커뮤니티로 가기
                  </Link>
                </div>
              </div>
            )}

            {!bmLoading && bookmarks.length > 0 && (
              <div className="list-group list-group-flush">
                {bookmarks.slice(0, 5).map((b) => {
                  const to = `/community/${b.id}`;
                  return (
                    <Link key={b.id} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-semibold" style={oneLine}>
                            {b.title || `게시글 #${b.id}`}
                          </div>
                          <div className="small text-secondary" style={oneLine}>
                            {(b.category || '커뮤니티')}
                            {b.createdAt ? ` · ${formatDate(b.createdAt)}` : ''}
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-shrink-0">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ minWidth: 72, height: 32, padding: '0 12px' }}
                            onClick={(e) => onUnbookmark(e, b.id)}
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
                <Link className="btn btn-sm btn-outline-primary" to="/myposts">
                  전체보기
                </Link>
                <button className="btn btn-sm btn-success" onClick={() => navigate('/write')}>
                  글쓰기
                </button>
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
              <div className="alert alert-danger m-3" role="alert">
                {myErr}
              </div>
            )}

            {!myLoading && !myErr && myPosts.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 작성한 글이 없어요.
                <div className="mt-2">
                  <button className="btn btn-sm btn-success" onClick={() => navigate('/write')}>
                    첫 글 쓰기
                  </button>
                </div>
              </div>
            )}

            {!myLoading && !myErr && myPosts.length > 0 && (
              <div className="list-group list-group-flush">
                {myPosts.map((p) => {
                  const to = `/community/${p.id}`;
                  const isDeleting = String(deletingId) === String(p.id);
                  return (
                    <Link key={p.id} to={to} className="list-group-item list-group-item-action">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-semibold" style={oneLine}>
                            {p.title}
                          </div>
                          <div className="small text-secondary" style={oneLine}>
                            {p.category}
                            {p.createdAt ? ` · ${formatDate(p.createdAt)}` : ''}
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-shrink-0">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ minWidth: 72, height: 32, padding: '0 12px' }}
                            onClick={(e) => onDeletePost(e, p)}
                            disabled={isDeleting}
                            title="삭제"
                          >
                            {isDeleting ? '삭제 중…' : '삭제'}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <AdSlot id="ad-mypage-native" height={120} label="네이티브 인라인" />

          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">최근 활동</h5>
              <div className="d-flex align-items-center gap-2">
                <span className="text-secondary small">총 {actTotal}건</span>
                <button className="btn btn-link btn-sm" onClick={() => navigate('/activity')}>
                  전체보기
                </button>
              </div>
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
                {activities.map((a) => {
                  const href = formatActivityHref(a);
                  const text = formatActivityText(a);
                  return (
                    <li key={a.id} className="list-group-item d-flex justify-content-between">
                      <span>{href ? <Link to={href} className="text-decoration-none">{text}</Link> : text}</span>
                      <small className="text-secondary">{new Date(a.ts).toLocaleString()}</small>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <footer className="text-center text-secondary small mt-4">
        * 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        <br />
        © {new Date().getFullYear()} <span className="fw-semibold">RECIP</span><span className="text-primary fw-semibold">FREE</span>
      </footer>

      <BottomNav />
    </div>
  );
}
