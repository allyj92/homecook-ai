// src/pages/WritePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import BottomNav from "../compoments/BottomNav";
import { ensureLogin } from "../auth/ensureLogin";
import { createCommunityPost } from "../api/community";

const DRAFT_KEY = "draft:community";

const CATEGORIES = ["후기", "질문", "레시피", "노하우", "자유"];

export default function WritePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const contentRef = useRef(null);

  // 0) 진입 시 로그인 보장
  useEffect(() => {
    (async () => {
      const me = await ensureLogin("/write");
      if (!me) return; // ensureLogin 안에서 리다이렉트 처리됨
      // 1) 임시 저장 불러오기
      try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
        if (saved) {
          setTitle(saved.title || "");
          setCategory(saved.category || CATEGORIES[0]);
          setTags(saved.tags || []);
          setContent(saved.content || "");
        }
      } catch {}
    })();
  }, []);

  // 2) 자동 임시저장
  useEffect(() => {
    const payload = { title, category, tags, content, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  }, [title, category, tags, content]);

  // 3) 태그 입력 처리 (Enter/Comma)
  function tryCommitTag() {
    const raw = tagInput.trim().replace(/^#/, "");
    if (!raw) return;
    if (!tags.includes(raw)) setTags((xs) => [...xs, raw]);
    setTagInput("");
  }

  function removeTag(t) {
    setTags((xs) => xs.filter((x) => x !== t));
  }

  // 4) 검증
  function validate() {
    const e = {};
    if (!title.trim()) e.title = "제목을 입력하세요.";
    if (title.trim().length < 4) e.title = "제목은 4자 이상 권장해요.";
    if (!content.trim()) e.content = "내용을 입력하세요.";
    if (content.trim().length < 10) e.content = "내용은 10자 이상 작성해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // 5) 제출
  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      // 내용칸 포커스
      if (errors.content && contentRef.current) contentRef.current.focus();
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        tags,
        content: content.trim(),
      };
      const { id } = await createCommunityPost(payload);
      // 임시 저장 삭제
      localStorage.removeItem(DRAFT_KEY);
      navigate(`/community/${id}`);
    } catch (err) {
      console.error(err);
      alert("등록 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const tagHint = useMemo(
    () => (tags.length ? `#${tags.join("  #")}` : "예) 저염, 에어프라이어"),
    [tags]
  );

  return (
    <div className="container-xxl py-3">
      <header className="mb-3">
        <h1 className="h4 mb-1">글쓰기</h1>
        <p className="text-secondary small mb-0">
          커뮤니티 가이드에 맞지 않는 글은 숨김/제한될 수 있어요.
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
            {errors.title && (
              <div className="invalid-feedback">{errors.title}</div>
            )}
          </div>

          {/* 카테고리 */}
          <div className="mb-3">
            <label className="form-label">카테고리</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={tryCommitTag}
              >
                추가
              </button>
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
            <label className="form-label">내용</label>
            <textarea
              ref={contentRef}
              rows={12}
              className={`form-control ${errors.content ? "is-invalid" : ""}`}
              placeholder={`레시피/후기/질문 내용을 자세히 적어주세요.
- 사진은 하단 '이미지 첨부'에서 업로드 (추가 예정)
- 불필요한 홍보/욕설/비방은 제한될 수 있어요.`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {errors.content && (
              <div className="invalid-feedback">{errors.content}</div>
            )}
            <div className="form-text">
              Markdown 같은 서식은 추후 지원 예정입니다.
            </div>
          </div>

          {/* (선택) 이미지 첨부 섹션 — 이후 업로드 API 연결 예정 */}
          <details className="mb-3">
            <summary className="mb-2">이미지 첨부 (선택)</summary>
            <input type="file" className="form-control" multiple disabled />
            <div className="form-text">
              * MVP 단계에서는 비활성화. 추후 `/api/uploads` 연결 예정.
            </div>
          </details>

          <div className="d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (confirm("임시저장을 삭제할까요?")) {
                  localStorage.removeItem(DRAFT_KEY);
                  setTitle("");
                  setCategory(CATEGORIES[0]);
                  setTags([]);
                  setContent("");
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
                  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
                  if (d) alert("임시저장이 완료되어 있습니다.");
                  else alert("현재 작성 내용이 임시저장 되었습니다.");
                }}
              >
                임시저장
              </button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={submitting}
              >
                {submitting ? "등록 중…" : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      </form>

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
