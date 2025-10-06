// src/lib/bookmarks.js
// 북마크 저장/삭제/조회 (로컬 즉시반영 + 서버 동기화)
// 서버 동기화 엔드포인트: BookmarkController (/api/community/bookmarks/{postId})

/* ---------------- 공통 유틸 ---------------- */
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
// PUT /api/community/bookmarks/{postId}
async function syncServerAddBookmark(idNumber) {
  try {
    const res = await fetch(`/api/community/bookmarks/${Number(idNumber)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`bookmark_add_${res.status}`);
  } catch (_e) {
    // 서버 동기화 실패해도 로컬 상태는 유지 (필요시 재시도 큐 도입 가능)
  }
}

// DELETE /api/community/bookmarks/{postId}
async function syncServerRemoveBookmark(idNumber) {
  try {
    const res = await fetch(`/api/community/bookmarks/${Number(idNumber)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`bookmark_del_${res.status}`);
  } catch (_e) {
    // 동기화 실패 무시 (UI 유지)
  }
}

/* ---------------- 퍼블릭 API ---------------- */
/**
 * 게시글 북마크 추가
 * - 로컬(localStorage) 즉시 반영
 * - 서버 동기화는 비동기(Fire-and-forget)
 */
export function addBookmark(post, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  const id = String(post?.id ?? post?.postId ?? post?.post_id);
  if (!id) return false;

  const meta = {
    id: Number(id),
    title: post?.title ?? '',
    category: post?.category ?? '',
    createdAt: post?.createdAt ?? post?.created_at ?? null,
    updatedAt:
      post?.updatedAt ??
      post?.updated_at ??
      post?.createdAt ??
      post?.created_at ??
      null,
    repImageUrl: post?.repImageUrl ?? post?.rep_image_url ?? null,
    youtubeId: post?.youtubeId ?? post?.youtube_id ?? null,
  };

  // 1) 로컬 즉시 반영 (계정 네임스페이스 + 레거시 동시 기록)
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '1');
      localStorage.setItem(bmDataKey(uid, id), JSON.stringify(meta));
    }
    localStorage.setItem(`postBookmark:${id}`, '1'); // 레거시
    localStorage.setItem(`postBookmarkData:${id}`, JSON.stringify(meta));
  } catch {
    // localStorage 접근 실패는 무시
  }

  // 2) 서버 동기화 (비동기)
  void syncServerAddBookmark(Number(id));

  // 3) 같은 탭 강제 갱신 이벤트
  notifyBookmarkChanged();
  return true;
}

/**
 * 게시글 북마크 제거
 * - 로컬(localStorage) 즉시 반영
 * - 서버 동기화는 비동기(Fire-and-forget)
 */
export function removeBookmark(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);

  // 1) 로컬 즉시 반영 (계정 네임스페이스 + 레거시 정리)
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '0');
      localStorage.removeItem(bmDataKey(uid, id));
    }
    localStorage.setItem(`postBookmark:${id}`, '0'); // 레거시
    localStorage.removeItem(`postBookmarkData:${id}`);
  } catch {
    // localStorage 접근 실패는 무시
  }

  // 2) 서버 동기화 (비동기)
  void syncServerRemoveBookmark(Number(id));

  // 3) 같은 탭 강제 갱신 이벤트
  notifyBookmarkChanged();
  return true;
}

/**
 * 북마크 여부 (로컬 기준 즉시 판정)
 * - 서버 동기화 지연과 무관하게 즉시 UI 반영
 */
export function isBookmarked(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);
  try {
    if (uid && localStorage.getItem(bmKey(uid, id)) === '1') return true;
    if (localStorage.getItem(`postBookmark:${id}`) === '1') return true; // 레거시
  } catch {
    // ignore
  }
  return false;
}

/**
 * 같은 탭에서도 즉시 반영되도록 커스텀 이벤트 브로드캐스트
 * - 'storage' 이벤트는 같은 탭에선 발생하지 않음
 */
export function notifyBookmarkChanged() {
  try {
    window.dispatchEvent(new Event('bookmark-changed'));
  } catch {
    // ignore
  }
}
