import { useState } from 'react';
import { updateComment, deleteComment } from '../api/comments';

export default function CommentItem({ c, canEdit, onUpdated, onDeleted }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(c.content || '');

  async function onSave() {
    const next = await updateComment(c.id, { content: text });
    onUpdated?.(next); setEdit(false);
  }
  async function onRemove() {
    if (!confirm('삭제할까요?')) return;
    await deleteComment(c.id);
    onDeleted?.(c.id);
  }

  return (
    <div className="d-flex gap-2 py-2 border-bottom">
      {c.authorAvatar && <img src={c.authorAvatar} alt="" width={28} height={28} className="rounded-circle border" />}
      <div className="flex-grow-1">
        <div className="small text-secondary d-flex gap-2">
          <span className="text-dark fw-semibold">{c.authorName || `작성자#${c.authorId}`}</span>
          <span>·</span>
          <span>{new Date(c.createdAt).toLocaleString()}</span>
        </div>

        {!edit ? (
          <div className="mt-1">{c.deleted ? <span className="text-secondary">삭제된 댓글입니다.</span> : c.content}</div>
        ) : (
          <div className="mt-2">
            <textarea className="form-control" rows={3} value={text} onChange={(e)=>setText(e.target.value)} />
            <div className="mt-2 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={onSave}>저장</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={()=>setEdit(false)}>취소</button>
            </div>
          </div>
        )}

        {canEdit && !c.deleted && !edit && (
          <div className="mt-1 d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={()=>setEdit(true)}>수정</button>
            <button className="btn btn-outline-danger btn-sm" onClick={onRemove}>삭제</button>
          </div>
        )}
      </div>
    </div>
  );
}