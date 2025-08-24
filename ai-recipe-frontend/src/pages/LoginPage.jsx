// src/pages/LoginPage.jsx
import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import '../index.css';

const BRAND = {
  ink: '#1E1E1E', mute: '#8A8A8A', line: '#EDEDED',
  kakao: '#FEE500', kakaoText: '#3B1E1E',
  btn: '#1E1E1E', btnText: '#fff', accent: '#3BA99C',
  warn: '#B42318', ok: '#0F9960',
};

/* Icons */
const KakaoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill={BRAND.kakaoText} d="M12 3C6.98 3 3 6.09 3 9.9c0 2.38 1.64 4.46 4.1 5.66l-1 3.66a.6.6 0 0 0 .92.66l4.23-2.77c.24.02.48.03.74.03 5.02 0 9-3.09 9-6.94C21 6.09 17.02 3 12 3z"/>
  </svg>
);
const NaverIcon = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" role="img" aria-label="네이버">
    <rect x="0" y="0" width="40" height="40" rx="8" fill="#03C75A"/>
    <path d="M12 12h4.6l5 7.4V12H28v16h-4.6l-5-7.4V28H12V12z" fill="#fff" />
  </svg>
);
const GoogleIcon = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="#fff" stroke="#E5E7EB"/>
    <path d="M33 20.2c0-.7-.1-1.4-.2-2H20v4.1h7.4c-.3 1.8-1.4 3.4-3 4.4v3.6h4.9c2.9-2.6 4.7-6.4 4.7-10.1z" fill="#4285F4"/>
    <path d="M20 34c4 0 7.4-1.3 9.8-3.6l-4.9-3.6c-1.4.9-3.1 1.5-4.9 1.5-3.8 0-7-2.6-8.1-6.1h-5v3.8C9.3 30.7 14.3 34 20 34z" fill="#34A853"/>
    <path d="M11.9 22.2a8.4 8.4 0 0 1 0-4.4v-3.8h-5A14 14 0 0 0 6 20c0 2.3.6 4.5 1.9 6.1l4-3.9z" fill="#FBBC05"/>
    <path d="M20 10.6c2.2 0 4.2.8 5.7 2.5l4.3-4.3C27.4 6.5 24 5 20 5 14.3 5 9.3 8.3 6.9 13.6l5 3.8c1.1-3.5 4.3-6.1 8.1-6.1z" fill="#EA4335"/>
  </svg>
);
const FacebookIcon = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="8" fill="#1877F2"/>
    <path fill="#fff" d="M22 13h3v-3c-.5-.1-1.9-.2-3.2-.2-3.2 0-5.4 1.9-5.4 5.5V18h-3v4h3v9h4v-9h3.3l.7-4H20v-2.3c0-1.2.3-2.7 2-2.7z"/>
  </svg>
);

