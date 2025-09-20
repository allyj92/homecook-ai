// src/lib/bookmarks.js
// 북마크 저장/삭제/조회 (레거시 호환 + uid 네임스페이스 동시 기록)

function resolveUid() {
  try {
    const auth = JSON.parse(localStorage.getItem('authUser') || 'null');
    return auth?.uid ?? auth?.id ?? auth?.userId ?? auth?.user_id ?? null;
  } catch { return null; }
}

function bmKey(uid, id) { return `postBookmark:${uid}:${id}`; }
function bmDataKey(uid, id) { return `postBookmarkData:${uid}:${id}`; }

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

  try {
    // 1) 새 포맷(계정 네임스페이스)
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '1');
      localStorage.setItem(bmDataKey(uid, id), JSON.stringify(meta));
    }
    // 2) 레거시 포맷도 함께 기록 (MyPage가 즉시 흡수)
    localStorage.setItem(`postBookmark:${id}`, '1');
    localStorage.setItem(`postBookmarkData:${id}`, JSON.stringify(meta));
  } catch {}
  return true;
}

export function removeBookmark(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '0');
      localStorage.removeItem(bmDataKey(uid, id));
    }
    localStorage.setItem(`postBookmark:${id}`, '0');
    localStorage.removeItem(`postBookmarkData:${id}`);
  } catch {}
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

// 같은 탭에서 즉시 반영이 필요하면 수동 갱신 훅(선택)
export function notifyBookmarkChanged() {
  // storage 이벤트는 같은 탭에선 안 뜨므로, 커스텀 이벤트 브로드캐스트
  try {
    window.dispatchEvent(new Event('bookmark-changed'));
  } catch {}
}