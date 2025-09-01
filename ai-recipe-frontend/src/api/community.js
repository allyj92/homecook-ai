import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/** 단건 조회 */
export async function getCommunityPost(id) {
  // 백엔드 직접 호출
  if (BASE) {
    const { data } = await axios.get(`${BASE}/api/community/posts/${id}`, {
      withCredentials: true,
      timeout: 30000,
    });
    return data; // { id, title, category, content, tags, authorId, createdAt, updatedAt }
  }
  // Netlify Functions 브릿지
  const { data } = await axios.get(
    `/.netlify/functions/communityGet?id=${encodeURIComponent(id)}`,
    { timeout: 30000 }
  );
  return data;
}
