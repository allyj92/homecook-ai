// src/lib/bookmarks.js
// 북마크 저장/삭제/조회 (로컬 즉시반영 + 서버 동기화)
// 서버 엔드포인트: /api/community/bookmarks/{postId}

function resolveUid() {
  try {
    const auth = JSON.parse(localStorage.getItem('authUser') || 'null');
    return auth?.uid ?? auth?.id ?? auth?.userId ?? auth?.user_id ?? null;
  } catch {
    return null;
  }
}

function bmKey(uid, id) { return `postBookmark:${uid}:${id}`; }
function bmDataKey(uid, id) { return `postBookmarkData:${uid}:${id}`; }

/* ---------------- 서버 동기화 ---------------- */
// PUT /api/community/bookmarks/{postId}  (본문 없음)
async function syncServerAddBookmark(idNumber) {
  try {
    const res = await fetch(`/api/community/bookmarks/${Number(idNumber)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`bookmark_add_${res.status}`);
  } catch (_) {
    // 실패해도 로컬 상태 유지
  }
}

// DELETE /api/community/bookmarks/{postId}  (본문 없음)
async function syncServerRemoveBookmark(idNumber) {
  try {
    const res = await fetch(`/api/community/bookmarks/${Number(idNumber)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`bookmark_del_${res.status}`);
  } catch (_) {
    // 실패해도 로컬 상태 유지
  }
}

/* (선택) 서버에서 내가 북마크한 글 목록 받기 */
export async function fetchBookmarkedPosts(page = 0, size = 20) {
  const url = `/api/community/bookmarks?page=${page}&size=${size}`;
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`bookmark_list_${res.status}`);
  return res.json(); // Spring Page<CommunityPost>
}

/* ---------------- 퍼블릭 API (로컬 + 서버 동기) ---------------- */
export function addBookmark(post, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  const id = String(post?.id ?? post?.postId ?? post?.post_id);
  if (!id) return false;

  const meta = {
    id: Number(id),
    title: post?.title ?? '',
    category: post?.category ?? '',
    createdAt: post?.createdAt ?? post?.created_at ?? null,
    updatedAt: post?.updatedAt ?? post?.updated_at ?? post?.createdAt ?? post?.created_at ?? null,
    repImageUrl: post?.repImageUrl ?? post?.rep_image_url ?? null,
    youtubeId: post?.youtubeId ?? post?.youtube_id ?? null,
  };

  // 1) 로컬 즉시 반영 (네임스페이스 + 레거시)
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '1');
      localStorage.setItem(bmDataKey(uid, id), JSON.stringify(meta));
    }
    localStorage.setItem(`postBookmark:${id}`, '1'); // 레거시
    localStorage.setItem(`postBookmarkData:${id}`, JSON.stringify(meta));
  } catch {}

  // 2) 서버 동기화(F/F)
  void syncServerAddBookmark(Number(id));

  // 3) 같은 탭 즉시 갱신
  notifyBookmarkChanged();
  return true;
}

export function removeBookmark(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);

  // 1) 로컬 즉시 반영
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '0');
      localStorage.removeItem(bmDataKey(uid, id));
    }
    localStorage.setItem(`postBookmark:${id}`, '0'); // 레거시
    localStorage.removeItem(`postBookmarkData:${id}`);
  } catch {}

  // 2) 서버 동기화(F/F)
  void syncServerRemoveBookmark(Number(id));

  // 3) 같은 탭 즉시 갱신
  notifyBookmarkChanged();
  return true;
}

export function isBookmarked(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);
  try {
    if (uid && localStorage.getItem(bmKey(uid, id)) === '1') return true;
    if (localStorage.getItem(`postBookmark:${id}`) === '1') return true; // 레거시
  } catch {}
  return false;
}

export function notifyBookmarkChanged() {
  try { window.dispatchEvent(new Event('bookmark-changed')); } catch {}
}
