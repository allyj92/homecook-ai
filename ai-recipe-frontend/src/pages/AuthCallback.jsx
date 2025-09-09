// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/http';       // 방금 정리한 http 래퍼
import { fetchMe } from '../lib/auth';        // /api/auth/me 불러오는 헬퍼 (있으면 사용)

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

export default function AuthCallback(){
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const fail = (msg='로그인 처리에 실패했어요. 다시 시도해주세요.') => {
        alert(msg);
        navigate('/login-signup', { replace:true });
      };

      try {
        // (선택) 부트스트랩 엔드포인트 있으면 사용. 없어도 catch로 무시.
        try {
          await apiFetch('/api/auth/bootstrap-cookie', { method: 'POST', noAuthRedirect: true });
        } catch {}

        // 브라우저가 Set-Cookie( refresh_token )을 반영할 약간의 시간 여유
        await sleep(150);

        // 1차 시도: refresh → 필터가 refresh_token 쿠키를 읽어 컨텍스트/세션 세팅
        let res = await apiFetch('/api/auth/refresh', { method:'POST', noAuthRedirect:true });
        if (!res.ok) {
          // 2차 재시도(아주 짧게): 일부 브라우저에서 쿠키 적용 타이밍 이슈 방어
          await sleep(200);
          res = await apiFetch('/api/auth/refresh', { method:'POST', noAuthRedirect:true });
          if (!res.ok) return fail();
        }

        // 유저 정보 확보
        let user = null;
        try {
          // 백엔드가 { user: {...} }를 반환하는 경우
          const data = await res.clone().json().catch(()=>null);
          if (data?.user) user = data.user;
        } catch {}

        // 표준화: /me로 최종 확인 (권장)
        if (!user) {
          user = await fetchMe();   // authenticated일 때 유저 객체 반환
        }

        if (user) {
          try { localStorage.setItem('authUser', JSON.stringify(user)); } catch {}
        } else {
          return fail();
        }

        // 돌아갈 곳
        const to = localStorage.getItem('postLoginRedirect') || '/';
        try { localStorage.removeItem('postLoginRedirect'); } catch {}
        navigate(to, { replace:true });
      } catch (e) {
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
