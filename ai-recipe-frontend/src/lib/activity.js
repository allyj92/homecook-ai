// src/lib/activity.js
const LS_KEY = "activityLog:v1";
const EVT = "activity:changed";
const MAX = 300;

/** 내부: 로컬스토리지에서 배열 읽기 */
function readRaw() {
  try {
    const s = localStorage.getItem(LS_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 내부: 배열을 로컬스토리지에 저장 */
function writeRaw(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, MAX)));
    window.dispatchEvent(new Event(EVT));
  } catch {}
}

/** 활동 기록 추가 */
export function logActivity(type, payload = {}) {
  const now = Date.now();
  const item = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    type,            // 예: "post_like", "post_bookmark", "comment_create", "favorite_remove"
    ts: now,         // timestamp (ms)
    data: payload,   // 화면에 쓸 부가 정보 (title, postId 등)
  };

  const arr = readRaw();
  arr.unshift(item);          // 최신이 앞으로
  writeRaw(arr);
}

/** 활동 목록 가져오기 (최신순) */
export function listActivities(limit = 50) {
  const arr = readRaw();
  arr.sort((a, b) => b.ts - a.ts);
  return arr.slice(0, limit);
}

/** 변경 이벤트 구독 (크로스 탭/윈도우 포함) */
export function subscribeActivity(handler) {
  const lsHandler = (e) => {
    if (e && e.key && e.key !== LS_KEY) return;
    handler();
  };
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", lsHandler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", lsHandler);
  };
}

/** UI용 텍스트 생성 헬퍼 (원하면 수정) */
export function formatActivityText(a) {
  const t = a?.type;
  const d = a?.data || {};
  if (t === "post_like")       return d.on ? `‘${d.title ?? "게시글"}’에 좋아요` : `‘${d.title ?? "게시글"}’ 좋아요 취소`;
  if (t === "post_bookmark")   return d.on ? `‘${d.title ?? "게시글"}’ 북마크` : `‘${d.title ?? "게시글"}’ 북마크 해제`;
  if (t === "comment_create")  return `‘${d.title ?? "게시글"}’에 댓글 작성`;
  if (t === "favorite_add")    return `레시피 ‘${d.title ?? d.recipeId ?? ""}’ 저장`;
  if (t === "favorite_remove") return `레시피 ‘${d.title ?? d.recipeId ?? ""}’ 저장 해제`;
  return d.title ? `${t} · ${d.title}` : t;
}
