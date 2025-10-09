import { useState } from 'react';
import { ensureLogin } from '../lib/auth';
import { createComment } from '../api/comments';

export default function CommentEditor({ postId, onCreated }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const me = await ensureLogin(`/community/${postId}`);
    if (!me) return;
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await createComment(postId, { content: text.trim() });
      onCreated?.(c);
      setText('');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 comment-editor">
      <textarea className="form-control" rows={3}
        placeholder="댓글을 입력하세요…" value={text}
        onChange={(e)=>setText(e.target.value)} />
      <div className="text-end mt-2">
        <button className="btn btn-success" disabled={busy}>
          {busy ? '등록 중…' : '등록'}
        </button>
      </div>
    </form>
  );
}