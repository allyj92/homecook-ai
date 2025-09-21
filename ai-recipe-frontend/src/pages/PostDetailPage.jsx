// src/pages/PostDetailPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../components/BottomNav";
import { ensureLogin, fetchMe } from "../lib/auth";
import { getCommunityPost } from "../api/community";
import { logActivity } from "../lib/activity";

/** API 응답을 화면용으로 정규화 */
function normalizePost(raw) {
  if (!raw) return null;
  let d = raw;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch {}
  }
  if (d && d.bodyPreview && !d.id) {
    try { d = JSON.parse(d.bodyPreview); } catch {}
  }
  return {
    id: d.id ?? d.postId ?? null,
    title: d.title ?? d.subject ?? "",
    category: d.category ?? d.type ?? "",
    content: d.content ?? d.body ?? "",
    tags: Array.isArray(d.tags) ? d.tags : (Array.isArray(d.tagList) ? d.tagList : []),
    authorId: d.authorId ?? d.userId ?? d.author_id ?? d.user_id ?? null,
    authorEmail: d.authorEmail ?? d.author_email ?? d.userEmail ?? d.user_email ?? null,
    createdAt: d.createdAt ?? d.created_at ?? null,
    updatedAt: d.updatedAt ?? d.updated_at ?? null,
    repImageUrl: d.repImageUrl ?? d.rep_image_url ?? null,
    youtubeId: d.youtubeId ?? d.youtube_id ?? null,
  };
}

