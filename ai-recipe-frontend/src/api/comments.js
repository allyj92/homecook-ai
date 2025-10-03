const BASE = '/api/community';

export async function listComments(postId, { after=null, size=20 } = {}) {
  const qs = new URLSearchParams({ ...(after ? { after } : {}), size: String(size) });
  const res = await fetch(`${BASE}/posts/${postId}/comments?` + qs, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('댓글 목록 실패');
  return res.json(); // { items, nextCursor, total }
}

export async function createComment(postId, { content, parentId=null }) {
  const res = await fetch(`${BASE}/posts/${postId}/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, parentId })
  });
  if (!res.ok) throw new Error('댓글 작성 실패');
  return res.json(); // CommentRes
}

export async function updateComment(commentId, { content }) {
  const res = await fetch(`${BASE}/comments/${commentId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error('댓글 수정 실패');
  return res.json();
}

export async function deleteComment(commentId) {
  const res = await fetch(`${BASE}/comments/${commentId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('댓글 삭제 실패');
  return true;
}