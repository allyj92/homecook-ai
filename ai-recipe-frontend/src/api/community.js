// src/api/community.js
import axios from "axios";

// 백엔드 베이스 (예: https://api.yourdomain.com)
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/**
 * 글 생성
 * @param {{title:string, category:string, tags:string[], content:string}} payload
 * @returns {{id:number}}
 */
export async function createCommunityPost(payload) {
  // 백엔드 직접 호출 (권장)
  if (BASE) {
    const { data } = await axios.post(`${BASE}/api/community/posts`, payload, {
      withCredentials: true, // 세션 쿠키 포함 (도메인 분리 시 필요)
      timeout: 30000,
    });
    return data;
  }

  // Netlify Functions 브릿지 (VITE_API_BASE 없을 때)
  const { data } = await axios.post(
    "/.netlify/functions/communityCreate",
    payload,
    { timeout: 30000 }
  );
  return data;
}
