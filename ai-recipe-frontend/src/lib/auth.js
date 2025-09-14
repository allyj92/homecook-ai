// src/lib/auth.js

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
    // 탭 동기화용 커스텀 이벤트
    window.dispatchEvent(new Event('auth:changed'));
  } catch {}
}
export function clearAuthCache() { writeCache(null); }

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
  const inApp =
    webview ||
    /KAKAOTALK|FBAN|FBAV|Messenger|Instagram|Line|NAVER|DaumApps/i.test(ua);
  return { isAndroid, isIOS, inApp };
}

/* ───────── 세션 기반 API ───────── */
export async function fetchMe() {
  const res = await fetch('/api/auth/me', {
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
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return await fetchMe();
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', {
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
  const res = await fetch('/api/auth/local/register', {
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
  const res = await fetch('/api/auth/local/login', {
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

/* ───────── 로그인 보장 헬퍼 ───────── */
export async function ensureLogin(
  nextPath = currentSpaPath(),
  options = {}
) {
  // 1) 캐시 우선(있으면 바로 사용)
  const cached = readCache();
  if (cached) return cached;

  // 2) 세션 리프레시
  const user = await refreshSession();
  if (user) {
    writeCache(user);
    return user;
  }

  // 3) 리디렉션 준비
  try { localStorage.setItem('postLoginRedirect', nextPath); } catch {}

  const { preferProvider, router = 'browser' } = options || {};
  if (preferProvider && ['kakao','naver','google','facebook'].includes(preferProvider)) {
    const path = `/oauth2/authorization/${preferProvider}`;
    const absolute = `${window.location.origin}${path}`;

    const { isAndroid, isIOS, inApp } = detectInAppNow();
    if (inApp && isAndroid) {
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
    window.location.assign(path);
  } else {
    const loginPath = router === 'hash' ? '/#/login-signup' : '/login-signup';
    window.location.href = loginPath;
  }
  return null;
}

/* ───────── 선택: 처음 로드 시 서버와 캐시 동기화 ───────── */
export async function syncAuthWithServer() {
  const server = await fetchMe();
  const local = readCache();

  if (server && (!local || local.email !== server.email)) {
    writeCache(server); // 로그인된 서버 상태 반영
  } else if (!server && local) {
    clearAuthCache();   // 서버엔 세션 없는데 캐시만 남아 있던 경우 제거
  }
}
