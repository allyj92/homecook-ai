// src/lib/wishlist.js
// 프론트 → 백엔드 즐겨찾기(Favorites) API 모듈

// Netlify/로컬 모두에서 동작하도록 백엔드 베이스 URL 사용
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''; // 예) https://recipfree.com

function api(path) {
  return `${BACKEND_URL}${path}`;
}

function toRecipeId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`유효하지 않은 recipeId: ${value}`);
  }
  return n;
}

/** 찜 목록 조회 (GET /api/me/favorites) */
export async function listFavorites() {
  const res = await fetch(api('/api/me/favorites'), {
    credentials: 'include',
  });
  if (!res.ok) {
    // 401이면 로그인 필요
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 목록 조회 실패');
  }
  // [{ id, recipeId, createdAt }, ...]
  return res.json();
}

/** 찜 추가 (POST /api/me/favorites/{recipeId}) */
export async function addFavorite(recipeId) {
  const rid = toRecipeId(recipeId);
  const res = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 추가 실패');
  }
  // { id, recipeId, createdAt }
  return res.json();
}

/** 찜 해제 (DELETE /api/me/favorites/{recipeId}) */
export async function removeFavorite(recipeId) {
  const rid = toRecipeId(recipeId);
  const res = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 해제 실패');
  }
  // 보통 비어있지만, 200 OK면 성공
  return true;
}

/** 현재 목록에서 해당 recipeId가 찜되어 있는지 간단 체크 */
export function isFavoriteIn(list, recipeId) {
  const rid = Number(recipeId);
  return Array.isArray(list) && list.some((f) => Number(f.recipeId) === rid);
}
