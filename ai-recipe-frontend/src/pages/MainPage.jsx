// src/pages/MainPage.jsx
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import '../index.css';
import BottomNav from '../components/BottomNav';
import { ensureLogin } from '../auth/ensureLogin';

const BRAND = {
  orange: '#ff7f32',
  teal:   '#009688',
  ink:    '#212529',
  mute:   '#6c757d',
  softBg: '#fff7f1',
  softBd: '#ffd7bf',
};

function AdSlot({ id, height = 90, label = 'AD', fullBleed = false, sticky = false }) {
  if (fullBleed) {
    return (
      <div className={`container-fluid px-0 ${sticky ? 'position-sticky top-0' : ''}`} id={id} role="complementary" aria-label={`${label} 광고영역`}>
        <div className="border-top border-bottom" style={{ background: BRAND.softBg, borderColor: BRAND.softBd }}>
          <div className="container-xxl d-flex align-items-center" style={{ minHeight: height }}>
            <span className="small" style={{ color: BRAND.mute }}>{label}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="my-3" id={id} role="complementary" aria-label={`${label} 광고영역`}>
      <div
        className="border rounded-4 d-flex align-items-center justify-content-center py-3"
        style={{ minHeight: height, background: BRAND.softBg, borderColor: BRAND.softBd }}
      >
        <span className="small" style={{ color: BRAND.mute }}>{label}</span>
      </div>
    </div>
  );
}

function useHScrollControls() {
  const ref = useRef(null);
  const [prev, setPrev] = useState(false);
  const [next, setNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setPrev(scrollLeft > 2);
    setNext(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  const scrollBy = useCallback((dx) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dx, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => { ro.disconnect(); el.removeEventListener('scroll', update); };
  }, [update]);

  return { ref, prev, next, scrollBy };
}

const BrandButton = ({ outline = false, className = '', style = {}, ...props }) => (
  <button
    className={`btn ${outline ? 'btn-outline' : ''} ${className}`}
    style={{
      borderRadius: 10,
      borderColor: BRAND.orange,
      background: outline ? 'transparent' : BRAND.orange,
      color: outline ? BRAND.orange : '#fff',
      ...style
    }}
    {...props}
  />
);

const BrandBadge = ({ tone = 'soft', children, className = '' }) => {
  const styles = useMemo(() => {
    if (tone === 'solid') return { background: BRAND.orange, color: '#fff', borderColor: BRAND.orange };
    if (tone === 'teal')  return { background: BRAND.teal,   color: '#fff', borderColor: BRAND.teal };
    return { background: BRAND.softBg, color: BRAND.ink, borderColor: BRAND.softBd };
  }, [tone]);
  return (
    <span className={`badge border ${className}`} style={{ ...styles, borderWidth: 1.5 }}>
      {children}
    </span>
  );
};

export default function MainPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const hsc = useHScrollControls();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onCardKey = (e, to) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } };

  // 🔐 로그인 가드: HashRouter를 고려해 복귀 경로를 항상 해시 기준으로 저장
  const requireLogin = useCallback(async (backTo, onOk) => {
    const safeBack = backTo ?? (
      window.location.hash
        ? window.location.hash.slice(1)
        : (window.location.pathname + window.location.search)
    );

    // ensureLogin: /api/auth/me → 401이면 내부에서 #/login-signup으로 이동 + postLoginRedirect 저장
    const me = await ensureLogin(safeBack);
    if (!me) return;              // 미로그인 → ensureLogin이 라우팅 처리, 여기서 끝
    if (onOk) onOk();             // 로그인 상태 → 원하는 동작 실행
  }, []);

  const initialRecipes = ['두부 파프리카 볶음', '참치 곤약 비빔', '닭가슴살 유부초밥', '두유 된장국'];
  const extraRecipes   = ['연두부 달걀탕', '현미 닭가슴살 덮밥', '고구마 샐러드', '시금치 두부무침'];
  const recipes        = [...initialRecipes, ...extraRecipes];

  return (
    <div className="container-xxl py-3">
      <AdSlot id="ad-top-banner" height={96} label="Top Banner (728/970×90)" fullBleed />

      <main className="row g-4 mt-1">
        <aside className="col-12 col-lg-3 d-none d-lg-block">
          <div className="position-sticky" style={{ top: 12 }}>
            <AdSlot id="ad-side-1" height={600} label="Skyscraper 300×600" />
            <AdSlot id="ad-side-2" height={250} label="Rectangle 300×250" />
          </div>
        </aside>

        <section className="col-12 col-lg-9">
          <section className="rounded-4 border p-4 p-lg-5" style={{ background: '#fff', borderColor: BRAND.softBd }}>
            <div className="row align-items-center g-4">
              <div className="col-12 col-lg-7">
                <h1 className="display-6 fw-bold mb-2" style={{ color: BRAND.ink }}>
                  <span style={{ color: BRAND.orange }}>Recip</span>
                  <span style={{ color: BRAND.teal }}>Free</span> — 자유롭게, 그러나 건강하게
                </h1>
                <p className="text-secondary mb-3">
                  레시프리는 <strong>집밥 기준</strong>의 저염·저당 원칙을 지키면서도,
                  당신의 취향과 상황에 맞춰 <strong>창의적인 레시피를 제안</strong>합니다.
                </p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {/* 🔐 로그인 게이트 */}
                  <BrandButton onClick={() => requireLogin('/input', () => navigate('/input'))}>
                    나만의 레시피 시작하기
                  </BrandButton>
                  <BrandButton outline className="ms-1" onClick={() => navigate('/community')}>커뮤니티 구경</BrandButton>
                </div>

                <div className="d-flex flex-wrap gap-2 small">
                  <BrandBadge>🍽️ 집밥 기준의 손쉬운 조리</BrandBadge>
                  <BrandBadge>🧂 나트륨·정제당 최소화</BrandBadge>
                  <BrandBadge>🥗 자연스러운 단맛·건강한 기름</BrandBadge>
                </div>

                <AdSlot id="ad-hero-native" height={120} label="네이티브 인라인 (반응형)" />
              </div>

              <div className="col-12 col-lg-5">
                <div className="card shadow-sm border-0">
                  <div className="card-header bg-white border-0 d-flex align-items-center gap-2">
                    <BrandBadge tone="solid">오늘의 맞춤</BrandBadge>
                    <span className="small" style={{ color: BRAND.mute }}>목표·재료·시간 반영</span>
                  </div>
                  <div className="ratio ratio-4x3 bg-light position-relative rounded-top">
                    <img
                      src="/images/chicken-broccoli.jpg"
                      alt="저염 닭가슴살 볶음"
                      className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover rounded-top"
                    />
                  </div>
                  <div className="card-body">
                    <h3 className="h5 fw-semibold mb-1" style={{ color: BRAND.ink }}>저염 닭가슴살 볶음</h3>
                    <div className="small" style={{ color: BRAND.mute }}>단백질 35g · 나트륨 480mg · 18분</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 fw-bold m-0" style={{ color: BRAND.ink }}>요즘 뜨는 레시피</h2>
              <div className="d-flex gap-2">
                <BrandButton outline className="btn-sm" onClick={() => setModalOpen(true)}>
                  전체 보기
                </BrandButton>
              </div>
            </div>

            <div id="trending-cards" className="row g-3">
              {recipes.slice(0, 4).map((t, i) => (
                <div className="col-12 col-sm-6 col-lg-3" key={`${t}-${i}`}>
                  <article
                    className="card h-100 shadow-sm"
                    onClick={() => navigate(`/recipe/${i + 1}`)}
                    onKeyDown={(e)=>onCardKey(e, `/recipe/${i+1}`)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${t} 레시피 보기`}
                  >
                    <div className="position-relative">
                      <div className="ratio ratio-4x3 bg-light rounded-top" />
                      {i < 3 && (
                        <BrandBadge tone="teal" className="position-absolute top-0 start-0 m-2">
                          TOP {i + 1}
                        </BrandBadge>
                      )}
                    </div>
                    <div className="card-body">
                      <h3 className="h6 fw-semibold mb-1" style={{ color: BRAND.ink }}>{t}</h3>
                      <p className="small mb-0" style={{ color: BRAND.mute }}>320kcal · 18분</p>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-4">
            <AdSlot id="ad-infeed-1" height={250} label="In-Feed 336×280 / 반응형" />
          </div>

          <section className="mt-4">
            <div className="mb-2">
              <h2 className="h5 fw-bold m-0" id="how-title" style={{ color: BRAND.ink }}>어떻게 추천하나요?</h2>
            </div>

            <ul className="list-group">
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">📝</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>기본 정보만 입력</div>
                  <div className="small" style={{ color: BRAND.mute }}>키·몸무게·목표·보유 재료만 있으면 충분해요.</div>
                </div>
                <BrandBadge>30초</BrandBadge>
              </li>
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">🧠</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>개인화 분석</div>
                  <div className="small" style={{ color: BRAND.mute }}>목표별 영양 지표(단백질/나트륨/칼로리)로 스코어링해 최적 조합을 제안합니다.</div>
                </div>
                <BrandBadge>실시간</BrandBadge>
              </li>
              <li className="list-group-item d-flex align-items-start gap-3">
                <div className="fs-4" aria-hidden="true">🍳</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold" style={{ color: BRAND.ink }}>조리 가이드 제공</div>
                  <div className="small" style={{ color: BRAND.mute }}>15–20분 레시피·영양정보·대체 재료까지 한 번에 제공합니다.</div>
                </div>
                <BrandBadge tone="solid">맞춤</BrandBadge>
              </li>
            </ul>

            <div className="small mt-3" style={{ color: BRAND.mute }}>
              * 레시프리는 과도한 소금·정제당·포화지방을 지양하고, 집밥에서 구현 가능한 조리법을 우선합니다.
              레시피의 영양 정보는 추정치이며 개인의 상태에 따라 달라질 수 있습니다.
            </div>

            <div className="d-grid d-sm-flex justify-content-sm-center mt-3">
              {/* 🔐 로그인 게이트 */}
              <BrandButton onClick={() => requireLogin('/input', () => navigate('/input'))}>
                내 레시피 받기
              </BrandButton>
            </div>
          </section>
        </section>
      </main>

      <footer className="text-center mt-4">
        <div className="small" style={{ color: BRAND.mute }}>
          * 일부 영역에는 제휴/광고 링크가 포함될 수 있으며, 구매 시 서비스 운영을 위한 수익이 발생할 수 있습니다.
        </div>
        <div className="small" style={{ color: BRAND.mute }}>
          © {new Date().getFullYear()} <strong style={{ color: BRAND.orange }}>Recip</strong><strong style={{ color: BRAND.teal }}>Free</strong>
        </div>
      </footer>

      <BottomNav />
      <div className="bottom-nav-spacer" aria-hidden="true" />

      <div className={`modal fade ${modalOpen ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" aria-hidden={!modalOpen} onClick={() => setModalOpen(false)}>
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" style={{ color: BRAND.ink }}>요즘 뜨는 레시피</h5>
              <button type="button" className="btn-close" onClick={() => setModalOpen(false)} />
            </div>

            <div className="modal-body">
              <div className="position-relative">
                <button
                  type="button"
                  className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm"
                  aria-label="이전"
                  disabled={!hsc.prev}
                  onClick={() => hsc.scrollBy(-320)}
                  style={{ zIndex: 2, borderColor: BRAND.softBd }}
                >‹</button>

                <div
                  className="d-grid gap-3 overflow-auto px-1"
                  ref={hsc.ref}
                  role="list"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') hsc.scrollBy(-320);
                    if (e.key === 'ArrowRight') hsc.scrollBy(320);
                  }}
                  style={{
                    gridAutoFlow: 'column',
                    gridAutoColumns: 'minmax(240px, 280px)',
                    scrollSnapType: 'x mandatory'
                  }}
                >
                  {recipes.map((t, i) => (
                    <article
                      key={`${t}-${i}`}
                      className="card shadow-sm h-100"
                      role="listitem"
                      style={{ scrollSnapAlign: 'start' }}
                      tabIndex={0}
                      onClick={() => navigate(`/recipe/${i + 1}`)}
                      onKeyDown={(e)=>onCardKey(e, `/recipe/${i+1}`)}
                      aria-label={`${t} 레시피 보기`}
                    >
                      <div className="position-relative">
                        <div className="ratio ratio-4x3 bg-light rounded-top" />
                        {i < 3 && (
                          <BrandBadge tone="teal" className="position-absolute top-0 start-0 m-2">
                            TOP {i + 1}
                          </BrandBadge>
                        )}
                      </div>
                      <div className="card-body">
                        <h3 className="h6 fw-semibold mb-1" style={{ color: BRAND.ink }}>{t}</h3>
                        <p className="small mb-0" style={{ color: BRAND.mute }}>320kcal · 18분</p>
                      </div>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm"
                  aria-label="다음"
                  disabled={!hsc.next}
                  onClick={() => hsc.scrollBy(320)}
                  style={{ zIndex: 2, borderColor: BRAND.softBd }}
                >›</button>
              </div>
            </div>

            <div className="modal-footer">
              <BrandButton outline onClick={() => setModalOpen(false)}>닫기</BrandButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
