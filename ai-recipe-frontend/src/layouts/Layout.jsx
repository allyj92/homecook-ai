// src/layouts/Layout.jsx
import { Outlet, Link } from 'react-router-dom';
import Header from '../components/Header';
import { apiFetch, buildUrl } from '../lib/http';
import { useState, useEffect } from 'react';

function readLocalUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null'); }
  catch { return null; }
}

export default function Layout() {
  const [me, setMe] = useState(readLocalUser);

  // 1) 탭 간/내 커스텀 이벤트로 로그인 상태 동기화
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'authUser') setMe(e.newValue ? JSON.parse(e.newValue) : null);
    };
    const onAuthChanged = () => setMe(readLocalUser());
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:changed', onAuthChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:changed', onAuthChanged);
    };
  }, []);

  // 2) 마운트 시 서버 세션과 로컬 상태 정합성 검사(항상 동일 출처, 캐시 무효화)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(buildUrl('/api/auth/me'), {
          method: 'GET',
          noAuthRedirect: true,          // 401이어도 자동 리다이렉트 금지
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
        });

        if (res.ok) {
          const user = await res.json();
          const local = readLocalUser();
          if (!local || local.email !== user.email) {
            localStorage.setItem('authUser', JSON.stringify(user));
            setMe(user);
            window.dispatchEvent(new Event('auth:changed'));
          }
        } else if (res.status === 401) {
          // 서버는 미로그인 → 로컬 잔재 정리
          localStorage.removeItem('authUser');
          localStorage.removeItem('authAccess');
          setMe(null);
          window.dispatchEvent(new Event('auth:changed'));
        }
      } catch {
        // 네트워크 오류는 무시(로컬 상태 유지)
      }
    })();
  }, []);

  // 3) 로그아웃: UI 먼저 비움 → 서버 세션/쿠키 종료(동일 출처) → 스토리지 정리 → #/login-signup 이동
  async function handleLogout() {
    // UI 즉시 반영
    setMe(null);
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('authAccess');
      localStorage.removeItem('postLoginRedirect');
      window.dispatchEvent(new Event('auth:changed'));
    } catch {}

    try {
      await apiFetch(buildUrl('/api/auth/logout'), {
        method: 'POST',
        noAuthRedirect: true,
      });
    } catch {
      // 서버 에러는 무시하고 클라이언트 상태 우선
    }

    // HashRouter 기준 이동 (새로고침 겸)
    window.location.replace('/#/login-signup');
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />

      <main className="flex-grow-1 container-xxl py-3">
        <Outlet />
      </main>

      {me ? (
        <div className="nav-auth">
          <span className="nav-name">안녕, {me.name || me.email}님</span>
          <button onClick={handleLogout} className="nav-logout">로그아웃</button>
        </div>
      ) : (
        <Link to="/login-signup" className="nav-login">로그인/회원가입</Link>
      )}
    </div>
  );
}
