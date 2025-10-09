// src/api/community.js
import { apiFetch, buildUrl } from '../lib/http';

async function readText(res) {
  try { return await res.text(); } catch { return ''; }
}

// 숫자 ID만 허용 (최대 19자리: Long 범위)
function isNumericId(id) {
  return typeof id === 'string' && /^[0-9]{1,19}$/.test(id);
}

export async function createPost(payload) {
  const url = '/api/community/posts';
  const res = await apiFetch(url, { method: 'POST', body: payload });
  if (!res.ok) {
    const body = await readText(res);
    throw new Error(`글 생성 실패: ${res.status} ${body}`);
  }
  return res.json(); // { id }
}

export async function getCommunityPost(id) {
  const pid = String(id);
  if (!isNumericId(pid)) {
    throw new Error('INVALID_ID');
  }
  const url = `/api/community/posts/${encodeURIComponent(pid)}`;
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await readText(res);
    console.error('[GET FAIL]', url, res.status, body);
    throw new Error(`글 조회 실패(${res.status})`);
  }
  return res.json();
}

export async function updatePost(id, payload) {
  const pid = String(id);
  if (!isNumericId(pid)) {
    throw new Error('INVALID_ID');
  }
  const url = `/api/community/posts/${encodeURIComponent(pid)}`;
  const res = await apiFetch(url, { method: 'PUT', body: payload });
  if (!res.ok) {
    const body = await readText(res);
    throw new Error(`글 수정 실패: ${res.status} ${body}`);
  }
  return res.json();
}

export async function getMyPosts(size = 3) {
  const url = `/api/community/my-posts?size=${encodeURIComponent(size)}`;
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await readText(res);
    console.warn('[GET MY POSTS FAIL]', url, res.status, body);
    return [];
  }
  return res.json();
}

export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${String(id)}`),
    updateUrl: (id) => buildUrl(`/api/community/posts/${String(id)}`),
  };
}

function assertNumericId(id, name = 'id') {
  const s = String(id ?? '');
  if (!/^[0-9]{1,19}$/.test(s)) throw new Error(`INVALID_${name.toUpperCase()}`);
  return s;
}

/** 목록(커서 기반) — GET /api/community/posts/{postId}/comments?cursor=&size= */
export async function fetchComments(postId, { cursor = null, size = 20 } = {}) {
  const pid = assertNumericId(postId, 'postId');
  const qs = new URLSearchParams();
  if (cursor != null) qs.set('cursor', String(cursor));
  qs.set('size', String(size));

  const url = `/api/community/posts/${encodeURIComponent(pid)}/comments?${qs.toString()}`;
  const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const body = await readText(res);
    throw new Error(`댓글 목록 실패: ${res.status} ${body}`);
  }
  // { items, nextCursor, total }
  return res.json();
}

/** 작성 — POST /api/community/posts/{postId}/comments */
export async function createComment(postId, { content, parentId = null }) {
  const pid = assertNumericId(postId, 'postId');
  const body = { content, parentId };
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(pid)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const txt = await readText(res);
    throw new Error(`댓글 작성 실패: ${res.status} ${txt}`);
  }
  // CommentRes
  return res.json();
}

/** 수정 — PUT /api/community/posts/{postId}/comments/{commentId} */
export async function updateComment(postId, commentId, { content }) {
  const pid = assertNumericId(postId, 'postId');
  const cid = assertNumericId(commentId, 'commentId');

  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(pid)}/comments/${encodeURIComponent(cid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status === 403) throw new Error('FORBIDDEN');
    if (res.status === 404) throw new Error('NOT_FOUND');
    const txt = await readText(res);
    throw new Error(`댓글 수정 실패: ${res.status} ${txt}`);
  }
  // CommentRes
  return res.json();
}

/** 삭제(소프트) — DELETE /api/community/posts/{postId}/comments/{commentId} */
export async function deleteComment(postId, commentId) {
  const pid = assertNumericId(postId, 'postId');
  const cid = assertNumericId(commentId, 'commentId');

  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(pid)}/comments/${encodeURIComponent(cid)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  // 백엔드가 204 No Content 반환
  if (res.status === 204) return true;
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (res.status === 404) throw new Error('NOT_FOUND');

  const txt = await readText(res);
  throw new Error(`댓글 삭제 실패: ${res.status} ${txt}`);
}
