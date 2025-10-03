import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { getMyPosts } from '../api/community';
import SmartThumb from '../components/SmartThumb';

export default function MyPostsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const posts = await getMyPosts(50);
        setList(posts || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container-xxl py-3">
      <h1 className="h4 fw-bold mb-3">내가 쓴 글</h1>

      {loading ? (
        <div>불러오는 중…</div>
      ) : list.length === 0 ? (
        <div className="p-4 text-center text-secondary">아직 작성한 글이 없어요.</div>
      ) : (
        <div className="list-group list-group-flush">
          {list.map((p) => (
            <Link key={p.id} to={`/community/${p.id}`} className="list-group-item list-group-item-action">
              <div className="d-flex align-items-center gap-3">
                <SmartThumb src={p.repImageUrl} seed={`mypost-${p.id}`} />
                <div className="flex-grow-1">{p.title}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}