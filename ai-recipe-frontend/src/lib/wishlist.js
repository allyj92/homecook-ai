// src/lib/wishlist.js
export function recipeKey(data) {
  if (!data) return '';
  const id = data.id ?? '';
  const title = (data.title || '').trim();
  const kcal = data.kcal ?? '';
  return `recipe:${id}:${title}:${kcal}`;
}

export async function toggleWishlist(payload) {
  const r = await fetch('/api/wishlist/toggle', {
    method: 'POST',
    credentials: 'include',          // 🔴 쿠키 포함
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('toggle failed');
  return r.json(); // { saved: boolean }
}

export async function checkSaved(key) {
  const r = await fetch(`/api/wishlist/exists?key=${encodeURIComponent(key)}`, {
    credentials: 'include',
  });
  if (!r.ok) throw new Error('exists failed');
  return r.json(); // { saved: boolean }
}

export async function fetchWishlist() {
  const r = await fetch('/api/wishlist', {
    credentials: 'include',
  });
  if (!r.ok) throw new Error('list failed');
  return r.json(); // WishlistItem[] (서버 엔티티 직렬화 형태)
}

export async function removeWishlist(key) {
  const r = await fetch(`/api/wishlist/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!r.ok) throw new Error('remove failed');
  return r.json(); // { removed: boolean }
}
