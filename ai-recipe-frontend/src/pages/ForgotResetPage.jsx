import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ForgotResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestReset(e) {
    e.preventDefault();
    setMsg(''); setErr(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/local/forgot', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email })
      });
      if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.message||'요청 실패'); }
      setMsg('재설정 링크를 이메일로 보냈어요. (로컬/개발에선 콘솔로그로 확인)');
    } catch(e){ setErr(e.message); } finally{ setLoading(false); }
  }

  async function doReset(e) {
    e.preventDefault();
    setMsg(''); setErr(''); 
    if (pw.length < 6) { setErr('비밀번호는 6자 이상'); return; }
    if (pw !== pw2)   { setErr('비밀번호가 일치하지 않습니다'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/local/reset', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token, password: pw })
      });
      if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.message||'재설정 실패'); }
      setMsg('비밀번호가 변경되었어요. 이제 로그인 해주세요.');
      setTimeout(()=>navigate('/login-signup?mode=login', {replace:true}), 800);
    } catch(e){ setErr(e.message); } finally{ setLoading(false); }
  }

  if (token) {
    return (
      <div className="login-wrap">
        <h1 className="login-title">새 비밀번호 설정</h1>
        <form className="login-card" onSubmit={doReset}>
          <div className="form-field">
            <label className="form-label" htmlFor="pw">새 비밀번호</label>
            <input id="pw" className="form-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="6자 이상" required />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="pw2">새 비밀번호 확인</label>
            <input id="pw2" className="form-input" type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="다시 입력" required />
          </div>
          {err && <div className="form-alert" role="alert">{err}</div>}
          {msg && <div className="form-alert ok" role="status">{msg}</div>}
          <button className="login-btn" disabled={loading} type="submit">
            {loading ? <span className="spinner" /> : '비밀번호 변경'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <h1 className="login-title">아이디/비밀번호 찾기</h1>
      <form className="login-card" onSubmit={requestReset}>
        <div className="form-field">
          <label className="form-label" htmlFor="email">가입 이메일</label>
          <input id="email" className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <p className="muted">입력한 주소로 비밀번호 재설정 링크를 보내드립니다.</p>
        {err && <div className="form-alert" role="alert">{err}</div>}
        {msg && <div className="form-alert ok" role="status">{msg}</div>}
        <button className="login-btn" disabled={loading} type="submit">
          {loading ? <span className="spinner" /> : '재설정 링크 보내기'}
        </button>
      </form>
    </div>
  );
}