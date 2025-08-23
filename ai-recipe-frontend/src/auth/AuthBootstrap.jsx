// src/auth/AuthBootstrap.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/http';

export default function AuthBootstrap() {
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    (async () => {
      try {
        // (선택) OAuth 실패/취소 쿼리 제거
        const qs = new URLSearchParams(loc.search);
        const oauthErr = qs.get('error') || qs.get('error_description') || qs.get('error_code');
        if (oauthErr) {
          alert('로그인이 취소되었거나 실패했어요. 다시 시도해 주세요.');
          navigate(loc.pathname, { replace: true });
          return;
        }

        const res = await apiFetch('/api/auth/refresh', {
          method: 'POST',
          noAuthRedirect: true, // 401이어도 자동 리다이렉트 X
        });
        if (!res.ok) return; // 미로그인: 조용히 종료

        const data = await res.json(); // { accessToken, user }
        localStorage.setItem('authUser', JSON.stringify(data.user));
        if (data.accessToken) localStorage.setItem('authAccess', data.accessToken);
         window.dispatchEvent(new Event('auth:changed')); 

        const to = localStorage.getItem('postLoginRedirect');
        if (to) {
          localStorage.removeItem('postLoginRedirect');
          if (loc.pathname !== to) navigate(to, { replace: true });
        }
      } catch { /* no-op */ }
    })();
  }, []); // 최초 1회만

  return null; // 화면에는 아무것도 안 보임
}
