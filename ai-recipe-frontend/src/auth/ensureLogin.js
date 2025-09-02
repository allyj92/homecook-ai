import { buildUrl } from '../lib/http';

/**
 * 세션 기반 로그인 확인 유틸
 * 1) 서버 세션이 유효하면 유저 객체(me) 반환
 * 2) 401이면 /api/auth/refresh 호출로 세션 갱신 시도 → 성공 시 재시도
 * 3) 실패 시 로그인 페이지로 이동하며 돌아올 경로 저장
 */
export async function ensureLogin(backTo) {
  // 0) 현재 SPA 경로를 저장(해시 라우터 고려)
  const savePostLoginRedirect = () => {
    try {
      const spaPath = location.hash?.slice(1) || backTo || location.pathname + location.search;
      if (spaPath) localStorage.setItem('postLoginRedirect', spaPath);
    } catch {}
  };

  // 1) me 조회 (쿠키 포함)
  const fetchMe = async () => {
    return fetch(buildUrl('/api/auth/me'), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
  };

  try {
    let res = await fetchMe();

    // 2) 401이면 refresh 시도 후 한 번만 재시도
    if (res.status === 401) {
      const r = await fetch(buildUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });

      if (r.ok) {
        // refresh 성공 → me 재조회
        res = await fetchMe();
      }
    }

    if (res.ok) {
      const me = await res.json();
      return me; // 로그인 상태 → 통과
    }
  } catch (_) {
    // 네트워크 에러 등은 아래 미로그인 처리로 진행
  }

  // 3) 미로그인 처리: 리다이렉트 경로 저장 후 이동
  savePostLoginRedirect();
  // alert는 UX상 과하게 느껴질 수 있어 주석 처리. 필요시 해제
  // alert('로그인이 필요합니다. 로그인/회원가입 페이지로 이동합니다.');
  window.location.assign('/#/login-signup');
  return null;
}
