// src/components/CommentItem.jsx
import { useState, useMemo } from 'react';
import { updateComment, deleteComment } from '../api/community'; // ✅ 경로 변경
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

export default function CommentItem({ c, canEdit, onUpdated, onDeleted, showAvatar = false }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(c.content || '');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const postId = c.postId; // ✅ 서버가 내려주는 postId 사용

const mdComment = useMemo(() => {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
   // ✅ 이미지 토큰 제거
   md.renderer.rules.image = () => '';
   return md;
 }, []);

function safeCommentHtml(src = '') {
  const html = mdComment.render(String(src));
  // ✅ Sanitizer에서 img 비허용
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p","br","blockquote","pre","code","span","strong","em",
      "ul","ol","li","a","h1","h2","h3","h4","h5","h6",
      "hr","table","thead","tbody","tr","th","td"
    ],
    ALLOWED_ATTR: ["href","target","rel","title"],
  });
}

  async function onSave() {
    const body = (text ?? '').trim();
    if (!body) {
      alert('내용을 입력해 주세요.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateComment(postId, c.id, { content: body }); // ✅ postId 포함
      onUpdated?.(next);
      setEdit(false);
    } catch (e) {
      alert(e?.message || '댓글 수정에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!confirm('삭제할까요?')) return;
    if (removing) return;
    setRemoving(true);
    try {
      await deleteComment(postId, c.id); // ✅ postId 포함
      onDeleted?.(c.id); // 상위에서 deleted=true, content='' 처리
    } catch (e) {
      alert(e?.message || '댓글 삭제에 실패했어요.');
      setRemoving(false);
    }
  }

  return (
    <div className="d-flex gap-2 py-2 border-bottom">
      {showAvatar && c.authorAvatar && (
        <img
          src={c.authorAvatar}
          alt=""
          width={28}
          height={28}
          className="rounded-circle border"
          style={{ objectFit: 'cover' }}
        />
      )}
      <div className="flex-grow-1">
        <div className="small text-secondary d-flex gap-2 flex-wrap">
          <span className="text-dark fw-semibold">{c.authorName || `작성자#${c.authorId}`}</span>
          <span>·</span>
          <span>{new Date(c.createdAt).toLocaleString()}</span>
        </div>

        {!edit ? (
          <div className="mt-1">
          {c.deleted ? (
            <span className="text-secondary">삭제된 댓글입니다.</span>
          ) : (
            <div
              className="comment-content"
              dangerouslySetInnerHTML={{ __html: safeCommentHtml(c.content) }}
            />
          )}
        </div>
        ) : (
          <div className="mt-2">
            <textarea
              className="form-control"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
            />
            <div className="mt-2 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setEdit(false)}
                disabled={saving}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {canEdit && !c.deleted && !edit && (
          <div className="mt-1 d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setEdit(true)}>
              수정
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={onRemove}
              disabled={removing}
            >
              {removing ? '삭제 중…' : '삭제'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}