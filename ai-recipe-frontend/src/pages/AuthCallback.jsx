import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/http'

export default function AuthCallback(){
  const navigate = useNavigate()
  useEffect(()=>{
    (async()=>{
      try{
        const res = await apiFetch('/api/auth/refresh', { method:'POST', noAuthRedirect:true })
        if (!res.ok){
          alert('로그인 처리에 실패했어요. 다시 시도해 주세요.')
          navigate('/login-signup', { replace:true })
          return
        }
        const data = await res.json()
        if (data?.user){
          try{ localStorage.setItem('authUser', JSON.stringify(data.user)) }catch{}
        }
        const to = localStorage.getItem('postLoginRedirect') || '/'
        try{ localStorage.removeItem('postLoginRedirect') }catch{}
        navigate(to, { replace:true })
      }catch(e){
        alert('로그인 처리 중 오류가 발생했어요.')
        navigate('/login-signup', { replace:true })
      }
    })()
  },[navigate])

  return (
    <div className="container-xxl py-5 text-center">
      <div className="spinner-border text-success" role="status" aria-hidden="true"></div>
      <p className="mt-3">로그인 처리 중…</p>
    </div>
  )
}
