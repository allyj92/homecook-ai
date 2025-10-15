// src/pages/WritePage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../components/BottomNav";
import { ensureLogin, fetchMe } from "../lib/auth";
import { createPost, updatePost, getCommunityPost } from "../api/community";
import { uploadFile, ytThumb } from "../lib/upload";
import { logActivity } from "../lib/activity";
// import TagInput from "../components/TagInput"; // ❌ 제거
import TuiHtmlEditor from "../components/TuiMdEditor";

const DRAFT_KEY = "draft:community:html";
const CATEGORIES = ["후기", "질문", "레시피", "노하우", "자유"];

const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);
const unescapeIfHtmlEscaped = (s = "") =>
  /&lt;\/?[a-z]/i.test(s)
    ? s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
    : s;

const toYoutubeId = (url) => {
  if (!url) return null;
  const u = url.trim();
  let m;
  if ((m = u.match(/youtu\.be\/([A-Za-z0-9_-]{8,})/))) return m[1];
  if ((m = u.match(/[?&]v=([A-Za-z0-9_-]{8,})/))) return m[1];
  if ((m = u.match(/\/shorts\/([A-Za-z0-9_-]{8,})/))) return m[1];
  if (/^[A-Za-z0-9_-]{8,32}$/.test(u)) return u;
  return null;
};

/** 🔹 이 페이지 전용 간단 태그 입력기 */
function SimpleTagInput({ value, onChange, placeholder = "태그 입력 후 Enter", maxTags = 10 }) {
  const [draft, setDraft] = useState("");

  const add = (t) => {
    const tag = String(t || "").trim();
    if (!tag) return;
    const next = Array.from(new Set([...(value || []), tag])).slice(0, maxTags);
    onChange?.(next);
    setDraft("");
  };

  const removeAt = (idx) => {
    const next = (value || []).filter((_, i) => i !== idx);
    onChange?.(next);
  };

  return (
    <div className="form-control d-flex flex-wrap gap-2 p-2" style={{ minHeight: 46 }}>
      {(value || []).map((t, i) => (
        <span key={`${t}-${i}`} className="badge bg-primary-subtle text-primary border">
          #{t}
          <button
            type="button"
            className="btn btn-sm btn-link text-decoration-none ms-1 p-0"
            onClick={() => removeAt(i)}
            aria-label={`${t} 제거`}
          >
            ×
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && (value || []).length) {
            e.preventDefault();
            removeAt((value || []).length - 1);
          }
        }}
        placeholder={placeholder}
        className="border-0 flex-grow-1"
        style={{ minWidth: 160, outline: "none" }}
      />
    </div>
  );
}

