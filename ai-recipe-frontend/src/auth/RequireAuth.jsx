// /src/auth/RequireAuth.jsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || '' // prod에선 https://api.recipfree.com 권장

export default function RequireAuth({ children }) {
  const loc = useLocation()
  useEffect(() => {
    const user = localStorage.getItem('authUser')
    if (!user) {
      // 돌아올 위치 저장
      localStorage.setItem('postLoginRedirect', loc.pathname + loc.search)
      // 네이버 OAuth 시작
      window.location.assign(`${API_BASE}/api/auth/oauth/naver/start`)
    }
  }, [loc])
  return children
}