/* Password input */
function PasswordInput({ id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        id={id}
        className="form-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyUp={(e)=>setCaps(e.getModifierState && e.getModifierState('CapsLock'))}
        placeholder={placeholder}
        required
        aria-describedby={caps ? 'caps-hint' : undefined}
      />
      <button type="button" className="pw-toggle" onClick={()=>setShow(!show)}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
        {show ? '숨김' : '보기'}
      </button>
      {caps && <div id="caps-hint" className="pw-caps">Caps Lock이 켜져 있습니다</div>}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState({ email:false });

  const from = (location.state && location.state.from) || '/';
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  async function handleSubmit(e){
    e.preventDefault();
    setErr('');
    setTouched({ email:true });
    if (!emailValid) { setErr('이메일 형식을 확인해주세요.'); return; }
    setLoading(true);
    setTimeout(() => {
      if (!email || !pw) { setErr('이메일과 비밀번호를 입력하세요.'); setLoading(false); return; }
      const demoUser = { id: 1, name: 'HomeCooker', email, avatar: 'https://picsum.photos/seed/user/64/64' };
      try { localStorage.setItem('authUser', JSON.stringify(demoUser)); } catch {}
      navigate(from, { replace: true });
    }, 700);
  }

  // 버튼 클릭 시에만 네이버 OAuth 시작
  function socialLogin(provider) {
  // 복귀 경로 저장
  const backTo =
    (location.state && location.state.from) ||
    localStorage.getItem('postLoginRedirect') ||
    '/';
  try { localStorage.setItem('postLoginRedirect', backTo); } catch {}

  // 지원하는 프로바이더만 허용
  const supported = ['naver', 'google', 'kakao','facebook'];
  if (!supported.includes(provider)) {
    alert('현재는 해당 소셜은 준비 중입니다.');
    return;
  }

  // 인앱 경고(특히 네이버가 인앱을 자주 차단함)
  const inApp = /KAKAOTALK|NAVER|FBAN|FBAV|Instagram|Line/i.test(navigator.userAgent);
  if (inApp) {
    alert('인앱 브라우저에서는 소셜 로그인이 제한될 수 있어요. 우측 메뉴에서 “기본 브라우저로 열기” 후 다시 시도해주세요.');
  }

  // Netlify 배포: VITE_API_BASE 비어두고 상대경로 → [[redirects]]로 백엔드 프록시
  // 로컬에서 직접 백엔드로 붙이고 싶으면 VITE_API_BASE=http://<백엔드:8080> 설정
  const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  const startPath = `/api/auth/oauth/${provider}/start`;
  const href = API_BASE ? `${API_BASE}${startPath}` : startPath;

  window.location.assign(href);
}
  return (
    <div className="login-wrap">
      <h1 className="login-title">로그인 / 회원가입</h1>

      {/* 상단 큰 버튼: 카카오는 안내만 */}
      <button
        type="button"
        className="kakao-btn"
        onClick={()=>socialLogin('kakao')}
        aria-label="카카오로 간편 시작"
      >
        <KakaoIcon /><span>카카오로 간편 시작</span>
      </button>

      <div className="divider" role="separator" aria-label="또는">또는</div>

      {/* 소셜 아이콘 줄 — 네이버만 실제 동작 */}
      <div className="social-row" role="group" aria-label="소셜 로그인">
        <button type="button" className="social-btn" title="네이버로 시작하기"
                onClick={()=>socialLogin('naver')}>
          <NaverIcon/>
        </button>

        <button type="button" className="social-btn" title="Google로 시작하기"
                onClick={()=>socialLogin('google')}>
          <GoogleIcon/>
        </button>

        <button type="button" className="social-btn" title="Facebook으로 시작하기"
                onClick={()=>socialLogin('facebook')}>
          <FacebookIcon/>
        </button>
      </div>

      {/* 이메일/비번 (데모) */}
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="id">아이디</label>
            <input
              id="id"
              className={`form-input ${touched.email && !emailValid ? 'is-invalid' : ''} ${emailValid ? 'is-valid' : ''}`}
              type="email"
              value={email}
              onBlur={()=>setTouched(s => ({...s, email:true}))}
              onChange={e=>setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              aria-invalid={touched.email && !emailValid}
            />
            {touched.email && !emailValid && <div className="field-hint error">유효한 이메일을 입력하세요.</div>}
            {emailValid && <div className="field-hint ok">좋아요! 로그인 준비됐어요.</div>}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="pw">비밀번호</label>
            <PasswordInput id="pw" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        <label className="keep-row" title="개인 기기에서만 사용하세요. 최대 30일 유지됩니다.">
          <input type="checkbox" className="keep-check" /> 로그인 상태 유지
        </label>

        {err && <div className="form-alert" role="alert">{err}</div>}

        <button className="login-btn" disabled={loading} type="submit">
          {loading ? <span className="spinner" aria-hidden="true" /> : '로그인'}
        </button>

        <div className="help-links">
          <Link to="#" className="help-link">아이디/비밀번호 찾기</Link>
          <Link to="#" className="help-link">비회원 주문</Link>
          <Link to="#" className="help-link">비회원 주문조회</Link>
        </div>
      </form>
    </div>
  );
}
