// src/lib/activity.js
const LS_PREFIX = "rf:activity";           // rf:activity:<uid>:<provider>
const LEGACY_KEY = "activityLog:v1";       // 이전 단일 키(마이그레이션 대상)
const EVT = "activity:changed";
const MAX = 300;



// ✅ 활동 페이지네이션
export function listActivitiesPaged(page = 0, size = 20) {
  const n = ns();
  if (!n) return { items: [], total: 0, page, size };
  migrateLegacyIfAny(n);

  const arr = readRaw(n)
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0));

  const total = arr.length;
  const p = Math.max(0, page | 0);
  const s = Math.max(1, size | 0);
  const start = p * s;
  const end = start + s;
  const items = arr.slice(start, end);
  return { items, total, page: p, size: s, hasPrev: p > 0, hasNext: end < total };
}

// ✅ 서버 세션으로 authUser 채워 넣어, 다른 서브도메인에서 기록된 활동도 읽을 수 있게
export async function ensureActivityNs() {
  // 이미 있으면 패스
  if (getAuthSafe()) return true;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return false;
    const me = await res.json();
    if (me?.authenticated) {
      try { localStorage.setItem('authUser', JSON.stringify(me)); } catch {}
      return true;
    }
  } catch {}
  return false;
}

// ✅ 전체 개수만 필요할 때
export function countActivities() {
  const n = ns();
  if (!n) return 0;
  migrateLegacyIfAny(n);
  return readRaw(n).length;
}

/* ── utils ─────────────────────────── */
function hasStorage() {
  try { return typeof window !== "undefined" && !!window.localStorage; } catch { return false; }
}
function nowMs() { return Date.now ? Date.now() : new Date().getTime(); }
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

/* 텍스트 프리뷰(마크다운/HTML/URL 제거 + 공백 정리) */
function toPreviewText(input, maxLen = 60) {
  if (!input) return "";
  let s = String(input);
  // md 이미지/링크 제거·치환
  s = s.replace(/!\[[^\]]*?\]\([^)]+\)/g, "");                // 이미지 제거
  s = s.replace(/\[([^\]]+?)\]\(([^)]+)\)/g, (_m, t) => t);   // 링크 → 텍스트
  // html 태그 제거
  s = s.replace(/<img[^>]*?>/gi, "");
  s = s.replace(/<a[^>]*?>(.*?)<\/a>/gi, (_m, t) => t);
  s = s.replace(/<\/?[^>]+?>/g, " ");
  // url 제거
  s = s.replace(/\bhttps?:\/\/\S+/gi, "");
  s = s.replace(/\bwww\.\S+/gi, "");
  // 잔여 md 기호/공백 정리
  s = s.replace(/[#>*`_~\-]{1,}/g, " ").replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen) + "…";
  return s;
}

/* 현재 로그인 사용자 (localStorage.authUser 기준) */
function getAuthSafe() {
  if (!hasStorage()) return null;
  try {
    // localStorage 우선, 없으면 sessionStorage도 시도
    const raw = localStorage.getItem("authUser") || (sessionStorage && sessionStorage.getItem("authUser"));
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || !u.authenticated) return null;
    const uid = u.uid ?? u.id ?? u.userId ?? u.user_id ?? null;
    const provider = u.provider ?? "local";
    if (!uid) return null;
    return { uid: String(uid), provider: String(provider || "local") };
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
    // 읽기 실패해도 깔끔히 무시
  }
}

/* ── public API ────────────────────── */

/** 활동 기록 추가 (계정별 저장) */
export function logActivity(type, payload = {}) {
  const n = ns();
  if (!n) return null; // 비로그인은 기록 안 함(원하면 anon 등으로 바꿔도 됨)
  migrateLegacyIfAny(n);

  const ts = nowMs();
  const item = {
    id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || "unknown"),
    ts,
    data: (payload && typeof payload === "object") ? payload : {},
  };

  const arr = readRaw(n);
  const dedup = arr.filter(a => a?.id !== item.id);
  dedup.unshift(item);
  writeRaw(n, dedup);
  return item; // ✅ 생성된 아이템을 반환
}

/** 활동 목록 가져오기 (계정별 최신순) */
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

/** 변경 이벤트 구독 (동일 탭: 커스텀 EVT, 다른 탭: storage) */
export function subscribeActivity(handler) {
  const safe = () => { try { handler(); } catch {} };
  const onStorage = (e) => {
    try {
      if (!e || (e.key && !e.key.startsWith(`${LS_PREFIX}:`) && e.key !== LEGACY_KEY)) return;
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

/** 추천 이동 링크 (UI에서 사용하고 싶을 때) */
export function formatActivityHref(a) {
  const d = a?.data || {};
  switch (a?.type) {
    case "post_create":
    case "post_update":
    case "post_delete":
    case "post_like":
    case "post_bookmark":
    case "comment_create":
    case "comment_update":
    case "comment_delete":
    case "comment_like":
      return d.postId != null ? `/community/${d.postId}` : null;
    case "favorite_add":
    case "favorite_remove":
      return d.recipeId != null ? `/result?id=${encodeURIComponent(d.recipeId)}` : null;
    default:
      return null;
  }
}

/** UI용 텍스트 */
export function formatActivityText(a) {
  const t = a?.type;
  const d = a?.data || {};
  const postLabel = d.title ?? (d.postId != null ? `게시글 #${d.postId}` : "게시글");
  const recipeLabel = d.title ?? (d.recipeId != null ? `#${d.recipeId}` : "");
  const preview = toPreviewText(d.preview || d.content || "");

  switch (t) {
    // 글
    case "post_create":     return `글 작성: ‘${postLabel}’`;
    case "post_update":     return `글 수정: ‘${postLabel}’`;
    case "post_delete":     return `글 삭제: ‘${postLabel}’`;
    case "post_like":       return d.on ? `‘${postLabel}’에 좋아요` : `‘${postLabel}’ 좋아요 취소`;
    case "post_bookmark":   return d.on ? `‘${postLabel}’ 북마크`   : `‘${postLabel}’ 북마크 해제`;

    // 레시피 찜
    case "favorite_add":    return `레시피 ‘${recipeLabel}’ 저장`;
    case "favorite_remove": return `레시피 ‘${recipeLabel}’ 저장 해제`;

    // ✅ 댓글
    case "comment_create":
    case "comment_add":
      return preview ? `‘${postLabel}’에 댓글: ${preview}` : `‘${postLabel}’에 댓글 작성`;
    case "comment_update":
      return preview ? `‘${postLabel}’ 댓글 수정: ${preview}` : `‘${postLabel}’ 댓글 수정`;
    case "comment_delete":
      return `‘${postLabel}’ 댓글 삭제`;
    case "comment_like":
      return d.on ? "댓글에 좋아요" : "댓글 좋아요 취소";

    default:
      return d.title ? `${t} · ${d.title}` : String(t || "활동");
  }
}

/** 현재 로그인 계정의 활동만 초기화 (레거시 키도 함께 제거) */
export function clearActivities() {
  const n = ns();
  if (!hasStorage()) return;
  try {
    if (n) localStorage.removeItem(keyFor(n));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}
