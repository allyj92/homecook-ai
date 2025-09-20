import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ensureLogin } from '../lib/auth'; // ✅ 경로 수정
import 'bootstrap/dist/css/bootstrap.min.css';
import BottomNav from '../components/BottomNav';
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
              onClick={(e) => { e.preventDefault(); onOpen?.(); }}
            >
              {post.title}
            </a>
          </div>
          <div className="text-secondary small d-inline-flex gap-2">
            {/* 백엔드에 author 표시 필드 없으면 숨겨짐 */}
            {post.author && <span>{post.author}</span>}
            {post.author && <span>·</span>}
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {post.content && (
          <p className="text-body-secondary small mb-2 mt-2">
            {post.content.length > 80 ? post.content.slice(0, 80) + '…' : post.content}
          </p>
        )}

        <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
          <div className="d-flex flex-wrap gap-2">
            {(post.tags || []).map((t) => (
              <span key={t} className="badge rounded-pill bg-light text-dark border">#{t}</span>
            ))}
          </div>
        </div>
      </div>
      {post.repImageUrl && (
        <img src={post.repImageUrl} alt="" className="card-img-bottom" />
      )}
    </article>
  );
}

export default function CommunityPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [tab, setTab] = useState(params.get('tab') ?? 'all');
  const [sort, setSort] = useState(params.get('sort') ?? 'new'); // ✅ 서버 기준은 최신순

  // 서버 데이터 상태
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const size = 12;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 탭→카테고리 매핑
  const tabToCategory = (t) => {
    if (t === 'question') return '질문';
    if (t === 'review') return '후기';
    if (t === 'recipe') return '레시피';
    return ''; // all/popular은 전체
  };

  async function load(pageToLoad = 0, tabToLoad = tab) {
    setLoading(true);
    try {
      const category = tabToCategory(tabToLoad);
      const qs = new URLSearchParams({
        page: String(pageToLoad),
        size: String(size),
        ...(category ? { category } : {}),
      });
      const res = await fetch(`/api/community/posts?${qs.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const list = await res.json();

      if (pageToLoad === 0) setPosts(list);
      else setPosts((prev) => [...prev, ...list]);

      setHasMore(list.length === size);
      setPage(pageToLoad);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // 최초 로드
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { load(0, tab); /* eslint-disable-next-line */ }, []);

  // 탭 변경 시 처음부터 다시 로드
  useEffect(() => {
    load(0, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 클라이언트 측 필터/정렬(서버는 최신순 반환)
  const filtered = useMemo(() => {
    let arr = posts;

    if (q) {
      const k = q.toLowerCase();
      arr = arr.filter((p) =>
        [p.title, p.content, ...(p.tags || [])].join(' ').toLowerCase().includes(k)
      );
    }

    // 정렬: 서버는 최신순. 다른 정렬은 클라에서 임시 처리(필드가 없으면 no-op)
    if (sort === 'new') {
      arr = [...arr].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    // 'views', 'hot'은 백엔드에 필드가 없으므로 생략/유지
    return arr;
  }, [posts, q, sort]);

  function syncQuery(next = {}) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v == null ? merged.delete(k) : merged.set(k, String(v))));
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
                onChange={(e) => { setQ(e.target.value); syncQuery({ q: e.target.value }); }}
              />
              {q && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setQ(''); syncQuery({ q: null }); }}
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
              onChange={(e) => { setSort(e.target.value); syncQuery({ sort: e.target.value }); }}
              aria-label="정렬"
            >
              <option value="new">최신순</option>
              {/* <option value="views">조회순</option> */}
              {/* <option value="hot">인기순</option> */}
            </select>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={tab}
              onChange={(e) => { setTab(e.target.value); syncQuery({ tab: e.target.value }); }}
              aria-label="탭"
            >
              <option value="all">전체</option>
              {/* <option value="popular">인기</option>  // 백엔드 지표 없으면 비활성 */}
              <option value="question">질문</option>
              <option value="review">후기</option>
              <option value="recipe">레시피</option>
            </select>
          </div>

          <div className="col-12 col-lg-4 text-lg-end">
            <button
              className="btn btn-success"
              onClick={async () => {
                const user = await ensureLogin('/write');
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
                  <button
                    key={t}
                    className="badge rounded-pill bg-light text-dark border btn"
                    onClick={() => { setQ(t); syncQuery({ q: t }); }}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AdSlot id="ad-comm-side" height={600} label="Skyscraper 300×600" sticky />
        </aside>

        <section className="col-12 col-lg-9 order-lg-1">
          <AdSlot id="ad-comm-native" height={120} label="네이티브 인라인 (반응형)" />

          {filtered.length === 0 && !loading && (
            <div className="alert alert-secondary" role="status">
              게시글이 없습니다. 먼저 글을 작성해 보세요!
            </div>
          )}

          {filtered.map((p, i) => (
            <div key={p.id}>
              <PostCard
                post={p}
                onOpen={async () => {
                  const backTo = `/community/${p.id}`;
                  // 상세보기도 로그인 필요로 둘거면 유지, 아니면 navigate(backTo)만
                  const user = await ensureLogin(backTo);
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

          <div className="d-flex justify-content-center my-3">
            <button
              className="btn btn-outline-secondary"
              disabled={loading || !hasMore}
              onClick={() => load(page + 1, tab)}
            >
              {loading ? '불러오는 중…' : hasMore ? '더 불러오기' : '더 이상 없음'}
            </button>
          </div>
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