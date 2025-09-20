// src/pages/PostDetailPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../components/BottomNav";
import { ensureLogin, fetchMe } from "../lib/auth";
import { getCommunityPost } from "../api/community";
import { logActivity } from "../lib/activity";

function normalizePost(raw) {
  if (!raw) return null;
  let d = raw;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch {} }
  if (d && d.bodyPreview && !d.id) { try { d = JSON.parse(d.bodyPreview); } catch {} }
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

function isNumericId(id) {
  return typeof id === "string" && /^[0-9]{1,19}$/.test(id);
}

export default function PostDetailPage() {
  console.log("PostDetail LOADED v-2025-09-21");
  const { id } = useParams();
  const navigate = useNavigate();
  const loc = useLocation();

  const [auth, setAuth] = useState({ loading: true, user: null });
  const syncAuth = useCallback(async () => {
    const u = await fetchMe();
    setAuth({ loading: false, user: u ?? null });
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await fetchMe();
      if (mounted) setAuth({ loading: false, user: u ?? null });
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

  const [post, setPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;

    // 숫자 ID가 아니면 API 호출하지 않고 404 UX
    if (!isNumericId(String(id))) {
      setErr({ code: 404, message: "INVALID_ID" });
      setLoadingPost(false);
      return () => { alive = false; };
    }

    (async () => {
      try {
        setLoadingPost(true);
        const raw = await getCommunityPost(String(id));
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

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!post?.id) return;
    try {
      setLiked(localStorage.getItem(`postLike:${post.id}`) === "1");
      setBookmarked(localStorage.getItem(`postBookmark:${post.id}`) === "1");
    } catch {}
  }, [post?.id]);

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
      setLiked((prev) => {
        const next = !prev;
        try { localStorage.setItem(`postLike:${post.id}`, next ? "1" : "0"); } catch {}
        logActivity("post_like", { postId: post.id, title: post.title, on: next });
        return next;
      });
    });

  const onToggleBookmark = () =>
  requireAuth(() => {
    setBookmarked((prev) => {
      const next = !prev;
      try {
        const id = String(post.id);
        const uid = String(auth.user?.uid ?? '');

        const payload = {
          id: post.id,
          title: post.title,
          category: post.category,
          createdAt: post.createdAt || post.updatedAt || null,
          repImageUrl: post.repImageUrl || null,
          youtubeId: post.youtubeId || null,
          tags: Array.isArray(post.tags) ? post.tags : [],
        };

        if (next) {
          // 레거시(비네임스페이스)
          localStorage.setItem(`postBookmark:${id}`, '1');
          localStorage.setItem(`postBookmarkData:${id}`, JSON.stringify(payload));
          // 네임스페이스(현재 로그인 uid)
          if (uid) {
            localStorage.setItem(`postBookmark:${uid}:${id}`, '1');
            localStorage.setItem(`postBookmarkData:${uid}:${id}`, JSON.stringify(payload));
          }
        } else {
          // 레거시
          localStorage.setItem(`postBookmark:${id}`, '0');
          localStorage.removeItem(`postBookmarkData:${id}`);
          // 네임스페이스
          if (uid) {
            localStorage.setItem(`postBookmark:${uid}:${id}`, '0');
            localStorage.removeItem(`postBookmarkData:${uid}:${id}`);
          }
        }

        logActivity('post_bookmark', { postId: post.id, title: post.title, on: next });
      } catch {}
      return next;
    });
  });
  const canEdit =
    !!auth.user?.authenticated &&
    ((post?.authorId != null && String(post.authorId) === String(auth.user.uid)) ||
     (!!post?.authorEmail && post.authorEmail === auth.user.email));

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

  // 404/잘못된 ID UX
  if (err && (err.code === 404 || String(err.message).includes('INVALID_ID'))) {
    return (
      <div className="container-xxl py-3">
        <div className="alert alert-secondary">게시글을 찾을 수 없어요.</div>
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>뒤로가기</button>
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

      <div className="text-center text-secondary small mt-2">PostDetail v-2025-09-21</div>

      <footer className="text-center text-secondary mt-4">
        <div className="small">* 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.</div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
