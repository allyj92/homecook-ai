// src/lib/wishlist.js
import { apiFetch } from '../lib/http';

export function recipeKey(r) {
  const base = (r?.title || 'recipe') + '|' + (r?.kcal ?? '?') + '|' + (r?.cook_time_min ?? '?');
  return base.toLowerCase();
}

export async function toggleWishlist({ key, title, summary, image, meta, payload }) {
  const res = await apiFetch('/api/wishlist/toggle', {
    method: 'POST',
    body: { key, title, summary, image, meta, payload },
  });
  if (!res.ok) throw new Error('toggle failed');
  return await res.json(); // { saved: true/false }
}

export async function checkSaved(key) {
  const url = `/api/wishlist/exists?key=${encodeURIComponent(key)}`;
  const res = await apiFetch(url, { method: 'GET', noAuthRedirect: true });
  if (!res.ok) return { saved: false };
  return await res.json(); // { saved: boolean }
}

/* ➕ 추가: 내 위시리스트 목록 */
export async function fetchWishlist() {
  const res = await apiFetch('/api/wishlist', { method: 'GET', noAuthRedirect: true });
  if (!res.ok) throw new Error('list failed');
  return await res.json(); // [{id,itemKey,title,summary,image,meta,createdAt,...}]
}

/* ➕ 추가: 항목 제거 */
export async function removeWishlist(key) {
  const res = await apiFetch(`/api/wishlist/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    noAuthRedirect: true,
  });
  if (!res.ok) throw new Error('remove failed');
  return await res.json(); // { removed: boolean }
}
