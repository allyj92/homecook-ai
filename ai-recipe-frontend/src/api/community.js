// src/api/community.js
import { apiFetch, buildUrl } from '../lib/http';

/* =========================
 * 내부 유틸
 * ========================= */
async function safeJson(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
}

async function readText(res) {
  try { return await res.text(); } catch { return ''; }
}

function err401() {
  const e = new Error('401 UNAUTHORIZED');
  e.status = 401;
  return e;
}

function mkError(prefix, res, extra = '') {
  const e = new Error(`${prefix}: ${res?.status ?? ''} ${extra}`.trim());
  e.status = res?.status;
  return e;
}

/** 글 생성 */
export async function createPost(payload) {
  const res = await apiFetch('/api/community/posts', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`글 생성 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id }
}

/** 글 단건 조회 */
export async function getCommunityPost(id) {
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('글 조회 실패');
  return res.json();
}

/** 글 수정 */
export async function updatePost(id, payload) {
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    // 백엔드에서 권한 체크 실패 시 401/403이 떨어질 수 있음
    throw new Error(`글 수정 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id } 또는 { ok:true } 등
}

/** 내가 쓴 글 (최신 N) */
export async function getMyPosts(size = 3) {
  const res = await apiFetch(`/api/community/my-posts?size=${encodeURIComponent(size)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

/* (선택) API 엔드포인트 확인용 디버그 */
export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${id}`),
    updateUrl: (id) => buildUrl(`/api/community/posts/${id}`),
  };
}