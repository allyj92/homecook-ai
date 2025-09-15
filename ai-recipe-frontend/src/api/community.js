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

/* =========================
 * 글 생성
 * ========================= */
export async function createPost(payload) {
  const res = await apiFetch('/api/community/posts', {
    method: 'POST',
    body: payload, // apiFetch가 JSON 자동 처리
  });

  // 인증 만료
  if (res.status === 401) throw err401();

  // 성공이면 JSON 기대
  if (res.ok) {
    const data = await safeJson(res);
    if (data) return data; // { id, ... }
    // 성공인데 JSON이 아니면(예: HTML 로그인 페이지) 에러로 간주
    const txt = await readText(res);
    throw mkError('글 생성 실패(비정상 응답)', res, txt?.slice(0, 200));
  }

  // 실패 처리
  const t = await readText(res);
  throw mkError('글 생성 실패', res, t?.slice(0, 300));
}

/* =========================
 * 글 수정 (PUT/PATCH 중 백엔드에 맞춰 사용)
 * ========================= */
export async function updatePost(id, payload, method = 'PUT') {
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`, {
    method,
    body: payload,
  });

  if (res.status === 401) throw err401();

  if (res.ok) {
    const data = await safeJson(res);
    if (data) return data;
    const txt = await readText(res);
    throw mkError('글 수정 실패(비정상 응답)', res, txt?.slice(0, 200));
  }

  const t = await readText(res);
  throw mkError('글 수정 실패', res, t?.slice(0, 300));
}

/* =========================
 * 글 단건 조회
 * ========================= */
export async function getCommunityPost(id) {
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 401) throw err401();
    const t = await readText(res);
    throw mkError('글 조회 실패', res, t?.slice(0, 300));
  }
  const data = await safeJson(res);
  if (data) return data;
  // 조회도 JSON이 아닐 경우 방어
  const t = await readText(res);
  throw mkError('글 조회 실패(비정상 응답)', res, t?.slice(0, 200));
}

/* =========================
 * 내가 쓴 글 (최신 N)
 * ========================= */
export async function getMyPosts(size = 3) {
  const res = await apiFetch(`/api/community/my-posts?size=${encodeURIComponent(size)}`, {
    cache: 'no-store',
  });
  if (res.status === 401) {
    // 마이페이지 쪽에서 로그인 처리하므로 401이면 빈 배열 반환
    return [];
  }
  if (!res.ok) {
    return []; // 실패 시에도 화면 보호
  }
  const data = await safeJson(res);
  return Array.isArray(data) ? data : [];
}

/* =========================
 * (선택) API 엔드포인트 확인용 디버그
 * ========================= */
export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${id}`),
    myPostsUrl: buildUrl('/api/community/my-posts'),
  };
}
