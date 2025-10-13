// src/pages/PostDetailPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../components/BottomNav";
import { ensureLogin, fetchMe } from "../lib/auth";
import { getCommunityPost } from "../api/community";
import { logActivity, ensureActivityNs } from "../lib/activity";

/* ✅ 마크다운 렌더링 */
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

import CommentList from "../components/CommentList";
import CommentEditor from "../components/CommentEditor";

/* ------------ 이미지 프록시 유틸 (CommunityPage와 동일 컨벤션) ------------- */
const PROXY = "/api/img-proxy?u=";
const toProxied = (u) => (u ? PROXY + encodeURIComponent(u) : null);
function toSafeSrc(u) {
  try {
    const url = new URL(u, window.location.origin);
    if (url.origin === window.location.origin) return url.toString(); // 같은 오리진(상대경로 포함)
    return toProxied(url.toString()); // 외부(https/http)는 프록시
  } catch {
    return typeof u === "string" ? u : "";
  }
}

// 서버 북마크 토글
async function apiToggleBookmark(postId, on) {
  const url = `/api/community/bookmarks/${encodeURIComponent(postId)}`;
  const res = await fetch(url, {
    method: on ? "PUT" : "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("BOOKMARK_TOGGLE_FAILED");
}

/* ── MarkdownIt 설정 ───────────────────────────────────── */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

// ✅ 이미지 토큰 렌더: src 안전 경로로 치환 + 속성 부여
const defaultImage =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIdx = token.attrIndex("src");
  if (srcIdx >= 0) {
    const orig = token.attrs[srcIdx][1];
    token.attrs[srcIdx][1] = toSafeSrc(orig);
  }
  const addAttr = (k, v) => {
    const i = token.attrIndex(k);
    if (i < 0) token.attrPush([k, v]);
    else token.attrs[i][1] = v;
  };
  addAttr("loading", "lazy");
  addAttr("decoding", "async");
  addAttr("fetchpriority", "low");
  addAttr("referrerpolicy", "no-referrer");
  return defaultImage(tokens, idx, options, env, self);
};

// 링크 새 탭 + 안전 속성
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const tIdx = tokens[idx].attrIndex("target");
  if (tIdx < 0) tokens[idx].attrPush(["target", "_blank"]);
  else tokens[idx].attrs[tIdx][1] = "_blank";

  const rIdx = tokens[idx].attrIndex("rel");
  if (rIdx < 0) tokens[idx].attrPush(["rel", "noopener noreferrer nofollow"]);
  else tokens[idx].attrs[rIdx][1] = "noopener noreferrer nofollow";
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const ALLOWED_TAGS = [
  "p","br","blockquote","pre","code","span","strong","em","ul","ol","li",
  "a","h1","h2","h3","h4","h5","h6","hr","table","thead","tbody","tr","th","td",
  "img"
];
const ALLOWED_ATTR = [
  // 링크
  "href","target","rel","title",
  // 이미지
  "src","alt","width","height","loading","decoding","fetchpriority","referrerpolicy"
];

/* ---- 유틸 ---- */
const handleFromEmail = (email) => (email ? "@" + String(email).split("@")[0] : null);
const nameFromEmail = (email) => (email ? String(email).split("@")[0] : null);

const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

/** 텍스트 프리뷰(댓글 내용 짧게) */
function commentPreview(input, maxLen = 80) {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/!\[([^\]]*)]\([^)]*\)/g, (_m, alt) => (alt || "").trim());
  s = s.replace(/\[([^\]]+)]\([^)]*\)/g, (_m, t) => (t || "").trim());
  s = s.replace(/<img[^>]*alt=["']?([^"'>]*)["']?[^>]*>/gi, (_m, alt) => (alt || "").trim());
  s = s.replace(/<a[^>]*>(.*?)<\/a>/gi, (_m, inner) => (inner || "").trim());
  s = s.replace(/\bhttps?:\/\/[^\s)]+/gi, "");
  s = s.replace(/\bwww\.[^\s)]+/gi, "");
  s = s.replace(/<\/?[^>]+>/g, " ");
  s = s.replace(/[#>*`_~\-]{1,}/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) s = "이미지 첨부";
  if (s.length > maxLen) s = s.slice(0, maxLen) + "…";
  return s;
}

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

  const id = d.id ?? d.postId ?? null;
  const email = d.authorEmail ?? d.author_email ?? d.userEmail ?? d.user_email ?? null;

  const authorName   = d.authorName   ?? d.author_name   ?? nameFromEmail(email) ?? (id ? `작성자#${d.authorId ?? d.userId ?? ""}` : "");
  const authorAvatar = d.authorAvatar ?? d.author_avatar ?? null;
  const authorHandle = d.authorHandle ?? d.author_handle ?? handleFromEmail(email);

  return {
    id,
    title: d.title ?? d.subject ?? "",
    category: d.category ?? d.type ?? "",
    content: d.content ?? d.body ?? "",
    contentFormat: d.contentFormat ?? d.content_format ?? null, // ★ 포맷 보존
    tags: Array.isArray(d.tags) ? d.tags : (Array.isArray(d.tagList) ? d.tagList : []),

    authorId: d.authorId ?? d.userId ?? d.author_id ?? d.user_id ?? null,
    authorEmail: email,
    authorName,
    authorAvatar,
    authorHandle,

    createdAt: d.createdAt ?? d.created_at ?? null,
    updatedAt: d.updatedAt ?? d.updated_at ?? null,
    repImageUrl: d.repImageUrl ?? d.rep_image_url ?? null,
    youtubeId: d.youtubeId ?? d.youtube_id ?? null,

    likeCount: d.likeCount ?? d.likes ?? 0,
    bookmarkCount: d.bookmarkCount ?? d.bookmarks ?? d.bmCount ?? 0,
  };
}

