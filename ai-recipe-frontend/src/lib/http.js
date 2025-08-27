const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

function isAbs(u) {
  return /^https?:\/\//i.test(u);
}

export function buildUrl(input) {
  if (!input) return input;
  if (isAbs(input)) return input;

  // ✅ API만 접두; SPA 라우트는 그대로 두기
  if (API_BASE && input.startsWith('/api')) {
    return `${API_BASE}${input}`;
  }
  return input;
}

export async function apiFetch(input, options = {}) {
  const {
    noAuthRedirect = false,   // 401 자동 이동 끄기 옵션
    headers: userHeaders,
    body: userBody,
    method,
    ...rest
  } = options;

  const url = buildUrl(input);
  const headers = new Headers(userHeaders || {});
  let body = userBody;

  const isForm = (typeof FormData !== 'undefined') && (userBody instanceof FormData);
  const isJSONCandidate = userBody && typeof userBody === 'object' && !isForm;

  // ✅ GET에 바디 금지: JSON 바디는 비-GET일 때만
  const m = (method || 'GET').toUpperCase();
  if (isJSONCandidate && m !== 'GET') {
    if (![...headers.keys()].some(k => k.toLowerCase() === 'content-type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(userBody);
  }

  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    method: m,
    headers,
    body,
    ...rest,
  });

  // ✅ 401 → 로그인 페이지 이동 (필요 시 opt-out)
  if (res.status === 401 && !noAuthRedirect) {

    if (import.meta.env.MODE === 'development') {
      // 👇 개발 모드에서는 그냥 경고만 찍고, redirect/alert 안 함
      console.warn('⚠️ 401 Unauthorized (개발모드에서는 무시됨)');
      return res;
    }

    // === 원래 코드 (배포용) ===
    try {
      const here =
        (window.location.hash && window.location.hash.slice(1)) ||
        (window.location.pathname + window.location.search);
      localStorage.setItem('postLoginRedirect', here);
    } catch {}

    if (!window.__RF_AUTH_ALERT__) {
      window.__RF_AUTH_ALERT__ = true;
      alert('로그인이 필요합니다. 로그인/회원가입 페이지로 이동합니다.');
      setTimeout(() => { window.__RF_AUTH_ALERT__ = false; }, 1000);
    }
    window.location.assign('/#/login-signup');
  }

  return res;
}
