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

/** 내부: 응답을 배열로 정규화 (컨트롤러가 배열/객체 둘다 올 수 있어 호환) */
async function normalizeArrayResponse(res) {
  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 목록 조회 실패');
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/** 찜 목록(단순 배열) — 기존 호환용 */
export async function listFavorites() {
  const res = await fetch(api('/api/me/favorites'), { credentials: 'include' });
  return normalizeArrayResponse(res); // [{ id, recipeId, createdAt }, ...]
}

/** 미리보기용: 상위 N개만 (기본 3개) */
export async function listFavoritesSimple(size = 3) {
  const url = api(`/api/me/favorites?page=0&size=${encodeURIComponent(size)}`);
  const res = await fetch(url, { credentials: 'include' });
  return normalizeArrayResponse(res); // 항상 배열 반환
}

/** 페이지네이션 목록: 객체 형태로 반환 */
export async function listFavoritesPage({ page = 0, size = 12 } = {}) {
  const url = api(`/api/me/favorites?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 목록 조회 실패');
  }
  const data = await res.json();
  // 백엔드가 배열만 보내는 구버전 호환
  if (Array.isArray(data)) {
    return { items: data, page: 0, size: data.length, total: data.length, totalPages: 1 };
  }
  return {
    items: data.items ?? [],
    page: data.page ?? 0,
    size: data.size ?? size,
    total: data.total ?? (data.items?.length ?? 0),
    totalPages: data.totalPages ?? 1,
  };
}

/** 찜 추가 (POST /api/me/favorites/{recipeId}) */
export async function addFavorite(recipeOrId) {
  const r = recipeOrId || {};
  const rid = toRecipeId(typeof r === 'object' ? (r.id ?? r.recipeId) : recipeOrId);

  // 객체가 오면 메타 추출
  let body = undefined;
  if (typeof r === 'object') {
    body = {
      title: r.title ?? null,
      summary: r.summary ?? null,
      image: r.image ?? null,
      // 예: "320kcal · 10분" 같은 표시용 메타
      meta: r.kcal != null || r.cook_time_min != null
        ? `${r.kcal ?? '-'}kcal · ${r.cook_time_min ?? '-'}분`
        : (r.meta ?? null),
    };
  }

  const res = await fetch(api(`/api/me/favorites/${rid}`), {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    throw new Error('찜 추가 실패');
  }
  return res.json(); // { id, recipeId, title, summary, image, meta, createdAt }
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
  return true;
}

/** 현재 목록에서 해당 recipeId가 찜되어 있는지 간단 체크 */
export function isFavoriteIn(list, recipeId) {
  const rid = Number(recipeId);
  return Array.isArray(list) && list.some((f) => Number(f.recipeId) === rid);
}
