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
  const url = '/api/community/posts';
  const res = await apiFetch(url, {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) {
    const t = await readText(res);
    console.error('[CREATE POST FAIL]', url, res.status, t);
    throw new Error(`글 생성 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id }
}

/** 글 단건 조회 (긴 ID 안전, 라우트 폴백 포함) */
export async function getCommunityPost(id) {
  const pid = String(id); // 항상 문자열로 유지
  const urls = [
    `/api/community/posts/${encodeURIComponent(pid)}`,           // 현행
    `/api/community/${encodeURIComponent(pid)}`,                 // 레거시 호환
    `/api/community/post?id=${encodeURIComponent(pid)}`,         // 쿼리스트링 우회
  ];

  let lastStatus = 0;
  let lastBody = '';

  for (const url of urls) {
    try {
      const res = await apiFetch(url, { cache: 'no-store' });
      if (res.ok) {
        const j = await safeJson(res);
        if (j != null) return j;
        const t = await readText(res);
        try { return JSON.parse(t); } catch { return { raw: t }; }
      }
      lastStatus = res.status;
      lastBody = await readText(res);
      console.warn('[GET POST FAIL]', url, lastStatus, lastBody);
      // 401/403은 즉시 실패로 반환해도 되지만, 여기서는 일단 폴백 계속 시도
      continue;
    } catch (e) {
      console.warn('[GET POST EXCEPTION]', url, e);
      lastStatus = 0;
      lastBody = String(e?.message || e);
    }
  }

  console.error('[GET COMMUNITY POST FAILED]', { id: pid, lastStatus, lastBody });
  throw new Error(`글 조회 실패(${lastStatus || 'EX'})`);
}

/** 글 수정 */
export async function updatePost(id, payload) {
  const pid = String(id);
  const url = `/api/community/posts/${encodeURIComponent(pid)}`;
  const res = await apiFetch(url, {
    method: 'PUT',
    body: payload,
  });
  if (!res.ok) {
    const t = await readText(res);
    // 백엔드에서 권한 체크 실패 시 401/403이 떨어질 수 있음
    console.error('[UPDATE POST FAIL]', url, res.status, t);
    throw new Error(`글 수정 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id } 또는 { ok:true } 등
}

/** 내가 쓴 글 (최신 N) */
export async function getMyPosts(size = 3) {
  const url = `/api/community/my-posts?size=${encodeURIComponent(size)}`;
  const res = await apiFetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const t = await readText(res);
    console.warn('[GET MY POSTS FAIL]', url, res.status, t);
    return [];
  }
  return res.json();
}

/* (선택) API 엔드포인트 확인용 디버그 */
export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${String(id)}`),
    altGetUrl1: (id) => buildUrl(`/api/community/${String(id)}`),
    altGetUrl2: (id) => buildUrl(`/api/community/post?id=${encodeURIComponent(String(id))}`),
    updateUrl: (id) => buildUrl(`/api/community/posts/${String(id)}`),
  };
}
