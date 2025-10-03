/* 숫자 ID만 허용 */
function isNumericId(id) {
  return typeof id === 'string' && /^[0-9]{1,19}$/.test(id);
}

/* 키 생성기 */
export const bmKey = (uid, provider, id) => `postBookmark:${uid}:${provider}:${id}`;
export const bmDataKey = (uid, provider, id) => `postBookmarkData:${uid}:${provider}:${id}`;

/* 레거시 → 신규 마이그레이션 */
export function adoptLegacyBookmarks(uid, provider) {
  if (!uid || !provider) return;
  try {
    const toMove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('postBookmark:') || k.startsWith('postBookmarkData:')) {
        const parts = k.split(':');
        if (parts.length === 2 || parts.length === 3) toMove.push(k);
      }
    }
    toMove.forEach((k) => {
      const v = localStorage.getItem(k);
      const parts = k.split(':');
      const prefix = parts[0];
      let id = null;
      if (parts.length === 2) id = parts[1];
      else if (parts.length === 3) id = parts[2];
      if (id && isNumericId(String(id))) {
        const newKey = `${prefix}:${uid}:${provider}:${id}`;
        if (v != null) localStorage.setItem(newKey, v);
      }
      localStorage.removeItem(k);
    });
  } catch {}
}

/* 북마크 불러오기 */
export function loadBookmarksFromLS(uid, provider) {
  if (!uid || !provider) return [];
  const list = [];
  try {
    const ns = `postBookmark:${uid}:${provider}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(ns)) continue;
      if (localStorage.getItem(key) !== '1') continue;

      const parts = key.split(':');
      if (parts.length !== 4) continue;
      const id = parts[3];
      if (!isNumericId(String(id))) continue;

      const dataKey = bmDataKey(uid, provider, id);
      let meta = null;
      const raw = localStorage.getItem(dataKey);
      if (raw) {
        try { meta = JSON.parse(raw); } catch {}
      }
      list.push({ id: String(id), ...(meta || {}) });
    }
    list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  } catch {}
  return list;
}