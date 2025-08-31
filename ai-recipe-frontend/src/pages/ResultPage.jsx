// src/pages/ResultPage.jsx
import { useLocation, Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { requestRecommend, requestRecommendTop } from '../api';
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../compoments/BottomNav'; // ✅ 폴더 오타 수정
import { listFavorites, addFavorite, removeFavorite, isFavoriteIn } from '../lib/wishlist'; // ✅ 신규 API

/* ── 라벨 ─────────────────────────────── */
const GOAL_LABELS = {
  low_sodium: '저염',
  vegan: '비건',
  glutenFree: '글루텐프리',
  low_sugar: '저당',
  highProtein: '고단백',
  bulk: '벌크업',
  diet: '다이어트',
  quick: '간편',
};
const toKoreanGoals = (goals) =>
  Array.isArray(goals) ? goals.map((g) => GOAL_LABELS[g]).filter(Boolean) : [];

/* ── 재료 정규화 ──────────────────────── */
const UNIT_WORDS = [
  'g','kg','mg','ml','mL','L','ℓ','개','대','장','쪽','줄','줌','봉','팩','캔',
  '컵','스푼','숟가락','큰술','작은술','티스푼','꼬집','조금','약간','스틱'
];
const CANON = [
  [/닭\s*가슴\s*살|닭가슴/gi, '닭가슴살'],
  [/피자\s*치즈|치즈/gi, '피자치즈'],
  [/올리브\s*유/gi, '올리브유'],
  [/에리스리톨|에리/gi, '에리스리톨'],
  [/후추가루|후추/gi, '후추'],
  [/타마리/gi, '타마리 간장'],
  [/저염\s*간장/gi, '저염간장'],
  [/간장/gi, '간장'],
];
function extractName(raw = '') {
  let s = String(raw)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[0-9]+([./][0-9]+)?/g, ' ')
    .replace(new RegExp(UNIT_WORDS.join('|'), 'gi'), ' ')
    .replace(/[·\-*\u00B7]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, rep] of CANON) s = s.replace(re, rep);
  s = s.replace(/^(저염|무염|유기농|저지방|국산|수입)\s*/,'').trim();
  if (/간장/.test(raw)) return '간장';
  return s;
}
const normalizeIngredients = (list = []) =>
  Array.from(new Set(list.map(extractName).filter(Boolean)));

/* ── (데모) 광고 API ─────────────────── */
async function fetchAdsByIngredients(ingredients = []) {
  try {
    const demo = {};
    ingredients.forEach((name) => {
      demo[name] = [{
        id: `ad-${name}`,
        name: `${name}`,
        price: '₩3,900~',
        shop: '스폰서',
        url: `/shop?q=${encodeURIComponent(name)}&utm_source=homecook&utm_medium=native&utm_term=${encodeURIComponent(name)}`,
        image: `https://picsum.photos/seed/${encodeURIComponent(name)}/640/360`
      }];
    });
    return { results: demo };
  } catch {
    return { results: {} };
  }
}

/* ── 토스트(간단) ───────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = 'info', ttl = 2000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }, []);
  const View = () => (
    <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1100 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast show align-items-center text-bg-${
            t.type === 'error' ? 'danger' : t.type === 'success' ? 'success' : 'secondary'
          } border-0 mb-2`}
          role="alert"
        >
          <div className="d-flex">
            <div className="toast-body">{t.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
  return { push, View };
}

/* ── 반응형 perView ─────────────────── */
function usePerView() {
  const [perView, setPerView] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    if (w >= 1200) return 4;
    if (w >= 992) return 3;
    if (w >= 576) return 2;
    return 1;
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setPerView(w >= 1200 ? 4 : w >= 992 ? 3 : w >= 576 ? 2 : 1);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return perView;
}

