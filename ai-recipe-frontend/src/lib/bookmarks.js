// src/lib/bookmarks.js
// 북마크 저장/삭제/조회 (레거시 호환 + uid 네임스페이스 동시 기록)
// 백엔드 수정 없이 서버 동기화까지 수행하는 버전

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
// 백엔드 스펙: provider 없이도 수락 (컨트롤러 수정 없이 사용)
// POST /api/me/favorites  body: { recipeId: number, title?, image? }
async function syncServerAddFavorite(idNumber, meta) {
  try {
    const res = await fetch('/api/me/favorites', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipeId: Number(idNumber),        // 숫자 필수
        title: meta?.title || undefined,
        image: meta?.repImageUrl || undefined,
        // provider는 보내지 않음 (백엔드 무수정 전략)
      }),
    });
    if (!res.ok) throw new Error(`fav_add_${res.status}`);
  } catch (e) {
    // 서버 동기화 실패해도 로컬 상태로는 동작하게 유지
    // 필요하면 여기서 재시도/큐잉 로직을 붙일 수 있음
    // console.warn('[bookmark] server add failed', e);
  }
}

// DELETE /api/me/favorites/{id}
async function syncServerRemoveFavorite(idNumber) {
  try {
    const res = await fetch(`/api/me/favorites/${Number(idNumber)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`fav_del_${res.status}`);
  } catch (e) {
    // console.warn('[bookmark] server remove failed', e);
  }
}

/* ---------------- 퍼블릭 API ---------------- */
/**
 * 게시글 북마크 추가
 * - 로컬(localStorage) 즉시 반영
 * - 서버 동기화는 비동기 수행 (백엔드 무수정 사용)
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

  // 1) 로컬 즉시 반영 (새 포맷 + 레거시 동시 기록)
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '1');
      localStorage.setItem(bmDataKey(uid, id), JSON.stringify(meta));
    }
    localStorage.setItem(`postBookmark:${id}`, '1');
    localStorage.setItem(`postBookmarkData:${id}`, JSON.stringify(meta));
  } catch {
    // localStorage 접근 실패 무시
  }

  // 2) 서버 동기화 (await하지 않고 fire-and-forget)
  //    기존 호출부가 동기라고 가정해도 UI는 즉시 반영됨
  void syncServerAddFavorite(Number(id), meta);

  // 3) 같은 탭 강제 갱신 이벤트
  notifyBookmarkChanged();
  return true;
}

/**
 * 게시글 북마크 제거
 * - 로컬(localStorage) 즉시 반영
 * - 서버 동기화는 비동기 수행 (백엔드 무수정 사용)
 */
export function removeBookmark(id, _uid) {
  const uid = String(_uid ?? resolveUid() ?? '');
  id = String(id);

  // 1) 로컬 즉시 반영 (새 포맷 + 레거시 동시 기록)
  try {
    if (uid) {
      localStorage.setItem(bmKey(uid, id), '0');
      localStorage.removeItem(bmDataKey(uid, id));
    }
    localStorage.setItem(`postBookmark:${id}`, '0');
    localStorage.removeItem(`postBookmarkData:${id}`);
  } catch {
    // localStorage 접근 실패 무시
  }

  // 2) 서버 동기화 (fire-and-forget)
  void syncServerRemoveFavorite(Number(id));

  // 3) 같은 탭 강제 갱신 이벤트
  notifyBookmarkChanged();
  return true;
}

/**
 * 북마크 여부 (로컬 기준 즉시 판정)
 * - 서버 동기화 지연과 무관하게 즉시 UI 반영 가능
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