/** 작성자/시간 메타 */
function Meta({ authorId, authorName, authorHandle, authorAvatar, createdAt }) {
  const dt = createdAt ? new Date(createdAt) : null;
  const fmt = dt ? dt.toLocaleString() : "";

  return (
    <div className="text-secondary small d-flex gap-2 flex-wrap align-items-center">
      {authorAvatar && (
        <img
          src={authorAvatar}
          alt={authorName || (authorId ? `작성자#${authorId}` : "작성자")}
          width={20}
          height={20}
          className="rounded-circle border"
          style={{ objectFit: "cover" }}
        />
      )}
      {authorName && <span className="text-dark fw-semibold">{authorName}</span>}
      {authorHandle && <span className="text-secondary">{authorHandle}</span>}
      {!authorName && !authorHandle && authorId != null && <span>작성자 #{authorId}</span>}
      {(authorName || authorHandle || authorId != null) && <span>·</span>}
      <span>{fmt}</span>
    </div>
  );
}

/* ─────────────── 키 헬퍼 (provider까지 포함) ─────────────── */
const likeKey = (uid, provider, id) => `postLike:${uid}:${provider}:${id}`;
const bmKey = (uid, provider, id) => `postBookmark:${uid}:${provider}:${id}`;
const bmDataKey = (uid, provider, id) => `postBookmarkData:${uid}:${provider}:${id}`;

function migrateLegacyForThisPost(uid, provider, postId) {
  if (!uid || !provider || !postId) return;
  try {
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

/** HTML 컨텐츠 내 <img>/<a> 정리(프록시/속성 부여) */
function transformHtml(rawHtml = "") {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    doc.querySelectorAll("img").forEach((img) => {
      const orig = img.getAttribute("src") || "";
      img.setAttribute("src", toSafeSrc(orig));
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("fetchpriority", "low");
      img.setAttribute("referrerpolicy", "no-referrer");
      // width 속성이 전혀 없을 때만 기본 폭 제한(안전)
      if (!img.getAttribute("width")) {
        // 컨테이너 대응은 CSS에서 max-width:100%로 처리
      }
    });

    doc.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer nofollow");
    });

    return doc.body.innerHTML;
  } catch {
    return rawHtml;
  }
}

