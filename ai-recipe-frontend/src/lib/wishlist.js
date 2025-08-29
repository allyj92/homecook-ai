import { apiFetch } from '../lib/http';

// 레시피를 대표하는 "안정 키" 만들기 (id가 있으면 그걸 사용)
export function recipeKey(recipe) {
  if (recipe?.id) return `recipe:${recipe.id}`;
  // id가 없다면 title+kcal+time 정도로 간단 해시 (충돌 줄이기)
  const base = `${recipe?.title || ''}::${recipe?.kcal || ''}::${recipe?.cook_time_min || ''}`;
  let h = 0; for (let i=0;i<base.length;i++) h = ((h<<5)-h) + base.charCodeAt(i) | 0;
  return `rf:${Math.abs(h)}`;
}

export async function toggleWishlist({ key, title, summary, image, meta, payload }) {
  const res = await apiFetch('/api/wishlist/toggle', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: { key, title, summary, image, meta, payload },
  });
  if (!res.ok) throw new Error('toggle failed');
  return await res.json(); // { saved: boolean }
}

export async function checkSaved(key) {
  const res = await apiFetch(`/api/wishlist/exists?key=${encodeURIComponent(key)}`, { method:'GET' });
  if (!res.ok) return { saved: false };
  return await res.json(); // { saved: boolean }
}
