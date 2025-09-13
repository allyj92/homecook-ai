// src/api/community.js
import { http, buildUrl } from '../lib/http';

/** 글 생성 (youtubeUrl, repImageUrl 포함해도 그대로 전달됨) */
export async function createCommunityPost(payload) {
  // payload: { title, category, content, tags, youtubeUrl?, repImageUrl? }
  const res = await http.post('/api/community/posts', payload);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`글 등록 실패: ${res.status} ${text}`);
  }
  // { id }
  return res.json();
}

/** 글 단건 조회 */
export async function getCommunityPost(id) {
  const res = await http.get(`/api/community/posts/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`글 조회 실패: ${res.status} ${text}`);
  }
  return res.json();
}

/* (선택) API 엔드포인트 확인용 디버그 */
export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${id}`),
  };
}
