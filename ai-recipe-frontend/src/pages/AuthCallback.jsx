// src/pages/AuthCallback.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback(){
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        // 1) 콜백 직후: refresh_token 강제 심기 (엔드포인트 없으면 에러 무시)
        try {
          await fetch('/api/auth/bootstrap-cookie', { method: 'POST', credentials: 'include' })
        } catch {}

        // 2) 세션 컨텍스트 부트스트랩
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        if (!res.ok) {
          alert('로그인 처리에 실패했어요. 다시 시도해 주세요.')
          navigate('/login-signup', { replace: true })
          return
        }
        const data = await res.json()
        if (data?.user) {
          try { localStorage.setItem('authUser', JSON.stringify(data.user)) } catch {}
        }

        // (선택) 검증 겸 me 호출
        // const me = await fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).catch(()=>null)
        // console.log('me:', me)

        // 3) 원래 가려던 곳으로
        const to = localStorage.getItem('postLoginRedirect') || '/'
        try { localStorage.removeItem('postLoginRedirect') } catch {}
        navigate(to, { replace: true })

      } catch (e) {
        alert('로그인 처리 중 오류가 발생했어요.')
        navigate('/login-signup', { replace: true })
      }
    })()
  }, [navigate])

  return (
    <div className="container-xxl py-5 text-center">
      <div className="spinner-border text-success" role="status" aria-hidden="true"></div>
      <p className="mt-3">로그인 처리 중…</p>
    </div>
  )
}