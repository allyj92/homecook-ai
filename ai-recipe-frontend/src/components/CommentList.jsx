// src/components/CommentList.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchComments } from '../api/community';
import CommentItem from './CommentItem';

export default function CommentList({ postId, me }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // 로딩을 ref로 관리해서 의존성 루프 차단
  const loadingRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const abortRef = useRef(null);

  const isAdmin = !!me?.roles?.includes?.('ADMIN');

  const loadMore = useCallback(async (first = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    // 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (first) {
      setInitialLoading(true);
      setHasMore(true);
      setCursor(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await fetchComments(postId, {
        cursor: first ? null : cursor,
        size: 20,
        signal: ac.signal, // fetchComments가 signal 받도록 했으면 전달, 아니면 제거
      });
      setItems(prev => (first ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor ?? null);
      setHasMore(!!data.nextCursor);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.warn('comment load failed', e);
      }
    } finally {
      loadingRef.current = false;
      if (first) setInitialLoading(false);
      else setLoadingMore(false);
    }
  // ⚠️ loading을 deps에서 빼는 게 핵심! cursor, postId만 의존
  }, [postId, cursor]);

  // postId 바뀌면 초기 로드(그리고 이전 요청 취소)
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    loadMore(true);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [postId, loadMore]);

  const canEdit = (c) =>
    !!me &&
    (String(me.uid) === String(c.authorId) ||
      (!!c.authorEmail && c.authorEmail === me.email) ||
      isAdmin);

  return (
    <div className="mt-3">
      {initialLoading && (
        <div className="text-secondary small">댓글 불러오는 중…</div>
      )}

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
          disabled={loadingRef.current || !hasMore}
          onClick={() => loadMore(false)}
          aria-busy={loadingRef.current ? 'true' : 'false'}
        >
          {loadingMore ? '불러오는 중…' : hasMore ? '더 보기' : '더 이상 없음'}
        </button>
      </div>
    </div>
  );
}
