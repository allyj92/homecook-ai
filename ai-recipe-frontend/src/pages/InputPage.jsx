// src/pages/InputPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestRecommend } from '../api'; // 백엔드 연동. 아직이면 주석의 mock 참고
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../compoments/BottomNav';

export default function InputPage() {
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [selectedGoals, setSelectedGoals] = useState([]); // 다중 선택
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const GOALS = [
    { id: 'diet',        title: '다이어트',    desc: '칼로리 낮게',        icon: '🥗' },
    { id: 'low_sodium',  title: '저염',        desc: '소금 줄이기',        icon: '🧂' },
    { id: 'low_sugar',   title: '저당',        desc: '당분 줄이기',        icon: '🍏' },
    { id: 'highProtein', title: '고단백',      desc: '단백질 중심',        icon: '💪' },
    { id: 'bulk',        title: '벌크업',      desc: '고칼로리+단백질',    icon: '🥩' },
    { id: 'vegan',       title: '비건',        desc: '식물성 재료만',      icon: '🌱' },
    { id: 'glutenFree',  title: '글루텐 프리', desc: '글루텐 제외',        icon: '🚫🌾' },
    { id: 'quick',       title: '15분 이내',   desc: '빠른 조리',          icon: '⏱️' },
  ];

  const onChangeNumber = (setter) => (e) => {
    const v = e.target.value;
    if (v === '') return setter('');
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return;
    setter(v);
  };

  function toggleGoal(id) {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    // ✅ 클라이언트 검증
    if (!heightCm || Number(heightCm) < 100 || Number(heightCm) > 230) {
      setError('키를 100~230 사이로 입력해 주세요.');
      return;
    }
    if (!weightKg || Number(weightKg) < 30 || Number(weightKg) > 250) {
      setError('몸무게를 30~250 사이로 입력해 주세요.');
      return;
    }
    if (!ingredients || !ingredients.trim()) {
      setError('재료를 입력해 주세요.');
      return;
    }
    if (selectedGoals.length === 0) {
      setError('목표를 1개 이상 선택해 주세요.');
      return;
    }

    // 새 조건 시작할 때, '이미 본 레시피 ID' 초기화
    localStorage.removeItem('served_ids');

    setLoading(true);
    setError('');
    const payload = {
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      ingredients,
      goals: selectedGoals,
    };

    try {
      const res = await requestRecommend(payload);
      localStorage.setItem('recipe_result', JSON.stringify(res));
      localStorage.setItem('recipe_last_request', JSON.stringify(payload));

      // 첫 응답 id -> served_ids 누적
      if (res?.id) {
        const served = JSON.parse(localStorage.getItem('served_ids') || '[]');
        localStorage.setItem(
          'served_ids',
          JSON.stringify(Array.from(new Set([...(served || []), res.id])))
        );
      }

      nav('/result', { state: res });
    } catch (e) {
      console.error('AXIOS ERROR:', e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        '추천을 불러오지 못했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const invalidHeight = heightCm !== '' && (Number(heightCm) < 100 || Number(heightCm) > 230);
  const invalidWeight = weightKg !== '' && (Number(weightKg) < 30 || Number(weightKg) > 250);

  return (
    <main className="container-xxl py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xl-10">
          {/* 헤더 */}
          <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap">
            <h2 className="h4 fw-bold m-0">입력 페이지</h2>
            {selectedGoals.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mt-2 mt-sm-0">
                {selectedGoals.map((id) => {
                  const g = GOALS.find((x) => x.id === id);
                  return (
                    <span key={id} className="badge rounded-pill text-bg-success">
                      {g?.icon} {g?.title || id}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* 입력 카드 */}
          <div className="card shadow-sm">
            <div className="card-body">
              {/* 키/몸무게 */}
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="height" className="form-label">키 (cm)</label>
                  <input
                    id="height"
                    className={`form-control ${invalidHeight ? 'is-invalid' : ''}`}
                    type="number"
                    inputMode="decimal"
                    placeholder="예: 170"
                    value={heightCm}
                    onChange={onChangeNumber(setHeightCm)}
                    min="0"
                    step="0.1"
                  />
                  <div className="form-text">예: 170 또는 170.5</div>
                  {invalidHeight && (
                    <div className="invalid-feedback">일반 범위(100~230cm) 밖이에요.</div>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label htmlFor="weight" className="form-label">몸무게 (kg)</label>
                  <input
                    id="weight"
                    className={`form-control ${invalidWeight ? 'is-invalid' : ''}`}
                    type="number"
                    inputMode="decimal"
                    placeholder="예: 60"
                    value={weightKg}
                    onChange={onChangeNumber(setWeightKg)}
                    min="0"
                    step="0.1"
                  />
                  <div className="form-text">예: 60 또는 60.5</div>
                  {invalidWeight && (
                    <div className="invalid-feedback">일반 범위(30~250kg) 밖이에요.</div>
                  )}
                </div>
              </div>

              {/* 재료 */}
              <div className="mt-4">
                <label htmlFor="ingredients" className="form-label">냉장고 속 재료</label>
                <input
                  id="ingredients"
                  className="form-control"
                  type="text"
                  placeholder="예: 닭가슴살, 파프리카, 두부"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                />
                <div className="form-text">여러 재료는 쉼표(,)로 구분해주세요.</div>
                <div className="small text-muted mt-1">
                  💡 냉장고에 있는 재료를 입력해도 좋고, 지금 요리에 <strong>사용하고 싶은 재료</strong>를 입력해도 괜찮아요.
                </div>
              </div>

              {/* 목표: 8개 카드 + 다중 선택 */}
              <div className="mt-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label m-0">목표 설정</label>
                  <span className="text-secondary small">(최소 1개 선택)</span>
                </div>

                <div className="row g-3">
                  {GOALS.map((g) => {
                    const active = selectedGoals.includes(g.id);
                    return (
                      <div className="col-6 col-md-4 col-xl-3" key={g.id}>
                        <button
                          type="button"
                          className={`w-100 btn ${active ? 'btn-success' : 'btn-outline-secondary'} text-start py-3`}
                          aria-pressed={active}
                          onClick={() => toggleGoal(g.id)}
                        >
                          <div className="d-flex align-items-start gap-2">
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{g.icon}</span>
                            <div>
                              <div className="fw-semibold">{g.title}</div>
                              <div className="small text-secondary">{g.desc}</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 에러 */}
              {error && (
                <div className="alert alert-danger mt-4" role="alert">
                  {error}
                </div>
              )}

              {/* 버튼 */}
              <div className="d-grid d-sm-flex justify-content-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-success px-4"
                  onClick={handleSubmit}
                  disabled={loading || selectedGoals.length === 0}
                >
                  {loading && (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  )}
                  {loading ? '추천 생성 중…' : '레시피 추천받기'}
                </button>
              </div>
            </div>
          </div>

          {/* 로딩 전용 오버레이(선택) */}
          {loading && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{ background: 'rgba(255,255,255,0.6)', zIndex: 1080, pointerEvents: 'none' }}
              aria-hidden="true"
            >
              <div className="spinner-border" role="status" />
            </div>
          )}
        </div>
      </div>

      {/* ===== 하단 광고 배너 (풀블리드) ===== */}
      <section
        className="container-fluid px-0 mt-4"
        role="complementary"
        aria-label="입력 페이지 하단 광고 배너"
      >
        <div className="bg-body-tertiary border-top border-bottom">
          <div
            className="container-xxl d-flex align-items-center justify-content-center"
            style={{ minHeight: 140 }}
          >
            {/* 여기에 추후 광고 스크립트/임베드 교체 */}
            <span className="small text-secondary">
              In-Feed / Native Ad (Responsive)
            </span>
          </div>
        </div>
      </section>

      {/* 모바일 하단 네비 */}
      <BottomNav />
    </main>
  );
}
