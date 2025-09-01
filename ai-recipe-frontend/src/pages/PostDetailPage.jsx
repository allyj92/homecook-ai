// src/pages/PostDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../compoments/BottomNav";
import { ensureLogin } from "../auth/ensureLogin";
import { getCommunityPost } from "../api/community.js";

/** API 응답을 화면용으로 정규화 */
function normalizePost(raw) {
  if (!raw) return null;
  let d = raw;

  // Netlify 함수가 텍스트/래핑으로 줄 수도 있어 방어
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch { /* 그대로 사용 */ }
  }
  if (d && d.bodyPreview && !d.id) {
    // 디버그 래핑 형태 {status, ok, bodyPreview} → bodyPreview 파싱 시도
    try { d = JSON.parse(d.bodyPreview); } catch { /* noop */ }
  }

  return {
    id: d.id ?? d.postId ?? null,
    title: d.title ?? d.subject ?? "",
    category: d.category ?? d.type ?? "",
    content: d.content ?? d.body ?? "",
    tags: Array.isArray(d.tags) ? d.tags : (Array.isArray(d.tagList) ? d.tagList : []),
    authorId: d.authorId ?? d.userId ?? null,
    createdAt: d.createdAt ?? d.created_at ?? null,
    updatedAt: d.updatedAt ?? d.updated_at ?? null,
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

export default function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const raw = await getCommunityPost(id);
        console.log("[PostDetail] raw =", raw);
        const norm = normalizePost(raw);
        console.log("[PostDetail] normalized =", norm);
        if (alive) setPost(norm);
      } catch (e) {
        console.error(e);
        if (alive) setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
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
        <div className="alert alert-danger">
          불러오는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.
        </div>
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
      <nav className="mb-3 d-flex gap-2">
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>← 목록</button>
        <button
          className="btn btn-success ms-auto"
          onClick={async () => {
            const me = await ensureLogin(`/community/${post.id}`);
            if (me) alert("수정/댓글 기능은 추후 추가 예정이에요!");
          }}
        >
          로그인 후 상호작용
        </button>
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

          <hr />

          {/* 내용은 우선 프리텍스트로 표시 (마크다운은 추후) */}
          <div className="mt-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {post.content ? post.content : <span className="text-secondary">내용이 비어 있습니다.</span>}
          </div>
        </div>
      </article>

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
