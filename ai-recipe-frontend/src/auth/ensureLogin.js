import { buildUrl } from '../lib/http';

// src/auth/ensureLogin.js
// 세션 기반 로그인 확인 유틸
// 1) 서버 세션에 로그인 되어 있으면 유저 객체를 반환
// 2) 아니면 안내 후 로그인 화면(/login-signup)으로 이동하며, 돌아올 경로를 저장
export async function ensureLogin(backTo) {
  try {
    // 서버 세션 기준으로 현재 로그인 상태 확인
   
       const res = await fetch(buildUrl('/api/auth/me'), {
    method: 'GET',
     credentials: 'include',
     cache: 'no-store',               
     headers: { 'Cache-Control': 'no-store' },
  });

    if (res.ok) {
      const me = await res.json(); // { provider, providerId, email, name, avatar } 등
      return me;                   // 로그인 되어 있음 → 계속 진행
    }
  } catch (_) {
    // 네트워크/예외 시에는 아래 미로그인 처리로 진행
  }

  // 미로그인: 로그인 후 되돌아올 경로 저장
  try {
   if (backTo) {
     // HashRouter 사용 시 해시 기준 보존
    const spaPath = location.hash?.slice(1) || backTo;
    localStorage.setItem('postLoginRedirect', spaPath);
  }
  } catch {}

  alert('로그인이 필요합니다. 로그인/회원가입 페이지로 이동합니다.');
  window.location.assign('/#/login-signup'); 
  return null;
}
