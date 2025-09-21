// src/lib/wishlist.js
const PREFIX = "rf:wish";                 // rf:wish:<uid>:<provider>:<recipeId>
const DATA_PREFIX = "rf:wishData";        // rf:wishData:<uid>:<provider>:<recipeId>
const LEGACY_KEYS = ["favorite", "favoriteData", "wish", "wishData"]; // 예전 형태 흡수
const MAX = 500;

function hasLS() {
  try { return typeof window !== "undefined" && !!window.localStorage; } catch { return false; }
}
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
function nowMs() { return Date.now ? Date.now() : new Date().getTime(); }

function getAuthSafe() {
  if (!hasLS()) return null;
  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || !u.authenticated) return null;
    const uid = u.uid ?? u.id ?? u.userId ?? u.user_id ?? null;
    const provider = u.provider ?? null;
    if (!uid || !provider) return null;
    return { uid: String(uid), provider: String(provider) };
  } catch { return null; }
}

function ns() {
  const a = getAuthSafe();
  return a ? `${a.uid}:${a.provider}` : null;
}

function wishKey(nsStr, recipeId) { return `${PREFIX}:${nsStr}:${recipeId}`; }
function dataKey(nsStr, recipeId) { return `${DATA_PREFIX}:${nsStr}:${recipeId}`; }

/* 레거시 키 -> 현재 로그인 계정 네임스페이스로 이동 */
function adoptLegacyOnce(nsStr) {
  if (!hasLS() || !nsStr) return;
  try {
    const move = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // 예: "favorite:123", "favoriteData:123" 같은 2파츠만 레거시로 간주
      const parts = k.split(":");
      if (parts.length !== 2) continue;

      const [pfx, id] = parts;
      if (!LEGACY_KEYS.includes(pfx)) continue;
      if (!/^[0-9]+$/.test(String(id))) continue;

      move.push(k);
    }

    move.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v == null) return;

      const [pfx, id] = k.split(":");
      if (pfx === "favorite" || pfx === "wish") {
        localStorage.setItem(wishKey(nsStr, id), v);
      } else if (pfx === "favoriteData" || pfx === "wishData") {
        localStorage.setItem(dataKey(nsStr, id), v);
      }
      localStorage.removeItem(k);
    });
  } catch {}
}

/* 내부: 목록 로드 */
function loadAll(nsStr) {
  const out = [];
  if (!hasLS() || !nsStr) return out;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(`${PREFIX}:${nsStr}:`)) continue;

      const parts = k.split(":"); // [rf,wish,ns.uid,ns.provider,<id>]
      const id = parts[4];
      if (!/^[0-9]+$/.test(String(id))) continue;

      if (localStorage.getItem(k) !== "1") continue;

      const dk = dataKey(nsStr, id);
      const meta = safeJson(localStorage.getItem(dk)) || {};
      out.push({
        recipeId: Number(id),
        title: meta.title ?? null,
        image: meta.image ?? null,
        summary: meta.summary ?? null,
        meta: meta.meta ?? null,
        savedAt: meta.savedAt ?? null,
      });
    }
  } catch {}
  out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return out.slice(0, MAX);
}

/* 공개 API */

/** 간단 목록 */
export async function listFavoritesSimple(limit = 100) {
  const n = ns();
  if (!n) return [];              // 비로그인에는 표시 X
  adoptLegacyOnce(n);

  const arr = loadAll(n);
  const lim = Math.max(0, limit | 0);
  return arr.slice(0, lim);
}

/** 추가 */
export async function addFavorite(recipeId, meta = {}) {
  const n = ns();
  if (!n || !hasLS()) return { ok: false };

  const id = Number(recipeId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false };

  try {
    localStorage.setItem(wishKey(n, id), "1");
    const payload = {
      title: meta.title ?? null,
      image: meta.image ?? null,
      summary: meta.summary ?? null,
      meta: meta.meta ?? null,
      savedAt: nowMs(),
    };
    localStorage.setItem(dataKey(n, id), JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 제거 */
export async function removeFavorite(recipeId) {
  const n = ns();
  if (!n || !hasLS()) return { ok: false };

  const id = Number(recipeId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false };

  try {
    localStorage.setItem(wishKey(n, id), "0");
    localStorage.removeItem(dataKey(n, id));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 토글(필요 시) */
export async function toggleFavorite(recipeId, meta = {}) {
  const n = ns();
  if (!n || !hasLS()) return { ok: false };

  const id = Number(recipeId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false };

  const k = wishKey(n, id);
  const on = localStorage.getItem(k) === "1";
  if (on) {
    return removeFavorite(id);
  } else {
    return addFavorite(id, meta);
  }
}

/** 현재 계정 것만 싹 지우기 */
export function clearFavoritesForCurrentUser() {
  const n = ns();
  if (!n || !hasLS()) return;
  try {
    const toDel = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`${PREFIX}:${n}:`) || k.startsWith(`${DATA_PREFIX}:${n}:`)) {
        toDel.push(k);
      }
    }
    toDel.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