/* ── 멀티 카드 캐러셀 ───────────────── */
function IngredientAdCard({ item }) {
  if (!item) return null;
  return (
    <a className="text-decoration-none" href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="card h-100 shadow-sm">
        <div className="ratio ratio-16x9 bg-light rounded-top">
          <div
            className="w-100 h-100 rounded-top"
            style={{ backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            aria-hidden="true"
          />
        </div>
        <div className="card-body d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-semibold text-dark">{item.name}</div>
            <div className="small text-secondary mt-1">
              <span className="badge rounded-pill text-bg-light me-2 border">AD</span>
              {item.shop}
            </div>
          </div>
          <div className="fw-bold text-dark">{item.price}</div>
        </div>
      </div>
    </a>
  );
}
function AdCarouselMulti({ items = [], interval = 3000 }) {
  const perView = usePerView();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const loopItems = useMemo(() => {
    if (!items.length) return [];
    const need = Math.max(items.length, perView * 3);
    return Array.from({ length: need }, (_, i) => items[i % items.length]);
  }, [items, perView]);

  useEffect(() => {
    if (!loopItems.length) return;
    const t = setInterval(() => { if (!paused) setIdx((i) => (i + 1) % loopItems.length); }, interval);
    return () => clearInterval(t);
  }, [loopItems.length, interval, paused]);

  if (!loopItems.length) return null;
  const basis = `${100 / perView}%`;
  const translateX = `translateX(-${(idx * 100) / perView}%)`;

  return (
    <div className="position-relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="d-flex" style={{ gap: 12, transform: translateX, transition: 'transform 400ms ease', willChange: 'transform' }}>
        {loopItems.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{ flex: `0 0 ${basis}` }}>
            <IngredientAdCard item={item} />
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm" onClick={() => setIdx((i) => (i - 1 + loopItems.length) % loopItems.length)} aria-label="이전" style={{ zIndex: 2 }}>‹</button>
      <button type="button" className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm" onClick={() => setIdx((i) => (i + 1) % loopItems.length)} aria-label="다음" style={{ zIndex: 2 }}>›</button>
    </div>
  );
}

/* ── 하단 고정 액션바 ───────────────── */
function StickyActionBar({ visible, saved, onToggle, onRetry }) {
  if (!visible) return null;
  return (
    <div
      className="position-fixed bottom-0 start-0 end-0 border-top bg-white"
      style={{ zIndex: 1050, boxShadow: '0 -8px 24px rgba(0,0,0,0.06)' }}
    >
      <div className="container-xxl py-2">
        <div className="d-flex gap-2">
          <button
            type="button"
            className={`btn btn-lg flex-grow-1 ${saved ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={onToggle}
            aria-pressed={saved}
            aria-label="찜하기"
            title={saved ? '찜 해제' : '찜하기'}
          >
            {saved ? '♥ 찜됨' : '♡ 찜하기'}
          </button>
          <button type="button" className="btn btn-lg btn-outline-secondary" onClick={onRetry} title="같은 조건으로 다시 추천">
            다시 추천
          </button>
          <Link className="btn btn-lg btn成功" to="/input">
            조건 변경
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── 읽기 쉬운 “예상 영양” 카드 ───────────────── */
function NutritionTiles({ data }) {
  const Item = ({ label, value, unit }) => (
    <div className="col-6 col-md-3">
      <div className="border rounded-3 p-3 text-center h-100">
        <div className="text-secondary small mb-1">{label}</div>
        <div className="fw-bold" style={{ fontSize: 22, lineHeight: 1.1 }}>
          {value ?? '-'} <span className="text-secondary" style={{ fontSize: 14 }}>{unit}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="fw-semibold" style={{ fontSize: 18 }}>예상 영양</div>
          <span className="badge text-bg-primary">⏱ 약 {data.cook_time_min}분</span>
        </div>
        <div className="row g-2 g-md-3">
          <Item label="열량" value={data.kcal} unit="kcal" />
          <Item label="탄수화물" value={data.carbs_g} unit="g" />
          <Item label="단백질" value={data.protein_g} unit="g" />
          <Item label="지방" value={data.fat_g} unit="g" />
          {data.sodium_mg != null && <Item label="나트륨" value={data.sodium_mg} unit="mg" />}
        </div>
      </div>
    </div>
  );
}

/* ── 페이지 ─────────────────────────── */
export default function ResultPage() {
  const loc = useLocation();
  const { push: toast, View: Toasts } = useToast();

  // 최초 데이터
  const initList =
    loc.state?.list || JSON.parse(localStorage.getItem('recipe_result_list') || 'null');
  const initSingle =
    (!loc.state?.list && loc.state) || JSON.parse(localStorage.getItem('recipe_result') || 'null');

  const [list, setList] = useState(Array.isArray(initList) ? initList : []);
  const [data, setData] = useState(!initList && initSingle ? initSingle : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adMap, setAdMap] = useState({});

  /* 찜 상태 */
  const [saved, setSaved] = useState(false);

  /* goals 보정 */
  useEffect(() => {
    if (data && !Array.isArray(data.goals)) {
      const lastReq = JSON.parse(localStorage.getItem('recipe_last_request') || 'null');
      if (lastReq?.goals) setData((prev) => ({ ...(prev || {}), goals: lastReq.goals }));
    }
  }, [data]);

  /* 찜 선조회 */
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!data || data.id == null) return;
      try {
        const favs = await listFavorites();
        if (!aborted) setSaved(isFavoriteIn(favs, data.id));
      } catch {
        if (!aborted) setSaved(false);
      }
    })();
    return () => { aborted = true; };
  }, [data]);

  /* 광고 로딩 */
  useEffect(() => {
    if (!data || !Array.isArray(data.ingredients_list)) return;
    const names = normalizeIngredients(data.ingredients_list);
    let aborted = false;
    (async () => {
      const res = await fetchAdsByIngredients(names);
      if (!aborted) setAdMap(res?.results || {});
    })();
    return () => { aborted = true; };
  }, [data]);

  const carouselItems = useMemo(() => {
    const arr = [];
    Object.values(adMap).forEach((items) => {
      if (Array.isArray(items) && items[0]) arr.push(items[0]);
    });
    return arr;
  }, [adMap]);

  const hasAnyResult = list.length > 0 || !!data;

  const onToggleWish = useCallback(async () => {
    if (!data || data.id == null) return;
    const rid = Number(data.id);
    if (!Number.isFinite(rid) || rid <= 0) {
      toast('유효하지 않은 레시피 ID입니다.', 'error');
      return;
    }
    // 낙관적 토글
    setSaved((v) => !v);
    try {
      if (saved) {
        await removeFavorite(rid);
        setSaved(false);
        toast('찜을 해제했어요.', 'success');
      } else {
        await addFavorite(data);
        setSaved(true);
        toast('저장했어요!', 'success');
      }
    } catch {
      // 실패 시 롤백
      setSaved((v) => !v);
      toast('찜하기에 실패했어요. 로그인 상태를 확인해 주세요.', 'error');
    }
  }, [data, saved, toast]);

  async function retrySameCondition() {
    const lastReq = JSON.parse(localStorage.getItem('recipe_last_request') || 'null');
    if (!lastReq) {
      setError('이전 요청 정보가 없어요. 입력 페이지에서 다시 시도해 주세요.');
      toast('이전 요청 정보가 없어요.', 'error');
      return;
    }
    try {
      setLoading(true);
      setError('');

      const served = JSON.parse(localStorage.getItem('served_ids') || '[]');
      const payload = { ...lastReq, excludeIds: served };

      const hadListBefore =
        Array.isArray(JSON.parse(localStorage.getItem('recipe_result_list') || 'null')) ||
        Array.isArray(loc.state?.list);

      if (hadListBefore) {
        const resList = await requestRecommendTop(payload, 3);
        localStorage.setItem('recipe_result_list', JSON.stringify(resList));
        const newly = resList.map((x) => x?.id).filter(Boolean);
        localStorage.setItem('served_ids', JSON.stringify(Array.from(new Set([...(served || []), ...newly]))));
        setList(resList);
        setData(null);
      } else {
        const res = await requestRecommend(payload);
        localStorage.setItem('recipe_result', JSON.stringify(res));
        if (res?.id) {
          localStorage.setItem('served_ids', JSON.stringify(Array.from(new Set([...(served || []), res.id]))));
        }
        setData(res);
        setList([]);
      }
      toast('새 추천을 불러왔어요.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || '추천을 다시 불러오지 못했습니다.';
      setError(msg);
      toast('추천을 다시 불러오지 못했어요.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!hasAnyResult) {
    return (
      <main className="container py-4">
        <h2 className="h4 fw-bold mb-2">결과 데이터가 없어요</h2>
        <p className="text-secondary mb-3">입력 페이지에서 다시 시도해 주세요.</p>
        <Link className="btn btn-success" to="/input">다시 입력하기</Link>
      </main>
    );
  }

  return (
    <>
      <main className="container-xxl py-4">
        {/* 리스트 모드 */}
        {list.length > 0 && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h4 fw-bold m-0">추천 레시피 (Top {list.length})</h2>
              <div className="d-none d-md-block text-secondary small">목표/요약/주요 영양을 간단히 보여줘요</div>
            </div>

            <div className="row g-3">
              {list.map((it, idx) => {
                const koreanGoals = toKoreanGoals(it.goals);
                return (
                  <div key={idx} className="col-12 col-md-6 col-lg-4">
                    <div className="card h-100 shadow-sm">
                      <div className="card-body d-grid gap-2">
                        <div className="d-flex align-items-start justify-content-between">
                          <h3 className="h6 fw-bold mb-0 flex-grow-1 pe-2 text-truncate">{it.title}</h3>
                          <span className="badge text-bg-light border">{it.cook_time_min}분</span>
                        </div>
                        {it.summary && <p className="small text-secondary mb-1">{it.summary}</p>}
                        {koreanGoals.length > 0 && (
                          <div className="d-flex flex-wrap gap-2">
                            {koreanGoals.map((g, i) => (
                              <span className="badge rounded-pill text-bg-success" key={`${g}-${i}`}>{g}</span>
                            ))}
                          </div>
                        )}
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          <span className="badge text-bg-light border">열량 {it.kcal} kcal</span>
                          <span className="badge text-bg-light border">단백질 {it.protein_g} g</span>
                          <span className="badge text-bg-light border">탄수 {it.carbs_g} g</span>
                        </div>
                        <ul className="small mb-0 mt-1 ps-3">
                          {(it.ingredients_list || []).slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
                          {(it.ingredients_list || []).length > 4 && <li>…</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 단일 모드 */}
        {data && (
          <>
            {/* 타이틀 */}
            <div className="mb-2">
              <h1 className="h4 fw-bold mb-1">{data.title}</h1>
              {data.summary && <p className="text-secondary mb-0">{data.summary}</p>}
            </div>

            {/* 목표 배지 */}
            {toKoreanGoals(data.goals).length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {toKoreanGoals(data.goals).map((g, i) => (
                  <span className="badge rounded-pill text-bg-success" key={`${g}-${i}`}>{g}</span>
                ))}
              </div>
            )}

            {/* 읽기 쉬운 예상 영양 */}
            <NutritionTiles data={data} />

            {/* 재료 */}
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <div className="fw-semibold mb-2">재료</div>
                <ul className="mb-0 ps-3">
                  {(data.ingredients_list || []).map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            </div>

            {/* 추천 상품 캐러셀 */}
            {(() => {
              const names = normalizeIngredients(data.ingredients_list || []);
              const items = names.flatMap((n) => (adMap[n] || []).slice(0, 1));
              if (!items.length) return null;
              return (
                <div className="card shadow-sm mb-3">
                  <div className="card-body">
                    <div className="fw-semibold mb-2">추천 상품</div>
                    <AdCarouselMulti items={items} interval={2500} />
                    <p className="text-secondary small mt-2 mb-0">
                      * 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 만드는 법 */}
            <div className="card shadow-sm mb-5">
              <div className="card-body">
                <div className="fw-semibold mb-2">만드는 법</div>
                <ol className="mb-0 ps-3">
                  {(data.steps || []).map((x, i) => <li key={i}>{x}</li>)}
                </ol>
                {data.tips && <p className="text-secondary small mt-2 mb-0">Tip. {data.tips}</p>}
              </div>
            </div>

            {/* 하단 고정 액션바 */}
            <StickyActionBar
              visible={!!data}
              saved={saved}
              onToggle={onToggleWish}
              onRetry={retrySameCondition}
            />
          </>
        )}

        {/* 전체 로딩 오버레이 */}
        {loading && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{ background: 'rgba(255,255,255,0.6)', zIndex: 1080, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <div className="spinner-border" role="status" />
          </div>
        )}

        {/* 모바일 하단 네비 */}
        <div className="d-md-none">
          <BottomNav />
        </div>

        {/* 에러 메세지(보조) */}
        {error && (
          <div className="container-xxl">
            <div className="alert alert-danger mt-3" role="alert">{error}</div>
          </div>
        )}
      </main>

      {/* 토스트 */}
      <Toasts />
    </>
  );
}