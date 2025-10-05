// src/lib/activity.js
const LS_PREFIX = "rf:activity";           // rf:activity:<uid>:<provider>
const LEGACY_KEY = "activityLog:v1";       // 이전 단일 키(마이그레이션 대상)
const EVT = "activity:changed";
const MAX = 300;

/* ── utils ─────────────────────────── */
function hasStorage() {
  try { return typeof window !== "undefined" && !!window.localStorage; } catch { return false; }
}
function nowMs() { return Date.now ? Date.now() : new Date().getTime(); }
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
function toInt(n, min, max) {
  const v = Number.parseInt(n, 10);
  let x = Number.isFinite(v) ? v : 0;
  if (typeof min === "number") x = Math.max(min, x);
  if (typeof max === "number") x = Math.min(max, x);
  return x;
}

/** 길면 … 처리 */
export function ellipsis(s, max = 36) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/* 현재 로그인 사용자 (localStorage.authUser 기준) */
function getAuthSafe() {
  if (!hasStorage()) return null;
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

/* 네임스페이스 & 키 */
function ns() {
  const a = getAuthSafe();
  return a ? `${a.uid}:${a.provider}` : null;
}
function keyFor(nsStr) { return `${LS_PREFIX}:${nsStr}`; }

/* 읽기/쓰기 (계정별) */
function readRaw(nsStr) {
  if (!hasStorage() || !nsStr) return [];
  try {
    const raw = localStorage.getItem(keyFor(nsStr));
    const arr = safeJson(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeRaw(nsStr, arr) {
  if (!hasStorage() || !nsStr) return;
  const sorted = (arr || [])
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0))
    .slice(0, MAX);

  const save = (data) => localStorage.setItem(keyFor(nsStr), JSON.stringify(data));
  try { save(sorted); }
  catch {
    // 용량 초과 시 뒤에서부터 버리며 최대 3회 재시도
    let tmp = sorted.slice();
    for (let i = 0; i < 3 && tmp.length > 0; i++) {
      tmp.pop();
      try { save(tmp); break; } catch {}
    }
  }
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}

/* 레거시 단일 키 → 현재 로그인 계정 네임스페이스로 1회 이동 */
function migrateLegacyIfAny(nsStr) {
  if (!hasStorage() || !nsStr) return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = safeJson(raw);
    const legacyArr = Array.isArray(legacy) ? legacy : [];
    if (!legacyArr.length) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const curr = readRaw(nsStr);
    const merged = [...legacyArr, ...curr]
      .filter(Boolean)
      .sort((a, b) => (b?.ts || 0) - (a?.ts || 0))
      .slice(0, MAX);
    writeRaw(nsStr, merged);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // 무시
  }
}

/* 서버 전송 (fire-and-forget) */
function sendActivityToServer(type, data) {
  try {
    const body = JSON.stringify({ type: String(type || "unknown"), data: (data && typeof data === "object") ? data : {} });
    // 같은 오리진이면 쿠키 동반
    if (navigator?.sendBeacon) {
      const ok = navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    // fallback: fetch
    fetch("/api/activity", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  } catch {
    // 전송 실패는 조용히 무시(로컬 기록은 이미 남음)
  }
}

/* ── public API ────────────────────── */

/** 🔑 백엔드 세션을 localStorage.authUser 로 보정 (서브도메인/리프레시 후 동기화) */
export async function ensureActivityNs() {
  if (!hasStorage()) return;
  try {
    const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const me = await res.json();
    if (!me?.authenticated) return;

    const next = {
      authenticated: true,
      uid: me.uid ?? me.id ?? me.userId ?? me.user_id,
      provider: me.provider ?? me.authProvider ?? me.oauthProvider,
      email: me.email ?? null,
      name: me.name ?? null,
      avatar: me.avatar ?? me.picture ?? null,
    };
    if (!next.uid || !next.provider) return;

    const prevRaw = localStorage.getItem("authUser");
    const prev = prevRaw ? safeJson(prevRaw) : null;
    if (!prev || prev.uid !== next.uid || prev.provider !== next.provider || !prev.authenticated) {
      localStorage.setItem("authUser", JSON.stringify(next));
      try { window.dispatchEvent(new Event("auth:changed")); } catch {}
    }
  } catch {
    // 네트워크 오류 무시
  }
}

/** 활동 기록 추가 (로컬 저장 + 서버 전송) */
export function logActivity(type, payload = {}) {
  const n = ns();
  if (!n) return; // 비로그인은 기록 안 함
  migrateLegacyIfAny(n);

  const ts = nowMs();
  const item = {
    id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || "unknown"),
    ts,
    data: (payload && typeof payload === "object") ? payload : {},
  };

  // 1) 로컬 업데이트
  const arr = readRaw(n);
  const dedup = arr.filter(a => a?.id !== item.id);
  dedup.unshift(item);
  writeRaw(n, dedup);

  // 2) 서버 전송 (비동기, 실패 무시)
  sendActivityToServer(item.type, item.data);
}

/** 활동 목록(최신순, limit) — 로컬 전용(마이페이지 짧은 프리뷰 용) */
export function listActivities(limit = 50) {
  const n = ns();
  if (!n) return [];
  migrateLegacyIfAny(n);

  const arr = readRaw(n)
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0));
  const lim = Math.max(0, limit | 0);
  return arr.slice(0, lim);
}

