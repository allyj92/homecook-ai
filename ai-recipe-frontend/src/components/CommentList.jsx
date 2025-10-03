import { useEffect, useState } from 'react';
import { listComments } from '../api/comments';
import CommentItem from './CommentItem';

export default function CommentList({ postId, me }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const size = 20;

  async function loadMore(first=false) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await listComments(postId, { after: first ? null : cursor, size });
      setItems(first ? res.items : [...items, ...res.items]);
      setCursor(res.nextCursor || null);
      setHasMore(!!res.nextCursor);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ loadMore(true); /* eslint-disable-next-line */ }, [postId]);

  return (
    <div className="mt-3">
      {items.map(c => (
        <CommentItem
          key={c.id}
          c={c}
          canEdit={me && String(me.uid) === String(c.authorId)}
          onUpdated={(next)=>setItems(xs=>xs.map(x=>x.id===next.id?next:x))}
          onDeleted={(id)=>setItems(xs=>xs.map(x=>x.id===id?{...x, deleted:true, content:''}:x))}
        />
      ))}
      <div className="text-center my-2">
        <button className="btn btn-outline-secondary" disabled={loading || !hasMore} onClick={()=>loadMore(false)}>
          {loading ? '불러오는 중…' : hasMore ? '더 보기' : '더 이상 없음'}
        </button>
      </div>
    </div>
  );
}