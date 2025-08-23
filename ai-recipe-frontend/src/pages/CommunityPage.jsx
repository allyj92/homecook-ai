import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureLogin } from '../auth/ensureLogin'; // ✅ 경로 수정
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../compoments/BottomNav';
import '../index.css';

function AdSlot({ id, height = 250, label = 'AD', sticky = false }) {
  return (
    <div
      id={id}
      className={`adslot border border-dashed rounded-3 d-grid place-items-center text-uppercase text-secondary ${sticky ? 'adslot--sticky' : ''} my-3`}
      style={{ height }}
      role="complementary"
      aria-label={`${label} 광고영역`}
    >
      <span className="small">{label}</span>
    </div>
  );
}

function Badge({ children, tone = 'gray' }) {
  const map = {
    brand: 'text-bg-primary',
    line: 'bg-light text-dark border',
    gray: 'text-bg-secondary',
  };
  const cls = map[tone] || map.gray;
  return <span className={`badge rounded-pill ${cls}`}>{children}</span>;
}

function PostCard({ post, onOpen }) {
  return (
    <article className="card shadow-sm mb-3">
      <div className="card-body position-relative">
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {post.pinned && <Badge tone="brand">고정</Badge>}
            {post.category && <Badge tone="line">{post.category}</Badge>}
            <a
              href={`/community/${post.id}`}
              className="stretched-link text-decoration-none fw-bold h6 mb-0"
              onClick={(e) => {
                e.preventDefault();
                onOpen?.();
              }}
            >
              {post.title}
            </a>
          </div>
          <div className="text-secondary small d-inline-flex gap-2">
            <span>{post.author}</span>
            <span>·</span>
            <span>{post.timeAgo}</span>
          </div>
        </div>

        {post.snippet && (
          <p className="text-body-secondary small mb-2 mt-2">{post.snippet}</p>
        )}

        <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
          <div className="d-flex flex-wrap gap-2">
            {post.tags?.map((t) => (
              <a
                key={t}
                href="#"
                className="badge rounded-pill bg-light text-dark border position-relative"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                #{t}
              </a>
            ))}
          </div>
          <div className="text-secondary small d-inline-flex gap-3">
            <span>👍 {post.likes}</span>
            <span>💬 {post.comments}</span>
            <span>👀 {post.views}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CommunityPage() {
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [tab, setTab] = useState(params.get('tab') ?? 'all');
  const [sort, setSort] = useState(params.get('sort') ?? 'hot');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const posts = useMemo(
    () => [
      {
        id: 1,
        title: '저염 식단으로 한달 -3.8kg 후기 공유합니다!',
        author: 'haru',
        timeAgo: '2시간 전',
        likes: 128,
        comments: 34,
        views: 3120,
        tags: ['저염', '다이어트', '후기'],
        category: '후기',
        snippet: '염분 1800mg 이하로 유지하고 단백질 90g 챌린지를 했더니...',
        pinned: true,
      },
      {
        id: 2,
        title: '두부/곤약으로 탄단지 맞추는 간단한 공식',
        author: 'cooker',
        timeAgo: '어제',
        likes: 92,
        comments: 18,
        views: 2212,
        tags: ['두부', '곤약', '팁'],
        category: '노하우',
        snippet: '1식 기준 두부 150g + 달걀 2개만 있어도 단백질 30g 확보…',
      },
      {
        id: 3,
        title: '운동 후 저염 고단백 국물요리 뭐가 좋을까요?',
        author: 'june',
        timeAgo: '1일 전',
        likes: 41,
        comments: 53,
        views: 1870,
        tags: ['질문', '국물', '고단백'],
        category: '질문',
      },
      {
        id: 4,
        title: '에어프라이어로 소금 적게 쓰는 닭다리 구이',
        author: 'mora',
        timeAgo: '3일 전',
        likes: 66,
        comments: 12,
        views: 1420,
        tags: ['에어프라이어', '레시피'],
        category: '레시피',
        snippet: '간장 대신 표고 불린 물과 마늘-후추로 향을…',
      },
      {
        id: 5,
        title: '식자재 공동구매(저염 간장/타마리) 참여하실 분?',
        author: 'neo',
        timeAgo: '4일 전',
        likes: 24,
        comments: 40,
        views: 990,
        tags: ['공구', '저염간장'],
        category: '자유',
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    let arr = posts;
    if (q) {
      const k = q.toLowerCase();
      arr = arr.filter((p) =>
        (p.title + (p.snippet || '') + (p.tags || []).join(' '))
          .toLowerCase()
          .includes(k)
      );
    }
    if (tab !== 'all') {
      arr = arr.filter((p) => {
        if (tab === 'popular') return p.likes > 50 || p.comments > 20 || p.views > 1500;
        if (tab === 'question') return p.category === '질문';
        if (tab === 'review') return p.category === '후기';
        if (tab === 'recipe') return p.category === '레시피';
        return true;
      });
    }
    if (sort === 'hot')
      arr = [...arr].sort(
        (a, b) =>
          b.likes * 3 +
          b.comments * 4 +
          b.views * 0.2 -
          (a.likes * 3 + a.comments * 4 + a.views * 0.2)
      );
    if (sort === 'views') arr = [...arr].sort((a, b) => b.views - a.views);
    return arr;
  }, [posts, q, tab, sort]);

  function syncQuery(next = {}) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) =>
      v == null ? merged.delete(k) : merged.set(k, String(v))
    );
    setParams(merged, { replace: true });
  }

  return (
    <div className="container-xxl py-3">
      <AdSlot id="ad-comm-top" height={90} label="Top Banner (728/970×90)" />

      <header className="mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-4">
            <div className="input-group">
              <input
                className="form-control"
                placeholder="검색: 제목, 태그, 내용…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  syncQuery({ q: e.target.value });
                }}
              />
              {q && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setQ('');
                    syncQuery({ q: null });
                  }}
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                syncQuery({ sort: e.target.value });
              }}
              aria-label="정렬"
            >
              <option value="hot">인기순</option>
              <option value="new">최신순</option>
              <option value="views">조회순</option>
            </select>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={tab}
              onChange={(e) => {
                setTab(e.target.value);
                syncQuery({ tab: e.target.value });
              }}
              aria-label="탭"
            >
              <option value="all">전체</option>
              <option value="popular">인기</option>
              <option value="question">질문</option>
              <option value="review">후기</option>
              <option value="recipe">레시피</option>
            </select>
          </div>

          <div className="col-12 col-lg-4 text-lg-end">
            <button
              className="btn btn-success"
              onClick={async () => {
                const user = await ensureLogin('/write'); // ✅ 로그인 페이지로 유도
                if (user) navigate('/write');
              }}
            >
              글쓰기
            </button>
          </div>
        </div>
      </header>

      <main className="row g-4">
        <aside className="col-12 col-lg-3 order-lg-2">
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title h6 text-secondary fw-semibold">인기 태그</h5>
              <div className="d-flex flex-wrap gap-2">
                {['저염', '다이어트', '레시피', '질문', '후기', '에어프라이어', '닭가슴살', '곤약'].map((t) => (
                  <a
                    key={t}
                    href="#"
                    className="badge rounded-pill bg-light text-dark border"
                    onClick={(e) => {
                      e.preventDefault();
                      setQ(t);
                      syncQuery({ q: t });
                    }}
                  >
                    #{t}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <AdSlot id="ad-comm-side" height={600} label="Skyscraper 300×600" sticky />
        </aside>

        <section className="col-12 col-lg-9 order-lg-1">
          <AdSlot id="ad-comm-native" height={120} label="네이티브 인라인 (반응형)" />

          {filtered.length === 0 && (
            <div className="alert alert-secondary" role="status">
              검색 결과가 없어요. 다른 키워드를 시도해 보세요.
            </div>
          )}

          {filtered.map((p, i) => (
            <div key={p.id}>
              <PostCard
                post={p}
                onOpen={async () => {
                  const backTo = `/community/${p.id}`;
                  const user = await ensureLogin(backTo); // ✅ 로그인 페이지로 유도
                  if (user) navigate(backTo);
                }}
              />
              {(i + 1) % 3 === 0 && (
                <div className="card shadow-sm my-3">
                  <div className="card-body">
                    <AdSlot id={`ad-infeed-${i}`} height={250} label="In-Feed 336×280 / 반응형" />
                  </div>
                </div>
              )}
            </div>
          ))}

          <nav className="d-flex justify-content-center my-3" aria-label="페이지 이동">
            <ul className="pagination">
              <li className="page-item disabled">
                <span className="page-link">이전</span>
              </li>
              <li className="page-item active">
                <span className="page-link">1</span>
              </li>
              <li className="page-item">
                <a className="page-link" href="#">
                  2
                </a>
              </li>
              <li className="page-item">
                <a className="page-link" href="#">
                  3
                </a>
              </li>
              <li className="page-item">
                <span className="page-link">…</span>
              </li>
              <li className="page-item">
                <a className="page-link" href="#">
                  10
                </a>
              </li>
              <li className="page-item">
                <a className="page-link" href="#">
                  다음
                </a>
              </li>
            </ul>
          </nav>
        </section>
      </main>

      <footer className="text-center text-secondary mt-4">
        <div className="small">
          * 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        </div>
        <div className="small">© {new Date().getFullYear()} RecipFree</div>
      </footer>

      <BottomNav />
    </div>
  );
}
