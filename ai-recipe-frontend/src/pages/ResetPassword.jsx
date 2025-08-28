import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const token = params.get('token') || '';

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token) setErr('유효하지 않은 링크입니다. 메일의 링크를 다시 열어주세요.');
  }, [token]);

  const canSubmit = token && pw.length >= 6 && pw === pw2;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/local/reset', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ token, password: pw })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.message || '재설정에 실패했습니다.');
      setMsg('비밀번호가 변경되었습니다. 이제 로그인할 수 있어요!');
      // 잠깐 안내 후 로그인 페이지로
      setTimeout(() => nav('/login-signup?mode=login', { replace: true }), 1200);
    } catch (e) {
      setErr(e.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <h1 className="login-title">새 비밀번호 설정</h1>
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="form-field">
          <label className="form-label" htmlFor="pw">새 비밀번호</label>
          <input
            id="pw"
            className="form-input"
            type="password"
            value={pw}
            onChange={e=>setPw(e.target.value)}
            placeholder="6자 이상"
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="pw2">새 비밀번호 확인</label>
          <input
            id="pw2"
            className="form-input"
            type="password"
            value={pw2}
            onChange={e=>setPw2(e.target.value)}
            placeholder="다시 입력"
            required
          />
        </div>

        {pw && pw2 && pw !== pw2 && (
          <div className="field-hint error">비밀번호가 일치하지 않습니다.</div>
        )}

        {err && <div className="form-alert" role="alert">{err}</div>}
        {msg && <div className="form-alert ok" role="status">{msg}</div>}

        <button className="login-btn" disabled={!canSubmit || loading} type="submit">
          {loading ? <span className="spinner" aria-hidden="true" /> : '비밀번호 변경'}
        </button>

        <div className="help-links">
          <Link className="help-link" to="/login-signup?mode=login">로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  );
}
