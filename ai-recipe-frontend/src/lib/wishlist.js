// src/lib/wishlist.js
// 프론트 → 백엔드 즐겨찾기(Favorites) API 모듈 (견고화 버전)

const RAW_BASE = import.meta.env.VITE_BACKEND_URL || '';
const BACKEND_URL = RAW_BASE.replace(/\/+$/, ''); // 끝 슬래시 정리

function api(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${p}`;
}

function toRecipeId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`유효하지 않은 recipeId: ${value}`);
  }
  return n;
}

async function safeJson(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
}

function pickServerMessage(e, fallback) {
  if (!e) return fallback;
  const msg = e?.message || e?.error || e?.detail;
  return msg || fallback;
}

function normalizeItem(it) {
  // 서버 FavoriteDto 또는 서버가 배열만 줄 때도 방어
  if (!it || typeof it !== 'object') return it;
  const createdAt =
    typeof it.createdAt === 'string' ? it.createdAt :
    (it.created_at ?? null);

  const recipeId =
    it.recipeId ?? it.recipe_id ?? it.id ?? null; // 백호환(혹시)

  return {
    id: it.id ?? null,
    recipeId: Number(recipeId),
    title: it.title ?? null,
    summary: it.summary ?? null,
    image: it.image ?? null,
    meta: it.meta ?? null,
    createdAt: createdAt ?? null,
  };
}

function normalizeArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeItem);
  if (Array.isArray(data.items)) return data.items.map(normalizeItem);
  return [];
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, credentials: 'include' });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/** 내부: 응답을 배열로 정규화 (컨트롤러가 배열/페이지 객체 둘다 올 수 있음) */
async function normalizeArrayResponse(res) {
  if (!res.ok) {
    const server = await safeJson(res);
    if (res.status === 401) throw new Error(pickServerMessage(server, '로그인이 필요합니다.'));
    throw new Error(pickServerMessage(server, '찜 목록 조회 실패'));
  }
  const data = await safeJson(res);
  return normalizeArray(data);
}

/** 찜 목록(단순 배열) — 기존 호환용 */
export async function listFavorites() {
  const res = await fetchWithTimeout(api('/api/me/favorites'));
  return normalizeArrayResponse(res); // [{ id, recipeId, title?, ... }, ...]
}

/** 미리보기용: 상위 N개만 (기본 3개) */
export async function listFavoritesSimple(size = 3) {
  const res = await fetchWithTimeout(api(`/api/me/favorites?page=0&size=${encodeURIComponent(size)}`));
  return normalizeArrayResponse(res);
}

/** 페이지네이션 목록: { items, page, size, total, totalPages } */
export async function listFavoritesPage({ page = 0, size = 12 } = {}) {
  const res = await fetchWithTimeout(api(`/api/me/favorites?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`));
  if (!res.ok) {
    const server = await safeJson(res);
    if (res.status === 401) throw new Error(pickServerMessage(server, '로그인이 필요합니다.'));
    throw new Error(pickServerMessage(server, '찜 목록 조회 실패'));
  }
  const data = await safeJson(res) ?? {};
  // 구버전(배열만 반환)도 호환
  if (Array.isArray(data)) {
    return {
      items: data.map(normalizeItem),
      page: 0, size: data.length, total: data.length, totalPages: 1
    };
  }
  return {
    items: normalizeArray(data),
    page: Number(data.page ?? 0),
    size: Number(data.size ?? size),
    total: Number(data.total ?? (Array.isArray(data.items) ? data.items.length : 0)),
    totalPages: Number(data.totalPages ?? 1),
  };
}



/** 찜 추가 (POST /api/me/favorites/{recipeId}) — 메타 동봉 지원 */
export async function addFavorite(recipeOrId) {
  const r = recipeOrId || {};
  const rid = typeof r === 'object' ? (r.id ?? r.recipeId) : recipeOrId;

  if (!Number.isFinite(Number(rid)) || Number(rid) <= 0) {
    throw new Error(`유효하지 않은 recipeId: ${rid}`);
  }

  const body = {
    recipeId: Number(rid),
    title:   typeof r === 'object' ? (r.title ?? null)   : null,
    summary: typeof r === 'object' ? (r.summary ?? null) : null,
    image:   typeof r === 'object' ? (r.image ?? null)   : null,
    meta:
      typeof r === 'object'
        ? (r.meta ??
           ((r.kcal != null || r.cook_time_min != null)
              ? `${r.kcal ?? '-'}kcal · ${r.cook_time_min ?? '-'}분`
              : null))
        : null,
  };

  const res = await fetch(api(`/api/me/favorites`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('로그인이 필요합니다.');
    const t = await res.text().catch(()=>'');
    throw new Error(`찜 추가 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id, recipeId, title, summary, image, meta, createdAt }
}

/** 찜 해제 (DELETE /api/me/favorites/{recipeId}) */
export async function removeFavorite(recipeId) {
  const rid = toRecipeId(recipeId);
  const res = await fetchWithTimeout(api(`/api/me/favorites/${rid}`), { method: 'DELETE' });
  if (!res.ok) {
    const server = await safeJson(res);
    if (res.status === 401) throw new Error(pickServerMessage(server, '로그인이 필요합니다.'));
    throw new Error(pickServerMessage(server, '찜 해제 실패'));
  }
  return true;
}

/** 토글: 현재 상태에 따라 add/remove */
export async function toggleFavorite(recipeOrId, savedNow) {
  const rid = toRecipeId(typeof recipeOrId === 'object' ? (recipeOrId.id ?? recipeOrId.recipeId) : recipeOrId);
  if (savedNow) {
    await removeFavorite(rid);
    return { saved: false };
  }
  const savedItem = await addFavorite(recipeOrId);
  return { saved: true, item: savedItem };
}

/** 현재 목록에서 해당 recipeId가 찜되어 있는지 간단 체크 */
export function isFavoriteIn(list, recipeId) {
  const rid = Number(recipeId);
  return Array.isArray(list) && list.some((f) => Number(f.recipeId) === rid);
}
