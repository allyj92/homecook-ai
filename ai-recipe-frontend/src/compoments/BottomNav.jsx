// src/compoments/BottomNav.jsx
import { useLocation, useNavigate } from 'react-router-dom';

const BRAND = {
  orange: '#ff7f32', // Recip
  teal:   '#009688', // Free
  ink:    '#212529',
  mute:   '#6c757d',
};

export default function BottomNav() {
  const navigate = useNavigate();
  const loc = useLocation();

  const active = (starts) => starts.some((p) => loc.pathname.startsWith(p));
  const onKey = (e, to) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(to);
    }
  };

  const tabStyle = (isActive) => ({
    color: isActive ? BRAND.orange : BRAND.mute,
    fontWeight: isActive ? 700 : 500,
  });

  return (
    <>
      {/* ⬇️ 모바일 전용: md 이상(>=768px)에서는 숨김 */}
      <nav
        className="bottom-nav nav justify-content-around fixed-bottom bg-white border-top shadow-sm py-1 d-md-none"
        role="navigation"
        aria-label="하단 탐색"
        style={{ borderColor: '#eee' }}
      >
        {/* 홈 */}
        {(() => {
          const isAct = active(['/', '/input']);
          return (
            <button
              className="nav-link text-center flex-fill"
              style={tabStyle(isAct)}
              onClick={() => navigate('/')}
              onKeyDown={(e) => onKey(e, '/')}
              aria-label="홈"
              aria-current={isAct ? 'page' : undefined}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l9 8h-3v9H6v-9H3z" fill="currentColor" />
              </svg>
              <div className="small">홈</div>
            </button>
          );
        })()}

        {/* 쇼핑 */}
        {(() => {
          const isAct = active(['/shop']);
          return (
            <button
              className="nav-link text-center flex-fill"
              style={tabStyle(isAct)}
              onClick={() => navigate('/shop')}
              onKeyDown={(e) => onKey(e, '/shop')}
              aria-label="쇼핑"
              aria-current={isAct ? 'page' : undefined}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4h10l1 4H6l1-4zm-1 6h12l-1.5 8h-9L6 10zM9 4a3 3 0 116 0" fill="currentColor" />
              </svg>
              <div className="small">쇼핑</div>
            </button>
          );
        })()}

        {/* 커뮤니티 */}
        {(() => {
          const isAct = active(['/community']);
          return (
            <button
              className="nav-link text-center flex-fill"
              style={tabStyle(isAct)}
              onClick={() => navigate('/community')}
              onKeyDown={(e) => onKey(e, '/community')}
              aria-label="커뮤니티"
              aria-current={isAct ? 'page' : undefined}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16v10H7l-3 3V5z" fill="currentColor" />
              </svg>
              <div className="small">커뮤니티</div>
            </button>
          );
        })()}

        {/* 마이페이지 */}
        {(() => {
          const isAct = active(['/mypage']);
          return (
            <button
              className="nav-link text-center flex-fill"
              style={tabStyle(isAct)}
              onClick={() => navigate('/mypage')}
              onKeyDown={(e) => onKey(e, '/mypage')}
              aria-label="마이페이지"
              aria-current={isAct ? 'page' : undefined}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H5z" fill="currentColor" />
              </svg>
              <div className="small">마이</div>
            </button>
          );
        })()}
      </nav>

      {/* ⬇️ 본문 가림 방지용 스페이서: 모바일에서만 표시 */}
      <div className="d-md-none" style={{ height: 56 }} aria-hidden="true" />
    </>
  );
}
