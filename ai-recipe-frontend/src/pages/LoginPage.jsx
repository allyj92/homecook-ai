// src/pages/LoginPage.jsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import '../index.css';

const BRAND = {
  ink: '#1E1E1E', mute: '#8A8A8A', line: '#EDEDED',
  kakao: '#FEE500', kakaoText: '#3B1E1E',
  btn: '#1E1E1E', btnText: '#fff', accent: '#3BA99C',
  warn: '#B42318', ok: '#0F9960',
};

function detectInApp() {
  if (typeof navigator === 'undefined') return { inApp: false, isAndroid: false, isIOS: false, vendor: null };
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const vendor =
    (/KAKAOTALK/i.test(ua) && 'kakaotalk') ||
    ((/FBAN|FBAV/i.test(ua) || /Messenger/i.test(ua)) && 'facebook') ||
    (/Instagram/i.test(ua) && 'instagram') ||
    (/Line/i.test(ua) && 'line') ||
    (/NAVER/i.test(ua) && 'naver') ||
    (/DaumApps/i.test(ua) && 'daum') ||
    null;
  const webview = /\bwv\b/i.test(ua) || /; wv\)/i.test(ua);
  const inApp = !!vendor || webview;
  return { inApp, isAndroid, isIOS, vendor };
}

function buildChromeIntentUrl(absoluteUrl) {
  const u = new URL(absoluteUrl);
  return (
    `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
    `#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`
  );
}

