import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(''); setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('유효한 이메일을 입력하세요.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/auth/local/forgot', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.message || '메일 전송에 실패했습니다.');
      setMsg('재설정 링크를 메일로 보냈습니다. 메일함(스팸함 포함)을 확인해주세요.');
    } catch (e) {
      setErr(e.message || '요청 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="login-wrap">
      <h1 className="login-title">비밀번호 재설정</h1>
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="form-field">
          <label className="form-label" htmlFor="email">가입 이메일</label>
          <input
            id="email"
            className="form-input"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        {err && <div className="form-alert" role="alert">{err}</div>}
        {msg && <div className="form-alert ok" role="status">{msg}</div>}

        <button className="login-btn" type="submit" disabled={sending}>
          {sending ? <span className="spinner" aria-hidden="true" /> : '재설정 메일 보내기'}
        </button>

        <div className="help-links">
          <Link className="help-link" to="/login-signup?mode=login">로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  );
}