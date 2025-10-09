// src/components/CommentList.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchComments } from '../api/community'; // ✅ 변경: 새로운 API
import CommentItem from './CommentItem';

export default function CommentList({ postId, me }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const size = 20;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const isAdmin = !!me?.roles?.includes?.('ADMIN');

  const loadMore = useCallback(async (first = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await fetchComments(postId, { cursor: first ? null : cursor, size }); // ✅ after -> cursor
      setItems(prev => (first ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor ?? null);
      setHasMore(!!data.nextCursor);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [postId, cursor, size, loading]);

  // postId 바뀌면 초기 로드
  useEffect(() => { 
    setItems([]);
    setCursor(null);
    setHasMore(true);
    loadMore(true);
  }, [postId, loadMore]);

  // 작성자/관리자만 편집/삭제 허용
  const canEdit = (c) =>
    !!me &&
    (String(me.uid) === String(c.authorId) ||
     (!!c.authorEmail && c.authorEmail === me.email) ||
     isAdmin);

  return (
    <div className="mt-3">
      {items.map((c) => (
        <CommentItem
          key={c.id}
          c={c}
          canEdit={canEdit(c)}
          onUpdated={(next) => setItems(xs => xs.map(x => x.id === next.id ? next : x))}
          onDeleted={(id) =>
            setItems(xs => xs.map(x => x.id === id ? { ...x, deleted: true, content: '' } : x))
          }
        />
      ))}

      <div className="text-center my-2">
        <button
          className="btn btn-outline-secondary"
          disabled={loading || !hasMore}
          onClick={() => loadMore(false)}
          aria-busy={loading ? 'true' : 'false'}
        >
          {loading ? '불러오는 중…' : hasMore ? '더 보기' : '더 이상 없음'}
        </button>
      </div>
    </div>
  );
}