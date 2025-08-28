// src/components/Header.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ensureLogin } from '../auth/ensureLogin';
import { apiFetch } from '../lib/http';

function readLocalUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null'); }
  catch { return null; }
}

export default function Header({ cartCount = 0, onCartClick }) {
  const loc = useLocation();
  const nav = useNavigate();

  const [me, setMe] = useState(readLocalUser);

  // ✅ 탭 간 동기화
  useEffect(() => {
    const onAuthChanged = () => setMe(readLocalUser());
    window.addEventListener('auth:changed', onAuthChanged);
    window.addEventListener('storage', onAuthChanged);
    return () => {
      window.removeEventListener('auth:changed', onAuthChanged);
      window.removeEventListener('storage', onAuthChanged);
    };
  }, []);

  // ✅ 첫 진입 시 세션 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
        });
        if (res.ok) {
          const user = await res.json();
          const local = readLocalUser();
          if (!local || local.email !== user.email) {
            localStorage.setItem('authUser', JSON.stringify(user));
            setMe(user);
            window.dispatchEvent(new Event('auth:changed'));
          }
        } else {
          localStorage.removeItem('authUser');
          localStorage.removeItem('authAccess');
          setMe(null);
          window.dispatchEvent(new Event('auth:changed'));
        }
      } catch {}
    })();
  }, []);

  // ✅ 로그아웃
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', noAuthRedirect: true });
    } catch {}
    localStorage.removeItem('authUser');
    localStorage.removeItem('authAccess');
    setMe(null);
    window.dispatchEvent(new Event('auth:changed'));
    nav('/', { replace: true });
  };

  const [open, setOpen] = useState(false);
  const isActive = (path) => loc.pathname === path || loc.pathname.startsWith(path + '/');
  const go = (path) => { nav(path); setOpen(false); };

  return (
    <header className="site-header border-bottom bg-white">
      <nav className="navbar navbar-expand-lg">
        <div className="container-xxl">
          {/* 브랜드 로고 */}
          <button className="navbar-brand btn p-0 fw-bold fs-4" onClick={() => go('/')}>
            <span style={{ color: '#ff7f32' }}>Recip</span>
            <span style={{ color: '#009688' }}>Free</span>
          </button>

          {/* 햄버거 */}
          <button
            className="navbar-toggler"
            type="button"
            aria-label="메뉴 열기/닫기"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* 메뉴 */}
          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <button className={`nav-link btn btn-link ${isActive('/') ? 'active text-success' : ''}`} onClick={() => go('/')}>
                  홈
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link btn btn-link ${isActive('/shop') ? 'active text-success' : ''}`} onClick={() => go('/shop')}>
                  쇼핑
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link btn btn-link ${isActive('/community') ? 'active text-success' : ''}`} onClick={() => go('/community')}>
                  커뮤니티
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link ${isActive('/mypage') ? 'active text-success' : ''}`}
                  onClick={async () => {
                    const user = await ensureLogin('/mypage');
                    if (user) go('/mypage');
                  }}
                >
                  마이
                </button>
              </li>

              {/* 모바일 로그인/로그아웃 */}
              <li className="nav-item d-lg-none mt-2">
                {me ? (
                  <div className="d-grid gap-2">
                    <button className="btn btn-outline-secondary w-100" onClick={handleLogout}>
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <div className="d-grid gap-2">
                    <button className="btn btn-outline-success w-100" onClick={() => go('/login-signup?mode=login')}>로그인</button>
                  </div>
                )}
              </li>
            </ul>

            {/* PC 우측 */}
            <div className="d-none d-lg-flex align-items-center gap-2">
              {me ? (
                <button className="btn btn-outline-secondary" onClick={handleLogout}>
                  로그아웃
                </button>
              ) : (
                <button className="btn btn-outline-success" onClick={() => nav('/login-signup?mode=login')}>
                  로그인
                </button>
              )}

              {/* 장바구니 */}
              <button
                className="btn btn-outline-secondary position-relative"
                onClick={onCartClick ?? (() => nav('/cart'))}
              >
                장바구니
                {cartCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success" style={{ fontSize: 10 }}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
