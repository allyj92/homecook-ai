import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../compoments/BottomNav";
import { ensureLogin } from "../lib/auth";
import { createPost, getCommunityPost, updatePost } from "../api/community";
import { uploadFile, ytThumb } from "../lib/upload";
import { logActivity } from "../lib/activity";

const CATEGORIES = ["후기", "질문", "레시피", "노하우", "자유"];

/* 유튜브 URL/ID → videoId */
function toYoutubeId(url) {
  if (!url) return null;
  const u = url.trim();
  let m;
  if ((m = u.match(/youtu\.be\/([A-Za-z0-9_\-]{8,})/))) return m[1];
  if ((m = u.match(/[?&]v=([A-Za-z0-9_\-]{8,})/))) return m[1];
  if ((m = u.match(/\/shorts\/([A-Za-z0-9_\-]{8,})/))) return m[1];
  if (/^[A-Za-z0-9_\-]{8,32}$/.test(u)) return u; // ID만 들어온 경우
  return null;
}

/* 상세 응답을 폼 상태로 정규화 */
function normalizePost(raw) {
  if (!raw) return null;
  const d = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
  return {
    id: d.id ?? d.postId ?? null,
    title: d.title ?? d.subject ?? "",
    category: d.category ?? d.type ?? CATEGORIES[0],
    content: d.content ?? d.body ?? "",
    tags: Array.isArray(d.tags) ? d.tags : (Array.isArray(d.tagList) ? d.tagList : []),
    repImageUrl: d.repImageUrl ?? d.rep_image_url ?? "",
    youtubeUrl: d.youtubeUrl ?? "",
    youtubeId: d.youtubeId ?? "",
    createdAt: d.createdAt ?? d.created_at ?? null,
    authorId: d.authorId ?? d.userId ?? null,
  };
}

/* 아주 가벼운 마크다운 프리뷰 */
function mdPreview(md) {
  const esc = (s) =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  let html = esc(md || "");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img alt="$1" src="$2" style="max-width:100%;border-radius:8px;margin:8px 0;" />`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>`);
  html = html.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

