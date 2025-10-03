import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { loadBookmarksFromLS } from '../lib/bookmarkUtils'; // MyPage에서 쓰던 함수 빼서 utils로 두는게 좋아요
import SmartThumb from '../components/SmartThumb';

export default function BookmarksPage() {
  const [list, setList] = useState([]);

  useEffect(() => {
    // uid, provider 가져오기 필요 (me API 호출해서)
    const me = JSON.parse(localStorage.getItem('authUser') || '{}');
    if (me?.uid && me?.provider) {
      setList(loadBookmarksFromLS(me.uid, me.provider));
    }
  }, []);

  return (
    <div className="container-xxl py-3">
      <h1 className="h4 fw-bold mb-3">북마크한 글</h1>
      {list.length === 0 ? (
        <div className="p-4 text-center text-secondary">북마크한 글이 없어요.</div>
      ) : (
        <div className="list-group list-group-flush">
          {list.map((b) => (
            <Link key={b.id} to={`/community/${b.id}`} className="list-group-item list-group-item-action">
              <div className="d-flex align-items-center gap-3">
                <SmartThumb src={b.repImageUrl} seed={`bm-${b.id}`} />
                <div className="flex-grow-1">{b.title || `게시글 #${b.id}`}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <BottomNav />
    </div>
  );
}