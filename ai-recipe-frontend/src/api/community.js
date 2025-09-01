// src/api/community.js
import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/**
 * 글 생성
 * @param {{title:string, category:string, tags:string[], content:string}} payload
 * @returns {{id:number}}
 */
export async function createCommunityPost(payload) {
  // 백엔드 직접 호출 (VITE_API_BASE가 설정된 경우)
  if (BASE) {
    const url = `${BASE}/api/community/posts`;
    const { data } = await axios.post(url, payload, {
      withCredentials: true,
      timeout: 30000,
    });
    return data; // { id }
  }
  // Netlify Functions 브릿지 (VITE_API_BASE가 없으면)
  const fUrl = "/.netlify/functions/communityCreate";
  const { data } = await axios.post(fUrl, payload, { timeout: 30000 });
  return data; // { id }
}
