// src/lib/auth.js

/** =========================================================
 *  인증 유틸 (세션 쿠키 기반)
 *  - 로그인 여부는 반드시 서버(/api/auth/me) 응답으로만 판단
 *  - 필요 시 서브도메인 로그인 서버(AUTH_BASE)로 절대경로 호출
 * ========================================================= */

const LS_KEY = 'authUser';

/** ---- (선택) 로컬 캐시: UI 스켈레톤 용도로만. 절대 진실로 믿지 말 것. ---- */
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

/** 현재 SPA 경로 (BrowserRouter/HashRouter 모두) */
function currentSpaPath() {
  const { hash, pathname, search } = window.location;
  return hash && hash.startsWith('#') ? hash.slice(1) : (pathname + search);
}

/** 안전 JSON 파싱 */
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** 간단 인앱/웹뷰 감지 */
function detectInAppNow() {
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const webview = /\bwv\b/i.test(ua) || /; wv\)/i.test(ua);
  const inApp = webview || /KAKAOTALK|FBAN|FBAV|Messenger|Instagram|Line|NAVER|DaumApps/i.test(ua);
  return { isAndroid, isIOS, inApp };
}

/** ---------------------------------------------------------
 *  엔드포인트 베이스
 *   - Vite: import.meta.env.VITE_AUTH_BASE
 *   - window.__AUTH_BASE__ 로도 주입 가능
 *   - 미설정 시 현재 오리진 상대경로 사용
 * --------------------------------------------------------- */
const AUTH_BASE =
  (typeof window !== 'undefined' && (window.__AUTH_BASE__ || window.__API_BASE__)) ||
  (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AUTH_BASE) ||
  '';

function absUrl(path) {
  try {
    return AUTH_BASE ? new URL(path, AUTH_BASE).href : path;
  } catch {
    return path;
  }
}

/** =============================
 *  백엔드 세션 기반 API
 *  (credentials: 'include' 필수)
 * ============================== */

// 현재 세션 사용자 (401/비정상이면 null)
export async function fetchMe() {
  const res = await fetch(absUrl('/api/auth/me'), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = await safeJson(res);
  // 기대형태: { authenticated: true, id, email, name, picture, provider }
  if (data?.authenticated) return data;
  return null;
}

// 세션 갱신 → 성공 시 /me 다시 조회하여 사용자 반환
export async function refreshSession() {
  const res = await fetch(absUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return await fetchMe();
}

// 로그아웃 (성공/실패와 무관하게 캐시정리)
export async function logout() {
  try {
    await fetch(absUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } finally {
    clearAuthCache();
  }
}

/** =============================
 *  자체(local) 회원/로그인 API (옵션)
 *  ※ 백엔드가 있을 때만 사용
 * ============================== */
export async function registerLocal(email, password, name) {
  const res = await fetch(absUrl('/api/auth/local/register'), {
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
  setCachedUser(user); // 표시용
  return user;
}

export async function loginLocal(email, password) {
  const res = await fetch(absUrl('/api/auth/local/login'), {
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
  setCachedUser(user); // 표시용
  return user;
}

/** =============================
 *  로그인 보장 헬퍼 (권장)
 *  흐름:
 *   1) 서버 /me 조회(권위)
 *   2) 실패 시 /refresh → /me
 *   3) 그래도 없으면 로그인 시작
 *
 *  옵션:
 *   - nextPath: 로그인 후 돌아올 경로(기본: 현재 SPA 경로)
 *   - preferProvider: 'kakao' | 'naver' | 'google' | 'facebook' | 'local'
 *   - router: 'hash' | 'browser' (기본 'browser')
 *   - authBase: 강제로 특정 로그인 서버 사용(기본: AUTH_BASE)
 * ============================== */
export async function ensureLogin(
  nextPath = currentSpaPath(),
  options = {}
) {
  const { preferProvider, router = 'browser', authBase } = options || {};

  // 0) 캐시를 즉시 반환하지 않음! (항상 서버로 검증)
  //    단, UI 스켈레톤 표시용으로 쓰고 싶으면 여기서 읽기만 하고,
  //    반환은 아래 서버검증 후에만 하세요.

  // 1) 현재 세션 확인
  const me = await fetchMe();
  if (me) {
    setCachedUser(me); // 동기화(표시용)
    return me;
  }

  // 2) 세션 리프레시 시도
  const refreshed = await refreshSession();
  if (refreshed) {
    setCachedUser(refreshed);
    return refreshed;
  }

  // 3) 로그인 유도 (리다이렉트 경로 저장)
  try {
    localStorage.setItem('postLoginRedirect', nextPath);
  } catch {}

  const base = authBase || AUTH_BASE || window.location.origin;

  // 소셜 선호가 있으면 곧장 시작
  if (preferProvider && ['kakao','naver','google','facebook'].includes(preferProvider)) {
    const path = `/oauth2/authorization/${preferProvider}`;
    const absolute = new URL(path, base).href;

    // 인앱/웹뷰 보정
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

    window.location.assign(absolute);
    return null;
  }

  // 일반 로그인 화면 이동
  const loginPath = router === 'hash' ? '/#/login-signup' : '/login-signup';
  window.location.href = loginPath;
  return null;
}

/** =============================
 *  권장: 초기 헤더에서 사용할 헬퍼
 *  - 서버 상태를 1회 조회하고 캐시 동기화
 *  - 컴포넌트는 이 결과로만 로그인/로그아웃 버튼 토글
 * ============================== */
export async function resolveAuthOnce() {
  const me = await fetchMe();           // 권위
  if (me) { setCachedUser(me); return { loading: false, user: me }; }
  clearAuthCache();
  return { loading: false, user: null };
}

export { getCachedUser, setCachedUser }; // (필요 시 외부에서 스켈레톤 표시용으로만 사용)
