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
  const clamped = Number.isFinite(v) ? v : 0;
  return Math.max(min ?? clamped, Math.min(max ?? clamped, clamped));
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

/** UI용 텍스트 */
export function formatActivityText(a) {
  const t = a?.type;
  const d = a?.data || {};
  const postLabel = d.title ?? (d.postId != null ? `게시글 #${d.postId}` : "게시글");
  const recipeLabel = d.title ?? (d.recipeId != null ? `#${d.recipeId}` : "");

  switch (t) {
    case "post_like":
      return d.on ? `‘${postLabel}’에 좋아요` : `‘${postLabel}’ 좋아요 취소`;
    case "post_bookmark":
      return d.on ? `‘${postLabel}’ 북마크` : `‘${postLabel}’ 북마크 해제`;
    case "comment_create":
    case "comment_add":
      return `‘${postLabel}’에 댓글 작성`;
    case "favorite_add":
      return `레시피 ‘${recipeLabel}’ 저장`;
    case "favorite_remove":
      return `레시피 ‘${recipeLabel}’ 저장 해제`;
    case "post_create":
      return `글 작성: ‘${postLabel}’`;
    case "post_delete":
      return `글 삭제: ‘${postLabel}’`;
    default:
      return d.title ? `${t} · ${d.title}` : String(t || "활동");
  }
}

/** 항목별 링크(있으면 클릭 이동) */
export function formatActivityHref(a) {
  const t = a?.type;
  const d = a?.data || {};
  if (!t || !d) return null;
  if (d.postId) return `/community/${d.postId}`;
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