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

/** =============================
 *  백엔드 세션 기반 API
 *  (Spring 세션 쿠키 사용: credentials: 'include')
 * ============================== */

// 현재 세션 사용자(캐시 무시하고 서버 확인)
export async function fetchMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return await res.json(); // SessionUser
}

// 세션 갱신(백엔드가 { user } 반환)
export async function refreshSession() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await res.json(); // { user }
  return data?.user ?? null;
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
 *  자체(local) 로그인/회원가입
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
  const user = await res.json(); // SessionUser
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
  const user = await res.json(); // SessionUser
  setCachedUser(user);
  return user;
}

/** =============================
 *  로그인 보장 헬퍼
 *  1) 캐시가 있으면 즉시 반환
 *  2) /api/auth/refresh 시도 (세션 있으면 성공)
 *  3) 없으면 로그인 페이지로 이동 (postLoginRedirect 저장)
 *
 *  옵션:
 *   - nextPath: 로그인 후 돌아올 경로(기본: 현 위치)
 *   - preferProvider: 'kakao' | 'naver' | 'google' | 'facebook' | 'local'
 *     → 자동 소셜 시작을 원하면 지정. 미지정이면 로그인 페이지로만 보냄.
 * ============================== */
export async function ensureLogin(
  nextPath = window.location.pathname + window.location.search,
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

  const { preferProvider } = options || {};
  if (preferProvider && ['kakao','naver','google','facebook'].includes(preferProvider)) {
    // 소셜 자동 시작을 진짜로 원할 때만 사용
    window.location.href = `/api/auth/oauth/${preferProvider}/start`;
  } else {
    // 기본: 로그인/회원가입 화면으로 이동 (사용자에게 선택권 부여)
    // 라우트가 '/login-signup' 인 것으로 프로젝트에 맞춤
    window.location.href = '/login-signup';
  }
  return null; // 여기서 보통 페이지 이동
}

/** =============================
 *  기타 헬퍼
 * ============================== */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