export default function PostDetailPage() {
  console.log("PostDetail LOADED v-2025-10-13 html+md+comments");

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
    try { ensureActivityNs(); } catch {}
  }, []);

  // 활동 로그용 네임스페이스 동기화
  useEffect(() => {
    ensureActivityNs();
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

  // 서버 좋아요 반영
  async function apiToggleLike(postId, on) {
    const url = `/api/community/posts/${encodeURIComponent(postId)}/like`;
    let res = await fetch(url, { method: on ? "POST" : "DELETE", credentials: "include" });
    if (!res.ok && (res.status === 405 || res.status === 400 || res.status === 501)) {
      res = await fetch(url + `?on=${on ? "1" : "0"}`, { method: "POST", credentials: "include" });
    }
    if (!res.ok) throw new Error("LIKE_TOGGLE_FAILED");
    try { return await res.json(); } catch { return null; }
  }

  const onToggleLike = () =>
    requireAuth(async () => {
      if (!uid || !provider || !post?.id) return;

      const nextOn = !liked;
      setLiked(nextOn); // 낙관적 업데이트
      try {
        try { localStorage.setItem(likeKey(uid, provider, post.id), nextOn ? "1" : "0"); } catch {}
        await apiToggleLike(post.id, nextOn);
        logActivity("post_like", { postId: post.id, postTitle: post.title, on: nextOn });
        try { window.dispatchEvent(new Event("activity:changed")); } catch {}
        try {
          window.dispatchEvent(new Event("bookmark-changed"));
          window.dispatchEvent(new Event("activity:changed"));
        } catch {}
      } catch (e) {
        setLiked(!nextOn); // 롤백
        try { localStorage.setItem(likeKey(uid, provider, post.id), !nextOn ? "1" : "0"); } catch {}
        alert("좋아요 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    });

  const onToggleBookmark = () =>
    requireAuth(async () => {
      if (!post?.id) return;

      const next = !bookmarked;
      setBookmarked(next); // 낙관적 반영

      try {
        await apiToggleBookmark(post.id, next);

        try {
          logActivity(next ? "bookmark_add" : "bookmark_remove", {
            postId: post.id,
            postTitle: post.title,
          });
        } catch {}

        try {
          if (uid && provider) {
            localStorage.setItem(bmKey(uid, provider, post.id), next ? "1" : "0");
            localStorage.setItem(
              bmDataKey(uid, provider, post.id),
              JSON.stringify({ postId: post.id, postTitle: post.title })
            );
          }
        } catch {}

        setPost((prev) => {
          if (!prev) return prev;
          const cur = Number(prev.bookmarkCount ?? 0);
          const delta = next ? 1 : -1;
          return { ...prev, bookmarkCount: Math.max(0, cur + delta) };
        });

        try { window.dispatchEvent(new Event("bookmark-changed")); } catch {}
      } catch {
        setBookmarked(!next); // 롤백
        try {
          if (uid && provider) {
            localStorage.setItem(bmKey(uid, provider, post.id), !next ? "1" : "0");
          }
        } catch {}
        alert("북마크 처리에 실패했어요.");
      }
    });

  // 편집 권한
  const canEdit =
    !!auth.user?.authenticated &&
    (
      (post?.authorId != null && String(post.authorId) === String(auth.user.uid)) ||
      (!!post?.authorEmail && post.authorEmail === auth.user.email)
    );

  /* ✅ 포맷 분기: html 은 그대로, md 는 마크다운 렌더 */
  const renderedHtml = useMemo(() => {
    const body = post?.content || "";
    const fmt = (post?.contentFormat || "").toLowerCase();
    const asHtml = fmt === "html" || (!fmt && isLikelyHtml(body));

    if (asHtml) {
      const transformed = transformHtml(body);
      return DOMPurify.sanitize(transformed, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        USE_PROFILES: { html: true },
      });
    } else {
      const raw = md.render(body);
      const lazyRaw = raw.replaceAll("<img ", '<img loading="lazy" ');
      return DOMPurify.sanitize(lazyRaw, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        USE_PROFILES: { html: true },
      });
    }
  }, [post?.content, post?.contentFormat]);

  // 댓글 목록 리프레시 트리거
  const [commentsVersion, setCommentsVersion] = useState(0);

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
              onClick={() =>
                navigate(`/write/${post.id}`, { state: { editId: post.id } })
              }
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

          {/* 작성자 메타 */}
          <Meta
            authorId={post.authorId}
            authorName={post.authorName}
            authorHandle={post.authorHandle || handleFromEmail(post.authorEmail)}
            authorAvatar={post.authorAvatar}
            createdAt={post.createdAt || post.updatedAt}
          />

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

          {/* ✅ 포맷 분기된 안전 HTML 렌더링 */}
          {post.content ? (
            <div
              className="mt-2 post-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <span className="text-secondary">내용이 비어 있습니다.</span>
          )}

          {/* 댓글 섹션 */}
          <section className="mt-4" id="comments">
            <h2 className="h6 mb-3">댓글</h2>

            {!auth.loading && auth.user ? (
              <CommentEditor
                postId={post.id}
                onCreated={(created) => {
                  try {
                    logActivity("comment_create", {
                      postId: post.id,
                      commentId: created?.id,
                      postTitle: post.title,
                      preview: commentPreview(created?.content || created?.text || ""),
                    });
                  } catch {}
                  setCommentsVersion((v) => v + 1);
                  try { window.dispatchEvent(new Event("activity:changed")); } catch {}
                }}
              />
            ) : (
              <div className="alert alert-light border d-flex justify-content-between align-items-center">
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
            )}

            <CommentList
              key={commentsVersion}
              postId={post.id}
              me={auth.user}
              pageSize={20}
              onDeleted={() => setCommentsVersion((v) => v + 1)}
            />
          </section>
        </div>
      </article>

      <div className="text-center text-secondary small mt-2">PostDetail v-2025-10-13</div>

      <footer className="text-center text-secondary mt-4">
        <div className="small">* 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.</div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
