// src/pages/MyPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BottomNav from '../compoments/BottomNav';
import { apiFetch } from '../lib/http';
import { fetchWishlist, removeWishlist } from '../lib/wishlist';

/* ── 광고 슬롯 ───────────────────── */
function AdSlot({ id, height = 250, label = 'AD', sticky = false }) {
  return (
    <div
      id={id}
      className={`border border-dashed rounded-3 d-flex align-items-center justify-content-center text-secondary small my-3 ${sticky ? 'position-sticky top-0' : ''}`}
      style={{ height }}
      role="complementary"
      aria-label={label}
    >
      {label}
    </div>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // 1) 현재 로그인 여부 (localStorage) 확인
  let me0 = null;
  try {
    me0 = JSON.parse(localStorage.getItem('authUser') || 'null');
  } catch {
    me0 = null; // 파싱 실패 시 미로그인 취급
  }

  // 2) 로그아웃이면 로그인 화면으로 리다이렉트
  useEffect(() => {
    if (!me0) {
      localStorage.setItem('postLoginRedirect', '/mypage'); // 로그인 후 다시 돌아오게
      navigate('/login-signup', { replace: true, state: { from: '/mypage' } });
    }
  }, [me0, navigate]);

  // 3) 리다이렉트 중엔 화면 렌더 안 함(깜빡임 방지)
  if (!me0) return null;

  // 서버에서 받은 내 정보
  const [me, setMe] = useState(null);

  // 서버의 /api/auth/me 호출 → 로그인 상태면 실제 프로필 세팅
  useEffect(() => {
    if (!me0) return; // ⬅️ 미로그인 시 호출 안 함
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me', { noAuthRedirect: true });
        if (!res.ok) return;
        const data = await res.json(); // { id, email, name, avatar, ... }
        setMe(data);
      } catch {
        // no-op
      }
    })();
  }, [me0]);

  // 데모 유저 데이터 (브랜딩: 레시프리)
  const demoUser = {
    name: '레시프리',
    handle: '@recipfree',
    bio: '레시프리와 함께, 자유롭게 창작하는 맞춤형 건강 레시피.',
    avatar: 'https://picsum.photos/seed/recipfree/200/200'
  };

  // 실제 로그인 정보가 있으면 우선 사용, 없으면 데모로 표시
  const user = me ? {
    name: me.name || (me.email ? me.email.split('@')[0] : '회원'),
    handle: me.email ? `@${me.email.split('@')[0]}` : '@member',
    bio: demoUser.bio,
    avatar: me.avatar || demoUser.avatar,
  } : demoUser;

  const stats = { recipes: 18, saved: 42, comments: 67, streak: 6 };

  const activities = useMemo(() => ([
    { id: 1, type: 'comment', text: '“곤약 비빔 소스 꿀팁 감사합니다!”에 댓글', ago: '2시간 전' },
    { id: 2, type: 'cook', text: '저염 닭가슴살 볶음 요리 완료 기록', ago: '어제' },
    { id: 3, type: 'save', text: '두부 파프리카 볶음 저장함', ago: '2일 전' },
  ]), []);

  // 환경설정 상태
  const [notifOn, setNotifOn] = useState(true);
  const [adPref, setAdPref] = useState('balanced');
  const [dietGoal, setDietGoal] = useState('diet');

  /* ── 저장한 레시피(위시리스트) ───────────────────── */
  const [wishLoading, setWishLoading] = useState(false);
  const [wishErr, setWishErr] = useState('');
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!me0) return;
      setWishLoading(true);
      setWishErr('');
      try {
        const items = await fetchWishlist();
        if (!aborted) setWishlist(items || []);
      } catch {
        if (!aborted) setWishErr('저장한 레시피를 불러오지 못했어요.');
      } finally {
        if (!aborted) setWishLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [me0]);

  async function onRemove(key) {
    const prev = wishlist;
    setWishlist(arr => arr.filter(it => it.itemKey !== key)); // 낙관적 업데이트
    try {
      const r = await removeWishlist(key);
      if (!r.removed) setWishlist(prev); // 롤백
    } catch {
      alert('삭제에 실패했어요.');
      setWishlist(prev); // 롤백
    }
  }

  return (
    <div className="container-xxl py-3">
      {/* 상단 배너 */}
      <AdSlot id="ad-mypage-top" height={90} label="Top Banner (728×90)" />

      {/* 헤더 */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 fw-bold">마이페이지</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-success btn-sm" onClick={() => navigate('/profile')}>프로필 편집</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/settings')}>계정/보안</button>
        </div>
      </div>

      <div className="row g-4">
        {/* 사이드 프로필 */}
        <aside className="col-12 col-lg-4">
          <div className="card shadow-sm mb-3">
            <div className="card-body text-center">
              <img src={user.avatar} alt="avatar" className="rounded-circle mb-2" width={80} height={80} />
              <h5 className="fw-bold">{user.name}</h5>
              <div className="text-secondary small mb-1">{user.handle}</div>
              <p className="text-secondary small">{user.bio}</p>
              <div className="row text-center mt-3">
                <div className="col"><strong>{stats.recipes}</strong><div className="small">작성</div></div>
                <div className="col"><strong>{stats.saved}</strong><div className="small">저장</div></div>
                <div className="col"><strong>{stats.comments}</strong><div className="small">댓글</div></div>
                <div className="col"><strong>{stats.streak}일</strong><div className="small">연속</div></div>
              </div>
              <div className="d-grid gap-2 mt-3">
                <button className="btn btn-outline-success btn-sm" onClick={() => navigate('/saved')}>저장한 레시피</button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/activity')}>활동 내역</button>
              </div>
            </div>
          </div>
          <AdSlot id="ad-mypage-side" height={600} label="Skyscraper 300×600" sticky />
        </aside>

        {/* 메인 */}
        <section className="col-12 col-lg-8">
          {/* 저장한 레시피 (실데이터) */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">저장한 레시피</h5>
              <span className="text-secondary small">{wishlist.length}개</span>
            </div>

            {wishLoading && (
              <div className="p-3">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-10 mb-2" style={{ height: 18 }} />
                  <div className="placeholder col-8" style={{ height: 18 }} />
                </div>
              </div>
            )}

            {!wishLoading && wishErr && (
              <div className="alert alert-danger m-3" role="alert">{wishErr}</div>
            )}

            {!wishLoading && !wishErr && wishlist.length === 0 && (
              <div className="p-4 text-center text-secondary">
                아직 저장한 레시피가 없어요.
                <div className="mt-2">
                  <Link className="btn btn-sm btn-success" to="/input">레시피 받으러 가기</Link>
                </div>
              </div>
            )}

            {!wishLoading && !wishErr && wishlist.length > 0 && (
              <div className="list-group list-group-flush">
                {wishlist.map((w) => (
                  <div key={w.id} className="list-group-item">
                    <div className="d-flex align-items-center gap-3">
                      <div className="flex-shrink-0">
                        <div
                          className="rounded"
                          style={{
                            width: 72, height: 48, background: '#f3f3f3',
                            backgroundImage: w.image ? `url(${w.image})` : undefined,
                            backgroundSize: 'cover', backgroundPosition: 'center'
                          }}
                        />
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold text-truncate">{w.title}</div>
                        {w.meta && <div className="small text-secondary">{w.meta}</div>}
                        {w.summary && <div className="small text-secondary text-truncate">{w.summary}</div>}
                      </div>
                      <div className="d-flex gap-2">
                        {/* 상세 페이지가 있다면 라우팅 연결 */}
                        {/* <Link className="btn btn-sm btn-outline-primary" to={`/recipe/${w.id ?? ''}`}>보기</Link> */}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemove(w.itemKey)}
                          title="찜 해제"
                        >
                          제거
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 광고 */}
          <AdSlot id="ad-mypage-native" height={120} label="네이티브 인라인" />

          {/* 최근 활동 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="m-0">최근 활동</h5>
              <button className="btn btn-link btn-sm" onClick={() => navigate('/activity')}>전체보기</button>
            </div>
            <ul className="list-group list-group-flush">
              {activities.map(a => (
                <li key={a.id} className="list-group-item d-flex justify-content-between">
                  <span>{a.text}</span>
                  <small className="text-secondary">{a.ago}</small>
                </li>
              ))}
            </ul>
          </div>

          {/* 환경설정 */}
          <div className="card shadow-sm">
            <div className="card-header"><h5 className="m-0">환경 설정</h5></div>
            <div className="card-body d-grid gap-3">
              {/* 알림 */}
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">알림</div>
                  <div className="text-secondary small">댓글/좋아요/팔로우 알림</div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={notifOn} onChange={(e)=>setNotifOn(e.target.checked)} />
                </div>
              </div>
              {/* 광고 */}
              <div>
                <label className="form-label">광고 노출 선호도</label>
                <select className="form-select" value={adPref} onChange={(e)=>setAdPref(e.target.value)}>
                  <option value="min">최소</option>
                  <option value="balanced">보통</option>
                  <option value="max">많이</option>
                </select>
              </div>
              {/* 목표 */}
              <div>
                <label className="form-label">기본 목표</label>
                <select className="form-select" value={dietGoal} onChange={(e)=>setDietGoal(e.target.value)}>
                  <option value="diet">다이어트</option>
                  <option value="highProtein">고단백</option>
                  <option value="lowSodium">저염</option>
                  <option value="lowSugar">저당</option>
                  <option value="bulk">벌크업</option>
                  <option value="vegan">비건</option>
                  <option value="glutenFree">글루텐프리</option>
                </select>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-success" onClick={()=>alert('저장되었습니다 (데모)')}>저장</button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={()=>{
                    setNotifOn(true);
                    setAdPref('balanced');
                    setDietGoal('diet');
                  }}
                >
                  기본값으로
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 푸터 */}
      <footer className="text-center text-secondary small mt-4">
        * 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.<br/>
        © {new Date().getFullYear()} <span className="fw-semibold">RECIP</span><span className="text-primary fw-semibold">FREE</span>
      </footer>

      {/* 모바일 하단 네비 */}
      <BottomNav />
    </div>
  );
}
