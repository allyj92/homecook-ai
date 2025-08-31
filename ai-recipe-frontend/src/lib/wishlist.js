const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const api = (p) => `${BACKEND_URL}${p}`;

function toRecipeId(v){ const n = Number(v); if(!Number.isFinite(n)||n<=0) throw new Error('bad id'); return n; }

export async function listFavorites(){
  const r = await fetch(api('/api/me/favorites'), { credentials: 'include' });
  if(!r.ok) throw new Error('list fail');
  return r.json(); // [{id,recipeId,title,summary,image,meta,createdAt}]
}

export async function addFavorite(recipeOrId){
  const rid = toRecipeId(recipeOrId?.id ?? recipeOrId);
  const body = recipeOrId && typeof recipeOrId === 'object'
    ? {
        title:   recipeOrId.title ?? null,
        summary: recipeOrId.summary ?? null,
        image:   recipeOrId.image ?? null,
        meta:    [recipeOrId.kcal ? `${recipeOrId.kcal}kcal` : null,
                  recipeOrId.cook_time_min ? `${recipeOrId.cook_time_min}분` : null]
                  .filter(Boolean).join(' · ') || null
      }
    : null;

  const r = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type':'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if(!r.ok) throw new Error('add fail');
  return r.json();
}

export async function removeFavorite(recipeId){
  const rid = toRecipeId(recipeId);
  const r = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'DELETE',
    credentials: 'include'
  });
  if(!r.ok) throw new Error('remove fail');
  return true;
}