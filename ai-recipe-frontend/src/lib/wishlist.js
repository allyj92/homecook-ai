// src/lib/wishlist.js
import { apiFetch } from '../lib/http';

/** 내부 타임아웃 래퍼 (fetch가 끝나지 않아도 UI는 멈추지 않도록) */
function withTimeout(promise, ms = 8000) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function recipeKey(r) {
  const base = (r?.title || 'recipe') + '|' + (r?.kcal ?? '?') + '|' + (r?.cook_time_min ?? '?');
  return base.toLowerCase();
}

/** 찜 토글 */
export async function toggleWishlist({ key, title, summary, image, meta, payload }) {
  const res = await withTimeout(
    apiFetch('/api/wishlist/toggle', {
      method: 'POST',
      body: { key, title, summary, image, meta, payload },
    }),
    8000
  );
  if (!res.ok) {
    const err = new Error('toggle failed');
    err.status = res.status;
    throw err;
  }
  return await res.json(); // { saved: true/false }
}

/** 현재 항목 저장 여부 */
export async function checkSaved(key) {
  const res = await withTimeout(
    apiFetch(`/api/wishlist/exists?key=${encodeURIComponent(key)}`, {
      method: 'GET',
      noAuthRedirect: true,
    }),
    6000
  );
  if (!res.ok) return { saved: false };
  return await res.json(); // { saved: boolean }
}

/** 내 위시리스트 */
export async function fetchWishlist({ signal } = {}) {
  const res = await withTimeout(
    apiFetch('/api/wishlist', { method: 'GET', noAuthRedirect: true, signal }),
    9000
  );
  if (!res.ok) {
    const err = new Error('list failed');
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** 개별 삭제 */
export async function removeWishlist(key) {
  const res = await withTimeout(
    apiFetch(`/api/wishlist/${encodeURIComponent(key)}`, { method: 'DELETE', noAuthRedirect: true }),
    8000
  );
  if (!res.ok) {
    const err = new Error('remove failed');
    err.status = res.status;
    throw err;
  }
  return await res.json(); // { removed: boolean }
}