/* ===== Icons ===== */
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
  const [params, setParams] = useSearchParams();
  const initialMode = (params.get('mode') === 'register') ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  useEffect(() => {
    const m = (params.get('mode') === 'register') ? 'register' : 'login';
    setMode(m);
  }, [params]);

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState({ email:false });

  const { inApp, isAndroid, isIOS } = detectInApp();
  const [showInAppTip, setShowInAppTip] = useState(inApp);

  const from =
    (location.state && location.state.from) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('postLoginRedirect')) ||
    '/';

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  const computeTargetAndGo = () => {
    const target = (from && !from.startsWith('/login-signup')) ? from : '/';
    try { localStorage.removeItem('postLoginRedirect'); } catch {}
    navigate(target, { replace: true });
  };

  async function submitLogin(e){
    e.preventDefault();
    setErr('');
    setTouched({ email:true });
    if (!emailValid) { setErr('이메일 형식을 확인해주세요.'); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/local/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(()=>({}));
        throw new Error(message || '로그인 실패');
      }
      const user = await res.json();
      localStorage.setItem('authUser', JSON.stringify(user));
      window.dispatchEvent(new Event('auth:changed'));
      computeTargetAndGo();
    } catch (err) {
      setErr(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    setErr('');
    setTouched({ email:true });
    if (!emailValid) { setErr('이메일 형식을 확인해주세요.'); return; }
    if (!name.trim()) { setErr('이름을 입력해주세요.'); return; }
    if (pw.length < 6) { setErr('비밀번호는 6자 이상 입력해주세요.'); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/local/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw, name }),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(()=>({}));
        throw new Error(message || '회원가입 실패');
      }
      const user = await res.json(); // SessionUser (자동 로그인)
      localStorage.setItem('authUser', JSON.stringify(user));
      window.dispatchEvent(new Event('auth:changed'));
      computeTargetAndGo();
    } catch (err) {
      setErr(err.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function socialLogin(provider) {
    const backTo =
      (location.state && location.state.from) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('postLoginRedirect')) ||
      '/';
    try { localStorage.setItem('postLoginRedirect', backTo); } catch {}

    const supported = ['naver', 'google', 'kakao', 'facebook'];
    if (!supported.includes(provider)) {
      alert('현재는 해당 소셜은 준비 중입니다.');
      return;
    }

    const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '');
    const startPath = `/api/auth/oauth/${provider}/start`;
    const absoluteStart = API_BASE ? `${API_BASE}${startPath}` : `${window.location.origin}${startPath}`;

    if (inApp && isAndroid) {
      const intentUrl = buildChromeIntentUrl(absoluteStart);
      window.location.href = intentUrl;
      return;
    }
    if (inApp && isIOS) {
      alert('인앱 브라우저에서는 로그인이 제한될 수 있어요.\n공유 아이콘 → “Safari로 열기” 후 다시 시도해주세요.');
      return;
    }

    window.location.assign(absoluteStart);
  }

  const title = mode === 'register' ? '회원가입' : '로그인';

  const switchTo = (m) => {
    setParams({ mode: m }, { replace: true });
  };

  return (
    <div className="login-wrap">
      {showInAppTip && (
        <div style={{
          background:'#FFF3CD', border:'1px solid #FFE69C', color:'#8A6D3B',
          padding:'10px 12px', borderRadius:8, marginBottom:12
        }}>
          <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <strong>인앱 브라우저 감지됨</strong>
              <div style={{fontSize:13, marginTop:4}}>
                {isAndroid
                  ? '일부 앱 내 브라우저에서는 소셜 로그인이 차단됩니다. 아래 버튼으로 기본 브라우저에서 열어주세요.'
                  : '일부 앱 내 브라우저에서는 소셜 로그인이 차단됩니다. 우측 상단 메뉴 → “Safari로 열기”를 눌러주세요.'}
              </div>
            </div>
            <button type="button" onClick={()=>setShowInAppTip(false)}
                    style={{border:'none', background:'transparent', fontSize:18, lineHeight:1}}>×</button>
          </div>

          <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
            {isAndroid && (
              <a
                href={buildChromeIntentUrl(window.location.href)}
                style={{padding:'8px 10px', borderRadius:6, background:'#111', color:'#fff', textDecoration:'none'}}
              >
                기본 브라우저로 열기
              </a>
            )}
            <button
              type="button"
              onClick={async ()=>{
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  alert('링크를 복사했어요. 기본 브라우저에 붙여넣어 열어주세요!');
                } catch {
                  prompt('아래 링크를 복사하세요', window.location.href);
                }
              }}
              style={{padding:'8px 10px', borderRadius:6, background:'#eee', border:'1px solid #ddd'}}
            >
              링크 복사
            </button>
          </div>
        </div>
      )}

      <h1 className="login-title">로그인 / 회원가입</h1>

      {/* 상단 큰 버튼 (카카오) */}
      <button
        type="button"
        className="kakao-btn"
        onClick={()=>socialLogin('kakao')}
        aria-label="카카오로 간편 시작"
      >
        <KakaoIcon /><span>카카오로 간편 시작</span>
      </button>

      <div className="divider" role="separator" aria-label="또는">또는</div>

      {/* 소셜 아이콘 줄 (복구됨) */}
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

      {/* 모드에 따른 폼 단일 노출 */}
      {mode === 'login' ? (
        <form className="login-card" onSubmit={submitLogin} noValidate>
          <h2 className="h5 mb-3">{title}</h2>
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
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pw">비밀번호</label>
              <PasswordInput id="pw" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          {err && (
            <div className="form-alert" role="alert">
              {err}
              <div style={{ marginTop: 6, fontSize: 13 }}>
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  className="link-like"
                  onClick={()=>switchTo('register')}
                  style={{ color: '#0d6efd', background: 'transparent', border: 'none', padding: 0 }}
                >
                  회원가입
                </button>
              </div>
            </div>
          )}

          <button className="login-btn" disabled={loading} type="submit">
            {loading ? <span className="spinner" aria-hidden="true" /> : '로그인'}
          </button>

          <div className="help-links">
            <button type="button" className="help-link" onClick={()=>switchTo('register')}>회원가입하기</button>
            <Link to="#" className="help-link">비밀번호 찾기</Link>
          </div>
        </form>
      ) : (
        <form className="login-card" onSubmit={submitRegister} noValidate>
          <h2 className="h5 mb-3">{title}</h2>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="email2">이메일</label>
              <input
                id="email2"
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
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="name">이름</label>
              <input id="name" className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="홍길동" required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pw2">비밀번호</label>
              <PasswordInput id="pw2" value={pw} onChange={e=>setPw(e.target.value)} placeholder="6자 이상" />
            </div>
          </div>
          {err && <div className="form-alert" role="alert">{err}</div>}
          <button className="login-btn" disabled={loading} type="submit">
            {loading ? <span className="spinner" aria-hidden="true" /> : '회원가입'}
          </button>

          <div className="help-links">
            <button type="button" className="help-link" onClick={()=>switchTo('login')}>이미 계정이 있으신가요? 로그인</button>
          </div>
        </form>
      )}
    </div>
  );
}
