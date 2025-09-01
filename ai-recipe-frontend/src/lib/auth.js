// src/lib/auth.js

/** =============================
 *  공통 유틸 (localStorage 캐시)
 * ============================== */
const LS_KEY = 'authUser';

function getCachedUser() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(user) {
  try {
    if (user) localStorage.setItem(LS_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_KEY);
  } catch {}
}

export function clearAuthCache() {
  setCachedUser(null);
}

/** 현재 SPA 경로 계산 (HashRouter/BrowserRouter 모두 대응) */
function currentSpaPath() {
  const { hash, pathname, search } = window.location;
  return hash && hash.startsWith('#') ? hash.slice(1) : (pathname + search);
}

/** 안전 JSON 파싱 */
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** =============================
 *  백엔드 세션 기반 API
 *  (Spring 세션 쿠키 사용: credentials: 'include')
 * ============================== */

// 현재 세션 사용자 (401이면 null)
export async function fetchMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = await safeJson(res);
  // 백엔드: { authenticated: true, id, email, name, picture, provider } 형태
  if (data?.authenticated) return data;
  return null;
}

// 세션 갱신 → 갱신 성공 시 다시 /me 호출하여 사용자 반환
export async function refreshSession() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  // 바디가 {accessToken} 등이어도 여기선 의미 없음. 유저는 /me에서 확인.
  return await fetchMe();
}

// 로그아웃
export async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    clearAuthCache();
  }
}

/** =============================
 *  자체(local) 로그인/회원가입 (백엔드에 엔드포인트가 있을 때만 사용)
 * ============================== */
export async function registerLocal(email, password, name) {
  const res = await fetch('/api/auth/local/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.message || '회원가입에 실패했습니다.');
  }
  const user = await safeJson(res);
  setCachedUser(user);
  return user;
}

export async function loginLocal(email, password) {
  const res = await fetch('/api/auth/local/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const user = await safeJson(res);
  setCachedUser(user);
  return user;
}

/** =============================
 *  로그인 보장 헬퍼
 *  1) 캐시가 있으면 즉시 반환
 *  2) /api/auth/refresh 시도 (세션 있으면 성공)
 *  3) 없으면 로그인 화면 또는 소셜 자동 시작
 *
 *  옵션:
 *   - nextPath: 로그인 후 돌아올 경로(기본: 현재 SPA 경로)
 *   - preferProvider: 'kakao' | 'naver' | 'google' | 'facebook' | 'local'
 *   - router: 'hash' | 'browser' (기본 'browser')
 * ============================== */
export async function ensureLogin(
  nextPath = currentSpaPath(),
  options = {}
) {
  // 1) 캐시 우선
  const cached = getCachedUser();
  if (cached) return cached;

  // 2) 세션 리프레시 시도
  const user = await refreshSession();
  if (user) {
    setCachedUser(user);
    return user;
  }

  // 3) 로그인 유도
  try {
    localStorage.setItem('postLoginRedirect', nextPath);
  } catch {}

  const { preferProvider, router = 'browser' } = options || {};
  if (preferProvider && ['kakao','naver','google','facebook'].includes(preferProvider)) {
    // 소셜 자동 시작 (백엔드가 /api/auth/oauth/{provider}/start → /oauth2/authorization/{provider} 리다이렉트)
    window.location.href = `/api/auth/oauth/${preferProvider}/start`;
  } else {
    // 로그인/회원가입 화면으로 이동 (라우터 타입에 맞춰 경로 선택)
    const loginPath = router === 'hash' ? '/#/login-signup' : '/login-signup';
    window.location.href = loginPath;
  }
  return null;
}
