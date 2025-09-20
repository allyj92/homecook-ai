// src/pages/ShopPage.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import '../index.css';
import BottomNav from '../components/BottomNav';
import AdCarousel from '../components/AdCarousel';
import { ensureLogin } from '../auth/ensureLogin';


/* ── 간단 광고 슬롯 ───────────────────────────── */
function AdSlot({ id, label = 'AD', variant = 'leaderboard', fullBleed = false, width = '100%', height }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.minHeight = height;

  if (fullBleed) {
    return (
      <div className="container-fluid px-0 my-3" id={id} role="complementary" aria-label={`${label} 광고영역`}>
        <div className={['w-100', variant === 'leaderboard' ? 'py-3' : '', 'bg-body-tertiary border-top border-bottom'].join(' ')} style={style}>
          <div className="container-xxl d-flex align-items-center" style={{ minHeight: height ?? 90 }}>
            <span className="small text-secondary">{label}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="my-3" role="complementary" aria-label={`${label} 광고영역`}>
      <div
        className={['bg-body-tertiary', 'border rounded-3', variant === 'leaderboard' ? 'py-3' : 'py-2', 'd-flex align-items-center justify-content-center'].join(' ')}
        style={style}
      >
        <span className="small text-secondary">{label}</span>
      </div>
    </div>
  );
}

/* ── 뱃지 ─────────────────────────────────────── */
function Badge({ children, tone = 'gray' }) {
  const map = {
    brand: 'text-bg-success',
    green: 'text-bg-success',
    line: 'border border-secondary-subtle text-secondary',
    gray: 'text-bg-secondary'
  };
  const cls = map[tone] || map.gray;
  return <span className={`badge rounded-pill ${cls}`}>{children}</span>;
}

/* ── 가로 스크롤 컨트롤 ───────────────────────── */
function useHScrollControls() {
  const ref = useRef(null);
  const [prev, setPrev] = useState(false);
  const [next, setNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setPrev(scrollLeft > 2);
    setNext(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  const scrollBy = useCallback((dx) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dx, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [update]);

  return { ref, prev, next, update, scrollBy };
}

/* ── 상품 카드 ─────────────────────────────────── */
function ProductCard({ p, onClick, onAdd, onBuy }) {
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
  };
  return (
    <article
      className="card h-100 shadow-sm p-card-tall"
      tabIndex={0}
      role="button"
      aria-label={`${p.name} 상세 보기`}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <div className="ratio ratio-4x3 bg-light position-relative">
        {p.img && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{ background: `url(${p.img}) center/cover no-repeat` }}
            aria-hidden="true"
          />
        )}
        <div className="position-absolute bottom-0 start-0 d-flex gap-2 p-2">
          <span className="badge text-bg-success fw-bold">{p.price.toLocaleString()}원</span>
          {p.origPrice && (
            <span className="badge bg-dark-subtle text-decoration-line-through">
              {p.origPrice.toLocaleString()}원
            </span>
          )}
        </div>
      </div>

      <div className="card-body d-grid gap-2">
        <h3 className="h6 fw-bold mb-1">{p.name}</h3>
        <div className="d-flex flex-wrap gap-2">
          {p.goals?.map((g) => <Badge key={g} tone="line">{g}</Badge>)}
          {p.lowSodium && <Badge tone="brand">저염</Badge>}
          {p.highProtein && <Badge tone="green">고단백</Badge>}
        </div>
        <div className="text-secondary small mt-auto d-flex gap-2">
          <span>{p.kcal}kcal</span>
          <span>· 단백질 {p.protein}g</span>
          <span>· 나트륨 {p.sodium}mg</span>
        </div>
      </div>

      <div className="card-footer bg-white border-top-0 pt-0">
        <div className="d-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); onAdd?.(p); }}
          >
            담기
          </button>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={(e) => { e.stopPropagation(); onBuy?.(p); }}
          >
            구매
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── 뷰포트 고정 닫기 버튼 ─────────────────────── */
function CloseButtonFixed({ onClick }) {
  return (
    <button
      type="button"
      className="btn btn-light border rounded-circle shadow position-fixed"
      aria-label="닫기"
      onClick={onClick}
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
        width: 44,
        height: 44,
        display: 'grid',
        placeItems: 'center',
        zIndex: 2000
      }}
    >
      <span aria-hidden>✕</span>
    </button>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();

  const [q, setQ]       = useState(params.get('q') ?? '');
  const [cat, setCat]   = useState(params.get('cat') ?? 'all');
  const [goal, setGoal] = useState(params.get('goal') ?? 'all');
  const [sort, setSort] = useState(params.get('sort') ?? 'popular');

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [bundleModalOpen, setBundleModalOpen]   = useState(false);

  // 로그인 요구 래퍼: 서버 세션 기준
    async function requireLogin(after) {
   const back = loc.pathname + (loc.search || '');
   await Promise.resolve(); // microtask yield 
   const user = await ensureLogin(back);
    if (!user) return; // ensureLogin이 해시 리다이렉트 수행
    after?.();
 }

  // ESC로 모달 닫기
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (productModalOpen) setProductModalOpen(false);
        if (bundleModalOpen) setBundleModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [productModalOpen, bundleModalOpen]);

  const [pageSize, setPageSize] = useState(8);
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      if (w < 420) setPageSize(4);
      else if (w < 640) setPageSize(6);
      else if (w < 1024) setPageSize(8);
      else setPageSize(12);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const [productPage, setProductPage] = useState(1);
  const [bundlePage, setBundlePage]   = useState(1);

  const prod = useHScrollControls();
  const bun  = useHScrollControls();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const promos = [
    { title: '신상: 저염 한끼 브리또', desc: '300kcal대 / 단백질 UP', href: '#', img: '/foods/burrito.jpg' },
    { title: '세트할인 15%',           desc: '주 5회 식단패키지',       href: '#', img: '/foods/salmon-salad.jpg' },
    { title: '런칭기념 무료배송',       desc: '2만원 이상 구매 시',      href: '#', img: '/foods/pita.jpg' },
  ];

  const bundles = [
    { id:'hp5', title:'저염 고단백 5일 세트',   desc:'평일 점심 한 끼 딱 맞춘 구성', price:26900, img:'/bundles/hi-protein-5.jpg', tag:'저염/고단백' },
    { id:'br4', title:'다이어트 브리또 4종',    desc:'300kcal대 / 포만감 챙김',       price:19900, img:'/bundles/burrito-4.jpg',    tag:'다이어트' },
    { id:'sl3', title:'샐러드 3종 콤보',        desc:'신선/단백/가벼움',               price:15900, img:'/bundles/salad-3.jpg',     tag:'샐러드' },
    { id:'gf3', title:'잡곡/현미 3팩',         desc:'균형 탄수화물',                  price: 9900, img:'/bundles/grain-3.jpg',     tag:'균형' },
    { id:'no5', title:'저염 면요리 5팩',       desc:'곤약/로제/토마토',               price:24900, img:'/bundles/noodle-5.jpg',    tag:'저염' },
  ];

  const products = useMemo(() => ([
    { id: 1, name: '저염 닭가슴살 피타 샌드',           kcal: 320, protein: 32, sodium: 450, price: 4900, goals: ['다이어트', '저염'],  lowSodium: true,  highProtein: true,  cat: '빵/샌드', img: '/foods/pita.jpg' },
    { id: 2, name: '두부 스테이크 샐러드',               kcal: 280, protein: 24, sodium: 380, price: 5400, goals: ['저염', '고단백'],    lowSodium: true,  highProtein: true,  cat: '샐러드',  img: '/foods/tofu-salad.jpg' },
    { id: 3, name: '잡곡밥 소고기 덮밥(저당소스)',       kcal: 390, protein: 27, sodium: 520, price: 6900, goals: ['저당', '고단백'],    lowSodium: false, highProtein: true,  cat: '덮밥',    img: '/foods/beef-bowl.jpg' },
    { id: 4, name: '곤약 파스타 로제',                   kcal: 310, protein: 20, sodium: 480, price: 6300, goals: ['다이어트'],         lowSodium: true,  highProtein: false, cat: '면류',    img: '/foods/pasta.jpg' },
    { id: 5, name: '에어프라이어 닭다리 허브구이(저염)', kcal: 330, protein: 33, sodium: 430, price: 7200, goals: ['저염', '고단백'],   lowSodium: true,  highProtein: true,  cat: '메인',    img: '/foods/chicken.jpg' },
    { id: 6, name: '렌틸콩 단백 키마커리(잡곡밥)',       kcal: 360, protein: 25, sodium: 510, price: 6800, goals: ['고단백'],           lowSodium: false, highProtein: true,  cat: '덮밥',    img: '/foods/curry.jpg' },
    { id: 7, name: '병아리콩 단백 브리또',               kcal: 340, protein: 22, sodium: 470, price: 5600, goals: ['다이어트', '저염'], lowSodium: true,  highProtein: false, cat: '빵/샌드', img: '/foods/burrito.jpg' },
    { id: 8, name: '훈제연어 두유소스 샐러드',           kcal: 300, protein: 23, sodium: 440, price: 5900, goals: ['저염'],             lowSodium: true,  highProtein: false, cat: '샐러드',  img: '/foods/salmon-salad.jpg' },
  ]), []);

  const list = useMemo(() => {
    let arr = products;
    if (q) {
      const k = q.toLowerCase();
      arr = arr.filter(p => (p.name + ' ' + p.goals.join(' ') + ' ' + p.cat).toLowerCase().includes(k));
    }
    if (cat !== 'all') arr = arr.filter(p => p.cat === cat);
    if (goal !== 'all') {
      if (goal === '저염')        arr = arr.filter(p => p.lowSodium);
      else if (goal === '고단백') arr = arr.filter(p => p.highProtein);
      else                        arr = arr.filter(p => p.goals.includes(goal));
    }
    if (sort === 'popular')       arr = [...arr].sort((a, b) => (Number(b.highProtein) - Number(a.highProtein)) || (a.kcal - b.kcal));
    else if (sort === 'priceAsc') arr = [...arr].sort((a, b) => a.price - b.price);
    else if (sort === 'priceDesc')arr = [...arr].sort((a, b) => b.price - a.price);
    else if (sort === 'kcalAsc')  arr = [...arr].sort((a, b) => a.kcal - b.kcal);
    return arr;
  }, [products, q, cat, goal, sort]);

  useEffect(() => { if (productModalOpen) setProductPage(1); }, [productModalOpen]);
  useEffect(() => { if (bundleModalOpen)  setBundlePage(1); }, [bundleModalOpen]);

  function syncQuery(next = {}) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v == null ? merged.delete(k) : merged.set(k, String(v)) ));
    setParams(merged, { replace: true });
  }

  return (
    <div className="homec-wrap shop-wrap container-xxl py-3">
      <AdSlot id="ad-shop-top" label="Shop Top Banner" variant="leaderboard" fullBleed height={100} />

      <header className="shop-header py-3">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-xl-3">
            <h1 className="h3 fw-bold m-0">건강식 스토어</h1>
          </div>

          <div className="col-12 col-xl-9">
            <div className="row g-2">
              <div className="col-12 col-lg-6">
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                  </span>
                  <input
                    className="form-control"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); syncQuery({ q: e.target.value }); }}
                    placeholder="상품 검색 (예: 저염, 브리또, 샐러드)"
                  />
                  {q ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => { setQ(''); syncQuery({ q: null }); }}
                      aria-label="검색어 지우기"
                    >
                      지우기
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => alert('음성 검색(데모)')}
                    >
                      🎙
                    </button>
                  )}
                </div>
              </div>

              <div className="col-6 col-lg-3">
                <select
                  className="form-select"
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); syncQuery({ sort: e.target.value }); }}
                  aria-label="정렬"
                >
                  <option value="popular">추천순</option>
                  <option value="priceAsc">가격↑</option>
                  <option value="priceDesc">가격↓</option>
                  <option value="kcalAsc">칼로리 낮은순</option>
                </select>
              </div>

              <div className="col-6 col-lg-3 d-grid">
                <button
                  type="button"
                  className="btn btn-outline-secondary position-relative"
                  onClick={() => requireLogin(() => alert('장바구니(데모)'))}
                >
                  <svg width="18" height="18" className="me-1" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M7 4h10l1 4H6l1-4zm-1 6h12l-1.5 8h-9L6 10zM9 4a3 3 0 116 0" />
                  </svg>
                  장바구니
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success">
                    2
                    <span className="visually-hidden">items in cart</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AdCarousel items={promos} height={160} ariaLabel="쇼핑 프로모션" />

      <main className="shop-main row g-4 mt-1">
        <aside className="shop-side col-12 col-lg-3">
          <div className="sticky-top" style={{ top: 12 }}>
            <div className="card mb-3">
              <div className="card-body">
                <h4 className="h6 text-secondary fw-semibold mb-3">카테고리</h4>
                {['all', '빵/샌드', '샐러드', '덮밥', '면류', '메인'].map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-sm me-2 mb-2 ${cat === c ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => { setCat(c); syncQuery({ cat: c }); }}
                  >
                    {c === 'all' ? '전체' : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-body">
                <h4 className="h6 text-secondary fw-semibold mb-3">목표/특징</h4>
                {['all', '저염', '고단백', '저당', '다이어트'].map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`btn btn-sm me-2 mb-2 ${goal === g ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => { setGoal(g); syncQuery({ goal: g }); }}
                  >
                    {g === 'all' ? '전체' : g}
                  </button>
                ))}
              </div>
            </div>

            <AdSlot id="ad-shop-side" height={600} label="Skyscraper 300×600" />
          </div>
        </aside>

        <section className="shop-list col-12 col-lg-9">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h5 fw-bold m-0">상품</h2>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setProductModalOpen(true)}>더보기</button>
          </div>

          {list.length === 0 && (
            <div className="alert alert-secondary" role="status">
              조건에 맞는 상품이 없어요.
            </div>
          )}

          <div className="position-relative hscroll-wrap">
            <button
              type="button"
              className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm hscroll-nav"
              aria-label="이전 상품"
              disabled={!prod.prev}
              onClick={() => prod.scrollBy(-320)}
              style={{ zIndex: 2 }}
            >‹</button>

            <div
              className="d-grid hscroll product-scroll"
              role="list"
              ref={prod.ref}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') prod.scrollBy(-320);
                if (e.key === 'ArrowRight') prod.scrollBy(320);
              }}
            >
              {list.map((p) => (
                <article key={p.id} role="listitem" className="hscroll-item">
                  <ProductCard
                    p={p}
                    onClick={() => navigate(`/shop/${p.id}`)}
                    onAdd={() => requireLogin(() => alert('담김(데모)'))}
                    onBuy={() => requireLogin(() => alert('구매(데모)'))}
                  />
                </article>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm hscroll-nav"
              aria-label="다음 상품"
              disabled={!prod.next}
              onClick={() => prod.scrollBy(320)}
              style={{ zIndex: 2 }}
            >›</button>

            <div className="hscroll-fade left" aria-hidden="true" />
            <div className="hscroll-fade right" aria-hidden="true" />
          </div>

          <AdSlot id="ad-shop-infeed" height={250} label="In-Feed 336×280 / 반응형" />

          <section className="bundle mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h5 fw-bold m-0">추천 세트</h2>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setBundleModalOpen(true)}>더보기</button>
            </div>

            <div className="position-relative hscroll-wrap">
              <button
                type="button"
                className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm hscroll-nav"
                aria-label="이전 세트"
                disabled={!bun.prev}
                onClick={() => bun.scrollBy(-320)}
                style={{ zIndex: 2 }}
              >‹</button>

              <div
                className="d-grid hscroll bundle-scroll"
                role="list"
                ref={bun.ref}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') bun.scrollBy(-320);
                  if (e.key === 'ArrowRight') bun.scrollBy(320);
                }}
              >
                {bundles.map(b => (
                  <article
                    key={b.id}
                    className="card hscroll-item shadow-sm"
                    role="listitem"
                    tabIndex={0}
                    onClick={() => alert(`${b.title} 선택(데모)`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alert(`${b.title} 선택(데모)`); } }}
                  >
                    <div className="ratio ratio-16x9 bg-light position-relative">
                      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: `url(${b.img}) center/cover no-repeat` }} aria-hidden="true" />
                      <span className="badge bg-dark-subtle position-absolute top-0 start-0 m-2">{b.tag}</span>
                    </div>
                    <div className="card-body">
                      <h3 className="h6 fw-bold mb-1">{b.title}</h3>
                      <p className="small text-secondary mb-2">{b.desc}</p>
                      <div className="d-flex align-items-center">
                        <strong className="me-2 me-sm-3">{b.price.toLocaleString()}원</strong>
                        <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="세트 액션">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={(e) => { e.stopPropagation(); requireLogin(() => alert('세트 담기(데모)')); }}
                          >
                            담기
                          </button>
                          <button
                            type="button"
                            className="btn btn成功 text-white btn-success"
                            onClick={(e) => { e.stopPropagation(); requireLogin(() => alert('세트 구매(데모)')); }}
                          >
                            구매
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm hscroll-nav"
                aria-label="다음 세트"
                disabled={!bun.next}
                onClick={() => bun.scrollBy(320)}
                style={{ zIndex: 2 }}
              >›</button>

              <div className="hscroll-fade left" aria-hidden="true" />
              <div className="hscroll-fade right" aria-hidden="true" />
            </div>
          </section>
        </section>
      </main>

      <footer className="homec-footer text-center text-secondary mt-4">
        <div className="small">* 일부 상품은 제휴/광고 포함 가능하며, 구매 시 수수료를 받을 수 있습니다.</div>
        <div className="copy small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />

      {/* ===== 모달: 상품 전체보기 ===== */}
      <div
        className={`modal fade ${productModalOpen ? 'show d-block' : ''}`}
        tabIndex="-1"
        role="dialog"
        aria-hidden={!productModalOpen}
        onClick={() => setProductModalOpen(false)}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content position-relative">
            <div className="modal-header position-sticky top-0 bg-white" style={{ zIndex: 2 }}>
              <h5 className="modal-title">상품 전체 보기</h5>
              <button type="button" className="btn-close" aria-label="닫기" onClick={() => setProductModalOpen(false)} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                {list.slice((productPage - 1) * pageSize, productPage * pageSize).map(p => (
                  <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={p.id}>
                    <ProductCard
                      p={p}
                      onClick={() => navigate(`/shop/${p.id}`)}
                      onAdd={() => requireLogin(() => alert('담김(데모)'))}
                      onBuy={() => requireLogin(() => alert('구매(데모)'))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer justify-content-between">
              <button type="button" className="btn btn-outline-secondary" disabled={productPage <= 1} onClick={() => setProductPage(p => p - 1)}>◀</button>
              <span className="small">{productPage} / {Math.max(1, Math.ceil(list.length / pageSize))}</span>
              <button type="button" className="btn btn-outline-secondary" disabled={productPage >= Math.max(1, Math.ceil(list.length / pageSize))} onClick={() => setProductPage(p => p + 1)}>▶</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 모달: 추천 세트 전체보기 ===== */}
      <div
        className={`modal fade ${bundleModalOpen ? 'show d-block' : ''}`}
        tabIndex="-1"
        role="dialog"
        aria-hidden={!bundleModalOpen}
        onClick={() => setBundleModalOpen(false)}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content position-relative">
            <div className="modal-header position-sticky top-0 bg-white" style={{ zIndex: 2 }}>
              <h5 className="modal-title">추천 세트 전체 보기</h5>
              <button type="button" className="btn-close" aria-label="닫기" onClick={() => setBundleModalOpen(false)} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                {bundles.slice((bundlePage - 1) * pageSize, bundlePage * pageSize).map(b => (
                  <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={b.id}>
                    <article className="card h-100 shadow-sm" role="button" tabIndex={0}
                      onClick={() => alert(`${b.title} 선택(데모)`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alert(`${b.title} 선택(데모)`); } }}
                    >
                      <div className="ratio ratio-16x9 bg-light position-relative">
                        <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: `url(${b.img}) center/cover no-repeat` }} />
                        <span className="badge bg-dark-subtle position-absolute top-0 start-0 m-2">{b.tag}</span>
                      </div>
                      <div className="card-body">
                        <h3 className="h6 fw-bold mb-1">{b.title}</h3>
                        <p className="small text-secondary mb-2">{b.desc}</p>
                        <div className="d-flex align-items-center">
                          <strong className="me-2 me-sm-3">{b.price.toLocaleString()}원</strong>
                          <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="세트 액션">
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={(e) => { e.stopPropagation(); requireLogin(() => alert('세트 담기(데모)')); }}
                            >
                              담기
                            </button>
                            <button
                              type="button"
                              className="btn btn-success text-white"
                              onClick={(e) => { e.stopPropagation(); requireLogin(() => alert('세트 구매(데모)')); }}
                            >
                              구매
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer justify-content-between">
              <button type="button" className="btn btn-outline-secondary" disabled={bundlePage <= 1} onClick={() => setBundlePage(p => p - 1)}>◀</button>
              <span className="small">{bundlePage} / {Math.max(1, Math.ceil(bundles.length / pageSize))}</span>
              <button type="button" className="btn btn-outline-secondary" disabled={bundlePage >= Math.max(1, Math.ceil(bundles.length / pageSize))} onClick={() => setBundlePage(p => p + 1)}>▶</button>
            </div>
          </div>
        </div>
      </div>

      {productModalOpen && <CloseButtonFixed onClick={() => setProductModalOpen(false)} />}
      {bundleModalOpen && <CloseButtonFixed onClick={() => setBundleModalOpen(false)} />}
    </div>
  );
}
