// src/lib/http.js

// ===== API_BASE 결정 =====
// - DEV: VITE_API_BASE 사용 (예: http://localhost:8080)
// - PROD: VITE_API_BASE의 오리진이 현재 오리진과 다르면 무시하고 상대경로 사용


const RAW_API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '');

function safeResolveBase(raw) {
  if (!raw) return '';
  try {
    const resolved = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    return resolved.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const API_BASE = (() => {
  const base = safeResolveBase(RAW_API_BASE);
  if (!base) return '';
  if (typeof window === 'undefined') return base;

  const wOrigin = window.location.origin;
  const bOrigin = new URL(base).origin;
  const sameOrigin = bOrigin === wOrigin;

  // ✅ dev(vite)에서는 오리진 달라도 VITE_API_BASE 사용
  if (import.meta?.env?.DEV) return base;

  // ✅ prod에서는 same-origin일 때만 사용, 아니면 상대경로 사용
  return sameOrigin ? base : '';
})();

/* =========================
 * helpers
 * ========================= */
function isAbs(u) {
  return /^https?:\/\//i.test(u);
}

function usingHashRouter() {
  // 해시가 "#/..." 형태면 HashRouter로 간주
  return typeof window !== 'undefined' && /^#\//.test(window.location.hash || '');
}

function currentSpaPath() {
  if (typeof window === 'undefined') return '/';
  const { hash, pathname, search } = window.location;
  return /^#\//.test(hash) ? hash.slice(1) : (pathname + search);
}

function isAuthScreen(spaPath) {
  // 로그인/콜백 화면은 401 리다이렉트 루프 방지
  return spaPath.startsWith('/login-signup') || spaPath.startsWith('/auth/callback');
}

function loginScreenPath() {
  return usingHashRouter() ? '/#/login-signup' : '/login-signup';
}

/* =========================
 * URL 빌더: /api 경로만 API_BASE 붙임
 * ========================= */
export function buildUrl(input) {
  if (!input) return input;
  if (isAbs(input)) return input;
  // API 경로만 프록시/백엔드 베이스에 붙임
  if (API_BASE && input.startsWith('/api')) {
    return `${API_BASE}${input}`;
  }
  return input;
}

/* =========================
 * 공용 fetch 래퍼
 * ========================= */
export async function apiFetch(input, options = {}) {
  const {
    noAuthRedirect = false, // 401 자동 이동 끄기
    headers: userHeaders,
    body: userBody,
    method,
    ...rest
  } = options;

  const url = buildUrl(input);
  const headers = new Headers(userHeaders || {});
  let body = userBody;

  // 기본 Accept (없을 때만)
  if (![...headers.keys()].some(k => k.toLowerCase() === 'accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  const isForm = (typeof FormData !== 'undefined') && (userBody instanceof FormData);
  const isJSONCandidate = userBody && typeof userBody === 'object' && !isForm;

  const m = (method || 'GET').toUpperCase();
  if (isJSONCandidate && m !== 'GET') {
    if (![...headers.keys()].some(k => k.toLowerCase() === 'content-type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(userBody);
  } else if (m === 'GET') {
    // GET이면 바디 제거
    body = undefined;
  }

  const res = await fetch(url, {
    credentials: 'include', // 세션/로그인 쿠키 포함
    cache: 'no-store',
    method: m,
    headers,
    body,
    ...rest,
  });

  // 401 공통 처리 (옵션으로 끌 수 있음)
  if (res.status === 401 && !noAuthRedirect) {
    const here = currentSpaPath();
    if (!isAuthScreen(here)) {
      try { localStorage.setItem('postLoginRedirect', here); } catch {}
    }

    if (!window.__RF_AUTH_ALERT__) {
      window.__RF_AUTH_ALERT__ = true;
      alert('로그인이 필요합니다. 로그인/회원가입 페이지로 이동합니다.');
      setTimeout(() => { window.__RF_AUTH_ALERT__ = false; }, 1000);
    }

    window.location.assign(loginScreenPath());
  }

  return res;
}

/* =========================
 * 편의 메소드
 * ========================= */
export const http = {
  get: (u, opts)  => apiFetch(u, { ...(opts || {}), method: 'GET' }),
  post: (u, body, opts) =>
    apiFetch(u, { ...(opts || {}), method: 'POST', body }),
  put: (u, body, opts)  =>
    apiFetch(u, { ...(opts || {}), method: 'PUT', body }),
  patch: (u, body, opts) =>
    apiFetch(u, { ...(opts || {}), method: 'PATCH', body }),
  del: (u, opts)  => apiFetch(u, { ...(opts || {}), method: 'DELETE' }),
};

/* =========================
 * 디버그(선택): 현재 적용된 API_BASE 확인용
 * ========================= */
export function getApiBaseForDebug() {
  return { RAW_API_BASE, API_BASE, origin: typeof window !== 'undefined' ? window.location.origin : '' };
}