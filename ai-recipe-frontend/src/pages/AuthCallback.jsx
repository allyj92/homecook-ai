// src/pages/AuthCallback.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback(){
  const navigate = useNavigate()

 useEffect(() => {
  (async () => {
    try {
      try { await fetch('/api/auth/bootstrap-cookie', { method: 'POST', credentials: 'include' }); } catch {}
      const res = await fetch('/api/auth/refresh', { method:'POST', credentials:'include' });
      if (!res.ok) { alert('로그인 처리 실패'); navigate('/login-signup', { replace:true }); return; }
      const data = await res.json();
      if (data?.user) { try { localStorage.setItem('authUser', JSON.stringify(data.user)); } catch {} }
      const to = localStorage.getItem('postLoginRedirect') || '/';
      try { localStorage.removeItem('postLoginRedirect'); } catch {}
      navigate(to, { replace:true });
    } catch {
      alert('로그인 처리 중 오류');
      navigate('/login-signup', { replace:true });
    }
  })();
}, [navigate]);

  return (
    <div className="container-xxl py-5 text-center">
      <div className="spinner-border text-success" role="status" aria-hidden="true"></div>
      <p className="mt-3">로그인 처리 중…</p>
    </div>
  )
}