export default function WritePage() {
  const navigate = useNavigate();
  const loc = useLocation();
  const postFromState = loc.state?.post;

  // 수정 ID
  const params = new URLSearchParams(loc.search);
  let editId = params.get("id");
  if (!editId) {
    const m = loc.pathname.match(/\/write\/(\d+)/);
    if (m) editId = m[1];
  }
  if (!editId && loc.state && typeof loc.state.editId !== "undefined") {
    editId = String(loc.state.editId);
  }
  const isEdit = !!editId;

  // 로그인/유저
  const [auth, setAuth] = useState({ loading: true, user: null });

  // 폼 상태
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tags, setTags] = useState([]);

  // 본문(HTML 저장)
  const [contentHtml, setContentHtml] = useState("");

  // 에디터 초기값/포맷
  const [initialValue, setInitialValue] = useState("");
  const [initialFormat, setInitialFormat] = useState("auto");

  const [repImageUrl, setRepImageUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // UX
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [repUploading, setRepUploading] = useState(false);

  // 유튜브
  const youtubeId = useMemo(() => toYoutubeId(youtubeUrl), [youtubeUrl]);
  const youtubeCover = useMemo(
    () => (youtubeId ? ytThumb(youtubeId, "maxresdefault") || ytThumb(youtubeId, "hqdefault") : null),
    [youtubeId]
  );

  // 초기화
  useEffect(() => {
    (async () => {
      const me = await ensureLogin(isEdit ? `/write?id=${editId}` : "/write");
      if (!me) return;
      const u = await fetchMe();
      setAuth({ loading: false, user: u ?? null });

      if (isEdit) {
        try {
          const p = postFromState ?? (await getCommunityPost(editId));
          if (p?.authorId && u?.uid && Number(p.authorId) !== Number(u.uid)) {
            alert("본인의 글만 수정할 수 있어요.");
            navigate(`/community/${editId}`, { replace: true });
            return;
          }

          setTitle(p.title || "");
          setCategory(p.category || CATEGORIES[0]);
          setTags(Array.isArray(p.tags) ? p.tags : []);

          // 원문/포맷 (이스케이프 복원 포함)
          const raw = String(p?.content ?? "");
          const looksHtml = isLikelyHtml(raw) || /&lt;[a-z]/i.test(raw);
          const fmt = p?.contentFormat ?? (looksHtml ? "html" : "md");
          setInitialValue(fmt === "html" ? unescapeIfHtmlEscaped(raw) : raw);
          setInitialFormat(fmt);

          setRepImageUrl(p.repImageUrl || "");
          setYoutubeUrl(p.youtubeId ? `https://youtu.be/${p.youtubeId}` : "");
        } catch (e) {
          console.error(e);
          alert("글을 불러오지 못했어요.");
          navigate(-1);
          return;
        }
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
          if (saved) {
            setTitle(saved.title || "");
            setCategory(saved.category || CATEGORIES[0]);
            setTags(saved.tags || []);
            setInitialValue(saved.contentHtml || "");
            setInitialFormat("html");
            setRepImageUrl(saved.repImageUrl || "");
            setYoutubeUrl(saved.youtubeUrl || "");
          }
        } catch {}
      }
      setLoading(false);
    })();
  }, [isEdit, editId, navigate, postFromState]);

  // 새 글 자동 임시저장
  useEffect(() => {
    if (isEdit) return;
    const timer = setInterval(() => {
      const payload = { title, category, tags, contentHtml, repImageUrl, youtubeUrl, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, 5000);
    return () => clearInterval(timer);
  }, [isEdit, title, category, tags, contentHtml, repImageUrl, youtubeUrl]);

  // 검증
  function validate() {
    const html = (contentHtml || "").replace(/\s+/g, " ").trim();
    const text = html.replace(/<[^>]*>/g, "").trim();
    const e = {};
    if (!title.trim()) e.title = "제목을 입력하세요.";
    else if (title.trim().length < 4) e.title = "제목은 4자 이상 권장해요.";
    if (!text) e.content = "내용을 입력하세요.";
    else if (text.length < 10) e.content = "내용은 10자 이상 작성해주세요.";
    if (youtubeUrl && !youtubeId) e.youtubeUrl = "유효한 유튜브 URL 또는 ID를 입력해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // 대표이미지 업로드
  async function onPickRep(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = /^image\/(png|jpe?g|webp|gif)$/i.test(file.type);
    if (!okType) { alert("PNG, JPG, WEBP, GIF만 업로드할 수 있어요."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("이미지 용량(10MB) 초과입니다."); return; }

    const localUrl = URL.createObjectURL(file);
    setRepImageUrl(localUrl);
    setRepUploading(true);

    try {
      const up = await uploadFile(file);
      const url =
        up?.url || up?.URL || up?.link || up?.location || up?.Location ||
        up?.secure_url || up?.fileUrl || up?.fileURL ||
        (up?.data && (up.data.url || up.data.link || up.data.Location));
      if (!url) throw new Error("업로드 응답에 URL이 없어요.");
      setRepImageUrl(url);
    } catch (err) {
      console.error(err);
      alert(err?.message || "대표이미지 업로드에 실패했습니다.");
      setRepImageUrl(youtubeCover || "");
    } finally {
      setRepUploading(false);
      try { URL.revokeObjectURL(localUrl); } catch {}
    }
  }

  // 제출
  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const html = (contentHtml || "").trim();
      const finalRep = repImageUrl || youtubeCover || "";
      const cleanTags = tags.map((t) => String(t).trim()).filter(Boolean);
      const payload = {
        title: title.trim(),
        category,
        tags: cleanTags,
        content: html,                 // 항상 HTML 저장
        youtubeUrl: youtubeUrl.trim() || null,
        youtubeId,
        repImageUrl: finalRep || null,
        contentFormat: "html",
      };

      if (isEdit) {
        await updatePost(editId, payload);
        try { logActivity("post_update", { postId: Number(editId), title: payload.title }); } catch {}
        navigate(`/community/${editId}`);
      } else {
        const { id } = await createPost(payload);
        try { logActivity("post_create", { postId: id, title: payload.title }); } catch {}
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/community/${id}`);
      }
    } catch (err) {
      console.error(err);
      if (err?.status === 401 || /401/.test(String(err?.message))) {
        const ok = await ensureLogin(isEdit ? `/write?id=${editId}` : "/write");
        if (ok) alert("로그인이 갱신되었습니다. 다시 시도해주세요.");
      } else if (err?.status === 403) {
        alert("본인의 글만 수정할 수 있어요.");
      } else {
        alert(err?.message || "처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [isEdit, editId, title, category, tags, contentHtml, youtubeUrl, youtubeId, repImageUrl, youtubeCover, submitting, navigate]);

  if (loading || auth.loading) {
    return (
      <div className="container-xxl py-3">
        <div className="placeholder-glow">
          <h1 className="h4 placeholder col-6"></h1>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <header className="mb-3">
        <h1 className="h4 mb-1">{isEdit ? "글 수정" : "글쓰기"}</h1>
        <p className="text-secondary small mb-0">커뮤니티 가이드에 맞지 않는 글은 숨김/제한될 수 있어요.</p>
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
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>

          {/* 대표이미지 + 유튜브 */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label d-flex align-items-center gap-2">
                대표이미지 <span className="text-secondary small">(드래그·드롭/선택)</span>
              </label>
              <div className="border rounded-3 p-2 d-flex align-items-center gap-3 position-relative">
                <div className="flex-shrink-0">
                  <div
                    style={{
                      width: 120, height: 80, borderRadius: 8, background: "#f3f3f3",
                      backgroundImage: repImageUrl ? `url(${repImageUrl})` : undefined,
                      backgroundSize: "cover", backgroundPosition: "center",
                    }}
                  />
                </div>
                <div className="flex-grow-1">
                  <input type="file" accept="image/*" className="form-control" onChange={onPickRep} />
                  <div className="form-text">* 미선택 시 유튜브 썸네일을 자동 사용합니다.</div>
                </div>
                {repImageUrl && (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRepImageUrl("")}>
                    제거
                  </button>
                )}
                {repUploading && (
                  <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                       style={{ background: "rgba(255,255,255,0.5)", borderRadius: 12 }}
                       aria-label="업로드 중">
                    <div className="spinner-border text-secondary" role="status" />
                  </div>
                )}
              </div>
            </div>

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

          {/* 태그 — 로컬 구현 */}
          <div className="mb-3">
            <label className="form-label">태그</label>
            <SimpleTagInput
              value={tags}
              onChange={setTags}
              placeholder="태그 입력 후 Enter"
              maxTags={10}
            />
            <div className="form-text">최대 10개 · Enter 로 추가/Backspace 로 삭제</div>
          </div>

          {/* 내용 (에디터) */}
          <div className="mb-3">
            <label className="form-label d-flex align-items-center gap-2">
              내용 <span className="text-secondary small">(이미지 붙여넣기/드래그 업로드 가능)</span>
            </label>
            <div className={`border rounded-3 ${errors.content ? "border-danger" : ""}`}>
              <TuiHtmlEditor
                key={isEdit ? `edit-${editId}` : "new"}
                initialValue={initialValue}
                initialFormat={initialFormat}
                onChange={setContentHtml}
                height="480px"
                placeholder={`레시피/후기/질문 내용을 자유롭게 적어주세요.
- 캡처 이미지를 붙여넣거나 드래그하면 자동 업로드됩니다.`}
                upload={async (blob) => {
                  const up = await uploadFile(blob);
                  const url =
                    up?.url || up?.URL || up?.link || up?.location || up?.Location ||
                    up?.secure_url || up?.fileUrl || up?.fileURL ||
                    (up?.data && (up.data.url || up.data.link || up.data.Location));
                  if (!url) throw new Error("업로드 응답에 URL이 없어요.");
                  if (!repImageUrl) setRepImageUrl(url);
                  return url;
                }}
              />
            </div>
            {errors.content && <div className="invalid-feedback d-block">{errors.content}</div>}
          </div>

          {/* 액션 */}
          <div className="d-flex justify-content-between">
            {!isEdit && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  if (confirm("임시저장을 삭제할까요?")) {
                    localStorage.removeItem(DRAFT_KEY);
                    setTitle(""); setCategory(CATEGORIES[0]); setTags([]);
                    setContentHtml(""); setRepImageUrl(""); setYoutubeUrl("");
                    setInitialValue(""); setInitialFormat("auto");
                  }
                }}
              >
                임시저장 초기화
              </button>
            )}
            <div className="d-flex gap-2 ms-auto">
              {!isEdit && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => {
                    localStorage.setItem(
                      DRAFT_KEY,
                      JSON.stringify({ title, category, tags, contentHtml, repImageUrl, youtubeUrl, savedAt: Date.now() })
                    );
                    alert("임시저장 완료!");
                  }}
                >
                  임시저장
                </button>
              )}
              <button type="submit" className="btn btn-success" disabled={submitting || repUploading}>
                {submitting ? (isEdit ? "수정 중…" : "등록 중…") : isEdit ? "수정하기" : "등록하기"}
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