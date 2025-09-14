// src/lib/activity.js
const LS_KEY = "activityLog:v1";
const EVT = "activity:changed";
const MAX = 300;

/** 안전 가드 */
function hasStorage() {
  try { return typeof window !== "undefined" && !!window.localStorage; } catch { return false; }
}
function nowMs() { return Date.now ? Date.now() : new Date().getTime(); }

/** 내부: 로컬스토리지에서 배열 읽기 */
function readRaw() {
  if (!hasStorage()) return [];
  try {
    const s = localStorage.getItem(LS_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 내부: 배열을 로컬스토리지에 저장 (용량 초과 시 오래된 항목 제거 후 재시도) */
function writeRaw(arr) {
  if (!hasStorage()) return;
  const sorted = (arr || [])
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0))
    .slice(0, MAX);

  const trySave = () => localStorage.setItem(LS_KEY, JSON.stringify(sorted));
  try {
    trySave();
  } catch (e) {
    // 용량 초과 등: 뒤에서부터 버리며 최대 3회 재시도
    let tmp = sorted.slice();
    for (let i = 0; i < 3 && tmp.length > 0; i++) {
      tmp.pop();
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(tmp));
        break;
      } catch {}
    }
  }
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}

/** 활동 기록 추가 */
export function logActivity(type, payload = {}) {
  const ts = nowMs();
  const item = {
    id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    type,            // 예: "post_like", "post_bookmark", "comment_create", "favorite_remove", "post_create" 등
    ts,              // timestamp (ms)
    data: payload,   // 화면용 부가 정보 (title, postId, recipeId, on 등)
  };

  const arr = readRaw();

  // 같은 id가 이미 있으면 제거(희박하지만 방어)
  const dedup = arr.filter(a => a?.id !== item.id);
  dedup.unshift(item); // 최신이 앞으로
  writeRaw(dedup);
}

/** 활동 목록 가져오기 (최신순) */
export function listActivities(limit = 50) {
  const arr = readRaw()
    .filter(Boolean)
    .sort((a, b) => (b?.ts || 0) - (a?.ts || 0));
  return arr.slice(0, Math.max(0, limit | 0));
}

/** 변경 이벤트 구독 (동일 탭: 커스텀 EVT, 다른 탭: storage) */
export function subscribeActivity(handler) {
  const safeHandler = () => { try { handler(); } catch {} };
  const lsHandler = (e) => {
    // 다른 탭에서 변경된 경우만 들어옴. 키가 없으면(전체 clear 등)도 갱신.
    if (!e || (e.key && e.key !== LS_KEY)) return;
    safeHandler();
  };
  window.addEventListener(EVT, safeHandler);
  window.addEventListener("storage", lsHandler);
  return () => {
    window.removeEventListener(EVT, safeHandler);
    window.removeEventListener("storage", lsHandler);
  };
}

/** UI용 텍스트 생성 헬퍼 */
export function formatActivityText(a) {
  const t = a?.type;
  const d = a?.data || {};
  const postLabel =
    d.title ??
    (d.postId != null ? `게시글 #${d.postId}` : "게시글");
  const recipeLabel =
    d.title ??
    (d.recipeId != null ? `#${d.recipeId}` : "");

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
    default:
      // 알 수 없는 타입은 안전하게 포맷
      return d.title ? `${t} · ${d.title}` : String(t || "활동");
  }
}

/** (선택) 전체 활동 초기화 */
export function clearActivities() {
  if (!hasStorage()) return;
  try { localStorage.removeItem(LS_KEY); } catch {}
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}
