// src/api/community.js
import { apiFetch, buildUrl } from '../lib/http';

/** 글 생성 */
export async function createCommunityPost(payload) {
  const res = await apiFetch('/api/community/posts', {
    method: 'POST',
    body: payload, // JSON이면 apiFetch가 Content-Type 지정 + stringify
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`글 생성 실패: ${res.status} ${t}`);
  }
  return res.json(); // { id }
}

/** 글 단건 조회 */
export async function getCommunityPost(id) {
  const res = await apiFetch(`/api/community/posts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('글 조회 실패');
  return res.json();
}

/** 내가 쓴 글 (최신 N) */
export async function getMyPosts(size = 3) {
  const res = await apiFetch(`/api/community/my-posts?size=${encodeURIComponent(size)}`, {
    // apiFetch가 credentials: 'include' 로 쿠키 자동 포함
    cache: 'no-store',
  });
  if (!res.ok) {
    // 401이면 프론트에서 이미 로그인 처리 루틴이 있으니 여기선 빈 배열
    return [];
  }
  return res.json(); // [{ id, title, category, createdAt, youtubeId, repImageUrl, tags }]
}

/* (선택) API 엔드포인트 확인용 디버그 */
export function communityApiDebug() {
  return {
    createUrl: buildUrl('/api/community/posts'),
    getUrl: (id) => buildUrl(`/api/community/posts/${id}`),
  };

}

export async function getMyPosts(size = 3) {
  const res = await http.get(`/api/community/posts/mine?size=${encodeURIComponent(size)}`, { noAuthRedirect: true });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`내 글 조회 실패: ${res.status} ${text}`);
  }
  return res.json(); // [{ id, title, category, content, tags, authorId, createdAt, updatedAt, youtubeId, repImageUrl }]
}

