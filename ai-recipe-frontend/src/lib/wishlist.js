// src/lib/wishlist.js (최종)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const api = (p) => `${BACKEND_URL}${p}`;

const toRecipeId = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid recipeId: ${v}`);
  return n;
};

export async function listFavorites() {
  const r = await fetch(api('/api/me/favorites'), { credentials: 'include' });
  if (r.status === 401) throw new Error('로그인 필요');
  if (!r.ok) throw new Error('찜 목록 조회 실패');
  return r.json(); // [{id, recipeId, createdAt}]
}

export async function addFavorite(recipeId) {
  const rid = toRecipeId(recipeId);
  const r = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'POST', credentials: 'include'
  });
  if (r.status === 401) throw new Error('로그인 필요');
  if (!r.ok) throw new Error('찜 추가 실패');
  return r.json(); // {id, recipeId, createdAt}
}

export async function removeFavorite(recipeId) {
  const rid = toRecipeId(recipeId);
  const r = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'DELETE', credentials: 'include'
  });
  if (r.status === 401) throw new Error('로그인 필요');
  if (!r.ok) throw new Error('찜 해제 실패');
  return true;
}

export function isFavoriteIn(list, recipeId) {
  const rid = Number(recipeId);
  return Array.isArray(list) && list.some((f) => Number(f.recipeId) === rid);
}