function Meta({ author, createdAt }) {
  const dt = createdAt ? new Date(createdAt) : null;
  const fmt = dt ? dt.toLocaleString() : "";
  return (
    <div className="text-secondary small d-flex gap-2 flex-wrap">
      {author != null && <span>작성자 #{author}</span>}
      {author != null && <span>·</span>}
      <span>{fmt}</span>
    </div>
  );
}

/* ─────────────── 키 헬퍼 (provider까지 포함) ─────────────── */
const likeKey = (uid, provider, id) => `postLike:${uid}:${provider}:${id}`;
const bmKey = (uid, provider, id) => `postBookmark:${uid}:${provider}:${id}`;
const bmDataKey = (uid, provider, id) => `postBookmarkData:${uid}:${provider}:${id}`;

/* 레거시 키 흡수
   - postBookmark:<id>, postBookmarkData:<id>
   - postBookmark:<uid>:<id>, postBookmarkData:<uid>:<id>
   - postLike:<uid>:<id>
   을 모두 post*:<uid>:<provider>:<id> 로 이전 */
function migrateLegacyForThisPost(uid, provider, postId) {
  if (!uid || !provider || !postId) return;
  try {
    // 1) 완전 레거시(아이디만)
    const legacyBM = `postBookmark:${postId}`;
    const legacyBMD = `postBookmarkData:${postId}`;
    const v1 = localStorage.getItem(legacyBM);
    const d1 = localStorage.getItem(legacyBMD);
    if (v1 !== null) {
      localStorage.setItem(bmKey(uid, provider, postId), v1);
      localStorage.removeItem(legacyBM);
    }
    if (d1) {
      localStorage.setItem(bmDataKey(uid, provider, postId), d1);
      localStorage.removeItem(legacyBMD);
    }

    // 2) uid만 있는 중간 버전
    const midBM = `postBookmark:${uid}:${postId}`;
    const midBMD = `postBookmarkData:${uid}:${postId}`;
    const midLike = `postLike:${uid}:${postId}`;
    const v2 = localStorage.getItem(midBM);
    const d2 = localStorage.getItem(midBMD);
    const l2 = localStorage.getItem(midLike);
    if (v2 !== null) {
      localStorage.setItem(bmKey(uid, provider, postId), v2);
      localStorage.removeItem(midBM);
    }
    if (d2) {
      localStorage.setItem(bmDataKey(uid, provider, postId), d2);
      localStorage.removeItem(midBMD);
    }
    if (l2 !== null) {
      localStorage.setItem(likeKey(uid, provider, postId), l2);
      localStorage.removeItem(midLike);
    }
  } catch {}
}

export default function PostDetailPage() {
  console.log("PostDetail LOADED v-2025-09-21-ns2");

  const { id } = useParams();
  const navigate = useNavigate();
  const loc = useLocation();

  /** 로그인 상태 */
  const [auth, setAuth] = useState({ loading: true, user: null });
  const [uid, setUid] = useState(null);
  const [provider, setProvider] = useState(null);

  const syncAuth = useCallback(async () => {
    const u = await fetchMe();
    setAuth({ loading: false, user: u ?? null });
    setUid(u?.uid ?? null);
    setProvider(u?.provider ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await fetchMe();
      if (mounted) {
        setAuth({ loading: false, user: u ?? null });
        setUid(u?.uid ?? null);
        setProvider(u?.provider ?? null);
      }
    })();

    const onFocus = () => syncAuth();
    const onVisible = () => { if (document.visibilityState === "visible") syncAuth(); };
    const onStorage = (e) => { if (!e || !e.key || e.key.startsWith("auth")) syncAuth(); };
    const onAuthChanged = () => syncAuth();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, [syncAuth]);

  /** 게시글 */
  const [post, setPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingPost(true);
        const raw = await getCommunityPost(id);
        const norm = normalizePost(raw);
        if (alive) setPost(norm);
      } catch (e) {
        console.error(e);
        if (alive) setErr(e);
      } finally {
        if (alive) setLoadingPost(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  /** 좋아요/북마크 (provider까지 포함한 키로 저장) */
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!post?.id || !uid || !provider) return;
    try {
      migrateLegacyForThisPost(uid, provider, post.id);
      setLiked(localStorage.getItem(likeKey(uid, provider, post.id)) === "1");
      setBookmarked(localStorage.getItem(bmKey(uid, provider, post.id)) === "1");
    } catch {}
  }, [post?.id, uid, provider]);

  const requireAuth = useCallback(async (fn) => {
    if (auth.user) return fn?.();
    const backTo = `${loc.pathname}${loc.search || ""}`;
    const ok = await ensureLogin(backTo);
    if (ok) {
      await syncAuth();
      fn?.();
    }
  }, [auth.user, loc, syncAuth]);

  const onToggleLike = () =>
    requireAuth(() => {
      if (!uid || !provider || !post?.id) return;
      setLiked((prev) => {
        const next = !prev;
        try { localStorage.setItem(likeKey(uid, provider, post.id), next ? "1" : "0"); } catch {}
        logActivity("post_like", { postId: post.id, title: post.title, on: next });
        return next;
      });
    });

  const onToggleBookmark = () =>
    requireAuth(() => {
      if (!uid || !provider || !post?.id) return;
      setBookmarked((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(bmKey(uid, provider, post.id), next ? "1" : "0");
          const dataK = bmDataKey(uid, provider, post.id);
          if (next) {
            const payload = {
              id: post.id,
              title: post.title,
              category: post.category,
              createdAt: post.createdAt || post.updatedAt || null,
              repImageUrl: post.repImageUrl || null,
              youtubeId: post.youtubeId || null,
              tags: Array.isArray(post.tags) ? post.tags : [],
            };
            localStorage.setItem(dataK, JSON.stringify(payload));
          } else {
            localStorage.removeItem(dataK);
          }
          logActivity("post_bookmark", { postId: post.id, title: post.title, on: next });
        } catch {}
        return next;
      });
    });

  // 편집 권한
  const canEdit =
    !!auth.user?.authenticated &&
    (
      (post?.authorId != null && String(post.authorId) === String(auth.user.uid)) ||
      (!!post?.authorEmail && post.authorEmail === auth.user.email)
    );

  if (loadingPost) {
    return (
      <div className="container-xxl py-3">
        <div className="placeholder-glow">
          <h1 className="h4 placeholder col-6"></h1>
          <p className="placeholder col-3"></p>
          <p className="placeholder col-12"></p>
          <p className="placeholder col-10"></p>
          <p className="placeholder col-8"></p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (err) {
    return (
      <div className="container-xxl py-3">
        <div className="alert alert-danger">불러오는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.</div>
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>뒤로가기</button>
        <BottomNav />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container-xxl py-3">
        <div className="alert alert-secondary">게시글을 찾을 수 없어요.</div>
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>뒤로가기</button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <nav className="mb-3 d-flex gap-2 align-items-center justify-content-between">
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>← 목록</button>
        {canEdit && (
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => navigate(`/write?id=${post.id}`)}
            >
              수정
            </button>
          </div>
        )}
      </nav>

      <article className="card shadow-sm">
        <div className="card-body">
          {(post.category || (post.tags && post.tags.length)) && (
            <div className="d-flex align-items-center gap-2 mb-2">
              {post.category && (
                <span className="badge rounded-pill bg-light text-dark border">{post.category}</span>
              )}
              {post.tags?.map((t) => (
                <span key={t} className="badge rounded-pill bg-light text-dark border">#{t}</span>
              ))}
            </div>
          )}

          <h1 className="h4 mb-1">{post.title || "제목 없음"}</h1>
          <Meta author={post.authorId} createdAt={post.createdAt || post.updatedAt} />

          {!auth.loading && (
            auth.user ? (
              <div className="mt-3 d-flex gap-2">
                <button
                  className={`btn btn-sm ${liked ? "btn-danger" : "btn-outline-danger"}`}
                  onClick={onToggleLike}
                  aria-pressed={liked}
                  aria-label="좋아요"
                >
                  {liked ? "❤️ 좋아요 취소" : "🤍 좋아요"}
                </button>
                <button
                  className={`btn btn-sm ${bookmarked ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={onToggleBookmark}
                  aria-pressed={bookmarked}
                  aria-label="북마크"
                >
                  {bookmarked ? "📌 북마크 해제" : "📌 북마크"}
                </button>
              </div>
            ) : (
              <div className="mt-3 text-secondary small">
                좋아요/북마크는{" "}
                <button
                  className="btn btn-link p-0 align-baseline"
                  onClick={async () => {
                    const ok = await ensureLogin(`/community/${post.id}`);
                    if (ok) location.reload();
                  }}
                >
                  로그인
                </button>{" "}
                후 사용할 수 있어요.
              </div>
            )
          )}

          <hr />

          <div className="mt-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {post.content ? post.content : <span className="text-secondary">내용이 비어 있습니다.</span>}
          </div>

          {!auth.loading && (
            auth.user ? (
              <div className="mt-4" id="comment-editor">
                <label className="form-label">댓글</label>
                <textarea className="form-control" rows="4" placeholder="댓글을 입력하세요..." />
                <div className="text-end mt-2">
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      logActivity("comment_create", { postId: post.id, title: post.title });
                      alert("댓글 등록(예시)");
                    }}
                  >
                    등록
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 alert alert-light border d-flex justify-content-between align-items-center">
                <span className="text-secondary">댓글을 쓰려면 로그인하세요.</span>
                <button
                  className="btn btn-success"
                  onClick={async () => {
                    const ok = await ensureLogin(`/community/${post.id}`);
                    if (ok) location.reload();
                  }}
                >
                  로그인
                </button>
              </div>
            )
          )}
        </div>
      </article>

      <div className="text-center text-secondary small mt-2">PostDetail v-2025-09-21-ns2</div>

      <footer className="text-center text-secondary mt-4">
        <div className="small">* 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.</div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