/** 페이지네이션(동기, 로컬 전용) */
export function listActivitiesPaged(page = 0, size = 20) {
  const n = ns();
  if (!n) return { items: [], total: 0 };
  migrateLegacyIfAny(n);

  const arr = readRaw(n)
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0));

  const total = arr.length;
  const p = Math.max(0, page | 0);
  const s = Math.max(1, size | 0);
  const start = p * s;
  const end = Math.min(start + s, total);
  const items = start >= total ? [] : arr.slice(start, end);
  return { items, total };
}

/** 페이지네이션(비동기) – 서버 우선, 실패 시 로컬 폴백 */
export async function listActivitiesPagedAsync(page = 0, size = 20) {
  const p = toInt(page, 0);
  const s = Math.max(1, toInt(size, 1));

  try {
    // 세션 동기화(선택)
    await ensureActivityNs();

    const res = await fetch(`/api/activity?page=${encodeURIComponent(p)}&size=${encodeURIComponent(s)}`, {
      credentials: "include",
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      // 서버 스키마: { items: [{id,type,ts,data}], total }
      const items = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total ?? 0);
      return { items, total };
    }
    // 401 등은 로컬 폴백
  } catch {
    // 네트워크 에러 → 폴백
  }

  // 폴백: 로컬
  return listActivitiesPaged(p, s);
}

/** 변경 이벤트 구독 (동일 탭: 커스텀 EVT, 다른 탭: storage) */
export function subscribeActivity(handler) {
  const safe = () => { try { handler(); } catch {} };
  const onStorage = (e) => {
    try {
      if (!e || (e.key && !e.key.startsWith(`${LS_PREFIX}:`) && e.key !== LEGACY_KEY && e.key !== "authUser")) return;
      safe();
    } catch {}
  };
  window.addEventListener(EVT, safe);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, safe);
    window.removeEventListener("storage", onStorage);
  };
}

/** UI용 텍스트 (제목 + 동사, 길면 …) */
export function formatActivityText(a) {
  const t = a?.type;
  const d = a?.data || {};

  // 제목 소스 우선순위
  const rawPostTitle =
    d.postTitle ??
    d.title ??
    d.post_title ??
    d.subject ??
    (d.postId != null ? `게시글 #${d.postId}` : (d.recipeId != null ? `레시피 #${d.recipeId}` : "항목"));

  const rawRecipeTitle =
    d.recipeTitle ??
    d.title ??
    (d.recipeId != null ? `레시피 #${d.recipeId}` : null);

  const postTitle = ellipsis(rawPostTitle, 36);
  const recipeTitle = ellipsis(rawRecipeTitle || rawPostTitle, 36); // 레시피 없으면 포스트 제목으로 대체

  switch (t) {
    case "post_create":
      return `${postTitle} 작성`;
    case "post_update":
      return `${postTitle} 수정`;
    case "post_delete":
      return `${postTitle} 삭제`;
    case "comment_create":
    case "comment_add":
      return `${postTitle} 댓글 작성`;
    case "post_like":
      return d.on ? `${postTitle} 좋아요` : `${postTitle} 좋아요 취소`;
    case "post_bookmark":
      return d.on ? `${postTitle} 북마크` : `${postTitle} 북마크 해제`;
    case "favorite_add":
      return `${recipeTitle} 저장`;
    case "favorite_remove":
      return `${recipeTitle} 저장 해제`;
    default:
      return `${postTitle} · ${String(t || "활동")}`;
  }
}

/** 항목별 링크(있으면 클릭 이동) — 댓글이면 앵커 포함 */
export function formatActivityHref(a) {
  const d = a?.data || {};
  const postId = d.postId ?? d.pid;
  if (postId) {
    const commentId = d.commentId ?? d.cid;
    return `/community/${postId}${commentId ? `#comment-${commentId}` : ""}`;
  }
  if (d.recipeId) return `/result?id=${encodeURIComponent(d.recipeId)}`;
  return null;
}

/** 현재 로그인 계정의 활동만 초기화 (레거시 키도 함께 제거) — 서버는 건드리지 않음 */
export function clearActivities() {
  const n = ns();
  if (!hasStorage()) return;
  try {
    if (n) localStorage.removeItem(keyFor(n));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}

/* ── streak helpers ─────────────────────────────────────── */
const DAY_MS = 24 * 60 * 60 * 1000;
function ymdLocal(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** 연속일 계산에 포함할 기본 활동 타입들 */
export const DEFAULT_STREAK_TYPES = [
  "post_create", "post_update", "post_delete",
  "post_like", "post_bookmark",
  "comment_create", "comment_add",
  "favorite_add", "favorite_remove",
];

/**
 * 현재 계정의 연속 활동일 수 계산
 * @param {Object} opts
 * @param {boolean} [opts.includeToday=true]  오늘 활동 없으면 0부터(오늘 포함), 어제까지로 볼 땐 false
 * @param {string[]} [opts.types=DEFAULT_STREAK_TYPES] 포함할 타입 화이트리스트
 * @returns {number} streak
 */
export function getDailyActivityStreak(opts = {}) {
  const { includeToday = true, types = DEFAULT_STREAK_TYPES } = opts;
  const n = ns();
  if (!n) return 0;
  migrateLegacyIfAny(n);

  const allow = Array.isArray(types) && types.length ? new Set(types) : null;
  const days = new Set(
    readRaw(n)
      .filter(a => a && a.ts && (!allow || allow.has(a.type)))
      .map(a => ymdLocal(a.ts))
  );

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  if (!includeToday) base.setTime(base.getTime() - DAY_MS);

  let streak = 0;
  let cursor = new Date(base);
  while (true) {
    const key = ymdLocal(cursor.getTime());
    if (!days.has(key)) break;
    streak += 1;
    cursor.setTime(cursor.getTime() - DAY_MS);
  }
  return streak;
}