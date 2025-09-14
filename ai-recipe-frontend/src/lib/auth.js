// src/lib/auth.js

/** =======================================================
 *  권장 사용법
 *   - API_BASE : 백엔드 API 호스트 (예: https://login.recipfree.com)
 *   - AUTH_BASE: OAuth2 시작 호스트 (보통 API_BASE와 동일)
 *   - Netlify 프록시 쓴다면 두 값 없이도 동작 (/api/* → 프록시)
 *  환경변수:
 *   - VITE_API_BASE, VITE_AUTH_BASE
 *  ======================================================= */
export const API_BASE  = import.meta.env?.VITE_API_BASE  || window.location.origin;
export const AUTH_BASE = import.meta.env?.VITE_AUTH_BASE || window.location.origin;

const LS_KEY = 'authUser';

/* ───────── localStorage 헬퍼 ───────── */
function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(user) {
  try {
    if (user) localStorage.setItem(LS_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_KEY);
  } catch {}
  // 동일 탭 즉시 반영용 커스텀 이벤트 (storage 이벤트는 “다른 탭”에서만 발생)
  try { window.dispatchEvent(new Event('auth:changed')); } catch {}
}
export function clearAuthCache() { writeCache(null); }
export function getCachedUser() { return readCache(); }

/* ───────── 유틸 ───────── */
function currentSpaPath() {
  const { hash, pathname, search } = window.location;
  return hash && hash.startsWith('#') ? hash.slice(1) : (pathname + search);
}
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
function detectInAppNow() {
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const webview = /\bwv\b/i.test(ua) || /; wv\)/i.test(ua);
  const inApp = webview || /KAKAOTALK|FBAN|FBAV|Messenger|Instagram|Line|NAVER|DaumApps/i.test(ua);
  return { isAndroid, isIOS, inApp };
}

/* ───────── 세션 기반 API (서버 세션이 권위) ───────── */
export async function fetchMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store' },
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = await safeJson(res);
  return data?.authenticated ? data : null;
}

export async function refreshSession() {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return await fetchMe();
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } finally {
    clearAuthCache();
  }
}

/* ───────── 로컬 계정 (백엔드 지원 시) ───────── */
export async function registerLocal(email, password, name) {
  const res = await fetch(`${API_BASE}/api/auth/local/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.message || '회원가입에 실패했습니다.');
  }
  const user = await safeJson(res);
  writeCache(user);
  return user;
}

export async function loginLocal(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/local/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const user = await safeJson(res);
  writeCache(user);
  return user;
}

/* ───────── 로그인 보장 헬퍼 ─────────
 *  1) 캐시 있으면 반환
 *  2) 서버 세션 refresh → 성공 시 반환(+캐시 동기화)
 *  3) 없다면 소셜/로컬 로그인 진입 (redirect)
 *  반환값: 로그인 완료 전이면 null (브라우저 이동)
 * ─────────────────────────────────── */
export async function ensureLogin(nextPath = currentSpaPath(), options = {}) {
  // 1) 캐시 우선
  const cached = readCache();
  if (cached) return cached;

  // 2) 세션 리프레시
  const user = await refreshSession();
  if (user) {
    writeCache(user);
    return user;
  }

  // 3) 로그인 시작 (redirect)
  try { localStorage.setItem('postLoginRedirect', nextPath); } catch {}

  const { preferProvider, router = 'browser' } = options || {};
  if (preferProvider && ['kakao','naver','google','facebook'].includes(preferProvider)) {
    const absolute = `${AUTH_BASE}/oauth2/authorization/${preferProvider}`;
    const { isAndroid, isIOS, inApp } = detectInAppNow();

    if (inApp && isAndroid) {
      // 크롬 인텐트로 외부 브라우저 열기(인앱 우회)
      const u = new URL(absolute);
      const intent =
        `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
        `#Intent;scheme=${u.protocol.replace(':','')};package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(absolute)};end`;
      window.location.href = intent;
      return null;
    }
    if (inApp && isIOS) {
      alert('인앱 브라우저에서는 소셜 로그인이 제한될 수 있어요.\n공유 아이콘 → “Safari로 열기” 후 다시 시도해주세요.');
      return null;
    }
    window.location.href = absolute;
  } else {
    const loginPath = router === 'hash' ? '/#/login-signup' : '/login-signup';
    window.location.href = loginPath;
  }
  return null;
}

/* ───────── 서버 ↔ 캐시 동기화 (초기 진입/탭 이벤트 등에서 호출) ─────────
 *  - 반환: 서버 기준 사용자 객체 또는 null
 *  - 내부에서 캐시/이벤트를 적절히 갱신
 * ───────────────────────────────────────────────────────── */
export async function syncAuthWithServer() {
  const server = await fetchMe();     // 서버 세션 기준
  const local  = readCache();

  if (server) {
    // 서버 로그인 → 캐시 갱신(이메일/ID 달라졌거나 캐시 없을 때)
    if (!local || local.email !== server.email) {
      writeCache(server);
    } else {
      // 같은 사용자면 그래도 최신 동기화를 위해 한번 더 저장(이벤트 불필요 시 제거 가능)
      writeCache(server);
    }
  } else if (local) {
    // 서버엔 세션 없는데 캐시만 있던 경우 정리
    clearAuthCache();
  }
  return server || null;
}