export default function WritePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // ✅ 수정모드 감지: /write?edit=12 또는 /write?id=12 또는 /community/:id/edit
  const sp = new URLSearchParams(location.search);
  const editParam = sp.get("edit") || sp.get("id");
  const routeParam = params?.id; // 라우터가 /community/:id/edit 같은 걸 WritePage로 매핑했을 때
  const editId = editParam || routeParam || null;
  const isEdit = !!editId;

  // 임시저장 키를 모드별로 분리
  const DRAFT_KEY = isEdit ? `draft:community:edit:${editId}` : "draft:community";

  // 폼 상태
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [content, setContent] = useState("");
  const [repImageUrl, setRepImageUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // 파생
  const youtubeId = useMemo(() => toYoutubeId(youtubeUrl), [youtubeUrl]);
  const youtubeCover = useMemo(
    () => (youtubeId ? ytThumb(youtubeId, "maxresdefault") || ytThumb(youtubeId, "hqdefault") : null),
    [youtubeId]
  );

  // UX 상태
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingInit, setLoadingInit] = useState(true);
  const contentRef = useRef(null);

  // 로그인 보장 + 초기값 로딩
  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await ensureLogin(isEdit ? `/community/${editId}/edit` : "/write");
      if (!me) return;

      try {
        if (isEdit) {
          // 🔹 수정모드: 서버에서 글 로드 → 상태 세팅
          const raw = await getCommunityPost(editId);
          const p = normalizePost(raw) || {};
          if (!alive) return;

          setTitle(p.title || "");
          setCategory(p.category || CATEGORIES[0]);
          setTags(Array.isArray(p.tags) ? p.tags : []);
          setContent(p.content || "");
          setRepImageUrl(p.repImageUrl || "");

          // 기존 글에 youtubeId만 있다면 URL 형태로 보이게 함(수정 편의)
          const initYoutubeUrl =
            p.youtubeUrl ||
            (p.youtubeId ? `https://youtu.be/${p.youtubeId}` : "");
          setYoutubeUrl(initYoutubeUrl);
        } else {
          // 🔹 새 글: 로컬 임시저장 복원
          try {
            const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
            if (saved) {
              setTitle(saved.title || "");
              setCategory(saved.category || CATEGORIES[0]);
              setTags(saved.tags || []);
              setContent(saved.content || "");
              setRepImageUrl(saved.repImageUrl || "");
              setYoutubeUrl(saved.youtubeUrl || "");
            }
          } catch {}
        }
      } finally {
        if (alive) setLoadingInit(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

  // 자동 임시저장
  useEffect(() => {
    if (loadingInit) return;
    const payload = { title, category, tags, content, repImageUrl, youtubeUrl, savedAt: Date.now() };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch {}
  }, [title, category, tags, content, repImageUrl, youtubeUrl, DRAFT_KEY, loadingInit]);

  // 태그
  function tryCommitTag() {
    const raw = tagInput.trim().replace(/^#/, "");
    if (!raw) return;
    if (!tags.includes(raw)) setTags((xs) => [...xs, raw]);
    setTagInput("");
  }
  function removeTag(t) {
    setTags((xs) => xs.filter((x) => x !== t));
  }

  // 검증
  function validate() {
    const e = {};
    if (!title.trim()) e.title = "제목을 입력하세요.";
    else if (title.trim().length < 4) e.title = "제목은 4자 이상 권장해요.";
    if (!content.trim()) e.content = "내용을 입력하세요.";
    else if (content.trim().length < 10) e.content = "내용은 10자 이상 작성해주세요.";
    if (youtubeUrl && !toYoutubeId(youtubeUrl)) e.youtubeUrl = "유효한 유튜브 URL 또는 ID를 입력해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // 본문 이미지 업로드
  function insertAtCursor(textarea, text) {
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const pos = start + text.length;
      textarea.setSelectionRange(pos, pos);
    });
  }
  async function handlePastedFiles(files) {
    for (const f of files) {
      if (!f.type?.startsWith?.("image/")) continue;
      const { url } = await uploadFile(f);
      insertAtCursor(contentRef.current, `\n![](${url})\n`);
    }
  }
  function onPaste(e) {
    const files = Array.from(e.clipboardData?.files || []);
    if (!files.length) return;
    e.preventDefault();
    handlePastedFiles(files).catch((err) => alert(err.message || "이미지 업로드 실패"));
  }
  function onDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    handlePastedFiles(files).catch((err) => alert(err.message || "이미지 업로드 실패"));
  }
  async function onPickRep(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url } = await uploadFile(file);
    setRepImageUrl(url);
  }

  // 제출
  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validate()) {
      if (errors.content && contentRef.current) contentRef.current.focus();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const cleanTags = tags.map((t) => String(t).trim()).filter(Boolean);
      const vid = toYoutubeId(youtubeUrl);
      const finalRep = repImageUrl || (vid ? (ytThumb(vid, "maxresdefault") || ytThumb(vid, "hqdefault")) : "") || "";

      const payload = {
        title: title.trim(),
        category,
        tags: cleanTags,
        content: content.trim(),
        youtubeUrl: youtubeUrl.trim() || null,
        youtubeId: vid || null,
        repImageUrl: finalRep || null,
      };

      if (isEdit) {
        await updatePost(editId, payload);
        try { logActivity("post_update", { postId: Number(editId), title: payload.title }); } catch {}
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/community/${editId}`);
      } else {
        const { id } = await createPost(payload);
        try { logActivity("post_create", { postId: id, title: payload.title }); } catch {}
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/community/${id}`);
      }
    } catch (err) {
      console.error(err);
      if (/401|403/.test(String(err?.message))) {
        const ok = await ensureLogin(isEdit ? `/community/${editId}/edit` : "/write");
        if (ok) alert("로그인이 갱신되었습니다. 다시 저장을 눌러주세요.");
      } else {
        alert(err?.message || "저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [isEdit, editId, title, category, tags, content, youtubeUrl, repImageUrl, submitting, navigate, DRAFT_KEY, errors.content]);

  const tagHint = useMemo(() => (tags.length ? `#${tags.join("  #")}` : "예) 저염, 에어프라이어"), [tags]);

  if (loadingInit) {
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

  return (
    <div className="container-xxl py-3">
      <header className="mb-3">
        <h1 className="h4 mb-1">{isEdit ? "글 수정" : "글쓰기"}</h1>
        <p className="text-secondary small mb-0">
          {isEdit ? "게시글 내용을 수정합니다." : "커뮤니티 가이드에 맞지 않는 글은 숨김/제한될 수 있어요."}
        </p>
      </header>

      <form className="card shadow-sm" onSubmit={onSubmit}>
        <div className="card-body">
          {/* 제목 */}
          <div className="mb-3">
            <label className="form-label">제목</label>
            <input
              type="text"
              className={`form-control ${errors.title ? "is-invalid" : ""}`}
              placeholder="예) 저염 식단으로 한 달 -3.8kg, 이렇게 했어요"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <div className="invalid-feedback">{errors.title}</div>}
          </div>

          {/* 카테고리 */}
          <div className="mb-3">
            <label className="form-label">카테고리</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 대표이미지 + 유튜브 */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label d-flex align-items-center gap-2">
                대표이미지 <span className="text-secondary small">(드래그·드롭/선택)</span>
              </label>
              <div className="border rounded-3 p-2 d-flex align-items-center gap-3">
                <div className="flex-shrink-0">
                  <div
                    style={{
                      width: 120,
                      height: 80,
                      borderRadius: 8,
                      background: "#f3f3f3",
                      backgroundImage: repImageUrl ? `url(${repImageUrl})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                </div>
                <div className="flex-grow-1">
                  <input type="file" accept="image/*" className="form-control" onChange={onPickRep} />
                  {!repImageUrl && youtubeId && (
                    <div className="form-text">* 미선택 시 유튜브 썸네일이 대표이미지로 사용될 수 있어요.</div>
                  )}
                </div>
                {repImageUrl && (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRepImageUrl("")}>
                    제거
                  </button>
                )}
              </div>
            </div>

            {/* 유튜브 URL */}
            <div className="col-12 col-md-6">
              <label className="form-label">유튜브 URL (선택)</label>
              <input
                type="url"
                className={`form-control ${errors.youtubeUrl ? "is-invalid" : ""}`}
                placeholder="https://youtu.be/XXXX 또는 https://www.youtube.com/watch?v=XXXX"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
              {errors.youtubeUrl && <div className="invalid-feedback">{errors.youtubeUrl}</div>}

              {!!youtubeId && (
                <>
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <img
                      src={youtubeCover || ytThumb(youtubeId, "hqdefault")}
                      alt="YT thumbnail"
                      width={120}
                      height={68}
                      style={{ borderRadius: 8, objectFit: "cover" }}
                    />
                    <div className="small text-secondary">유튜브 썸네일이 대표이미지로 사용될 수 있어요.</div>
                  </div>
                  <div className="ratio ratio-16x9 mt-2" style={{ borderRadius: 8, overflow: "hidden" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 태그 */}
          <div className="mb-3">
            <label className="form-label">태그</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="태그 입력 후 Enter (쉼표도 가능)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    tryCommitTag();
                  }
                }}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={tryCommitTag}>추가</button>
            </div>
            <div className="form-text">
              {tags.length ? (
                <>
                  현재 태그:{" "}
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="badge rounded-pill bg-light text-dark border me-1"
                      role="button"
                      onClick={() => removeTag(t)}
                      title="클릭하여 제거"
                    >
                      #{t} ×
                    </span>
                  ))}
                </>
              ) : (
                <>예시: {tagHint}</>
              )}
            </div>
          </div>

          {/* 내용 */}
          <div className="mb-3">
            <label className="form-label d-flex align-items-center gap-2">
              내용 <span className="text-secondary small">(이미지 붙여넣기/드래그 업로드 가능 · Markdown 간단 지원)</span>
            </label>
            <div className="border rounded-3" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <textarea
                ref={contentRef}
                rows={12}
                className={`form-control border-0 ${errors.content ? "is-invalid" : ""}`}
                placeholder={`레시피/후기/질문 내용을 자세히 적어주세요.
- 캡처 이미지를 그대로 붙여 넣으면 자동 업로드됩니다.
- [링크](https://example.com), ![](이미지URL) 같은 마크다운 일부 지원합니다.`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={onPaste}
              />
            </div>
            {errors.content && <div className="invalid-feedback d-block">{errors.content}</div>}

            <details className="mt-2">
              <summary className="text-secondary">미리보기</summary>
              <div className="border rounded-3 p-3 mt-2" dangerouslySetInnerHTML={{ __html: mdPreview(content) }} />
            </details>
          </div>

          {/* 액션 */}
          <div className="d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (confirm("임시저장을 삭제할까요?")) {
                  try { localStorage.removeItem(DRAFT_KEY); } catch {}
                  setTitle("");
                  setCategory(CATEGORIES[0]);
                  setTags([]);
                  setContent("");
                  setRepImageUrl("");
                  setYoutubeUrl("");
                }
              }}
            >
              임시저장 초기화
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => {
                  try {
                    localStorage.setItem(
                      DRAFT_KEY,
                      JSON.stringify({ title, category, tags, content, repImageUrl, youtubeUrl, savedAt: Date.now() })
                    );
                    alert("임시저장 완료!");
                  } catch {}
                }}
              >
                임시저장
              </button>
              <button type="submit" className="btn btn-success" disabled={submitting}>
                {submitting ? (isEdit ? "수정 중…" : "등록 중…") : (isEdit ? "수정하기" : "등록하기")}
              </button>
            </div>
          </div>
        </div>
      </form>

      <footer className="text-center text-secondary mt-4">
        <div className="small">* 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.</div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
