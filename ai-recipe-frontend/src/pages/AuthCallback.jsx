// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/http';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const fail = (msg = '로그인 처리에 실패했어요. 다시 시도해주세요.') => {
        alert(msg);
        navigate('/login-signup', { replace: true });
      };

      try {
        // ✅ OAuth 성공 시점엔 이미 세션이 생겨 있어야 함 → /api/auth/me만 확인
        let user = null;

        for (let i = 0; i < 3 && !user; i++) { // 쿠키/세션 반영 타이밍 대비 살짝 재시도
          const res = await apiFetch('/api/auth/me', { noAuthRedirect: true });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.authenticated) user = data;
          }
          if (!user) await sleep(150);
        }

        if (!user) return fail();

        try { localStorage.setItem('authUser', JSON.stringify(user)); } catch {}

        const to = localStorage.getItem('postLoginRedirect') || '/';
        try { localStorage.removeItem('postLoginRedirect'); } catch {}
        navigate(to, { replace: true });
      } catch {
        fail('로그인 처리 중 오류가 발생했어요.');
      }
    })();
  }, [navigate]);

  return (
    <div className="container-xxl py-5 text-center">
      <div className="spinner-border text-success" role="status" aria-hidden="true"></div>
      <p className="mt-3">로그인 처리 중…</p>
    </div>
  );
}
