// src/lib/auth.js
// 1) localStorage에 유저가 있으면 그대로 반환
// 2) 없으면 /api/auth/refresh 로 세션 확인 (HttpOnly 쿠키 기반 자동로그인)
// 3) 그래도 없으면 네이버 로그인으로 리다이렉트

export async function ensureLogin(nextPath = window.location.pathname + window.location.search) {
  // 1) 캐시(표시용)
  const cached = localStorage.getItem('authUser');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }

  // 2) 새로고침 시도 (백엔드가 준비되면 자동로그인 동작)
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // HttpOnly 쿠키 전달
    });
    if (res.ok) {
      const data = await res.json(); // { accessToken, user }
      localStorage.setItem('authUser', JSON.stringify(data.user));
      // accessToken을 프론트에서 직접 쓰지 않으면 굳이 저장 안 해도 됨
      return data.user;
    }
  } catch { /* 네트워크 실패 등은 무시하고 다음 단계 진행 */ }

  // 3) 로그인 없으면, 돌아올 경로 저장 → 네이버 OAuth 시작
  localStorage.setItem('postLoginRedirect', nextPath);
  window.location.href = '/api/auth/oauth/naver/start';
  return null; // 여기서 페이지가 이동하므로 호출부는 이후 로직 중단해도 됨
}
