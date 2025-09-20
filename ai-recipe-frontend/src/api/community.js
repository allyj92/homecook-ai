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
