// src/api/community.js
import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

/** 글 생성 */
export async function createCommunityPost(payload) {
  if (BASE) {
    const url = `${BASE}/api/community/posts`;
    const { data } = await axios.post(url, payload, {
      withCredentials: true,
      timeout: 30000,
    });
    return data; // { id }
  }
  const fUrl = "/.netlify/functions/communityCreate";
  const { data } = await axios.post(fUrl, payload, { timeout: 30000 });
  return data; // { id }
}

/** 글 단건 조회 */
export async function getCommunityPost(id) {
  if (BASE) {
    const { data } = await axios.get(`${BASE}/api/community/posts/${id}`, {
      withCredentials: true,
      timeout: 30000,
    });
    return data; // { id, title, category, content, ... }
  }
  const { data } = await axios.get(
    `/.netlify/functions/communityGet?id=${encodeURIComponent(id)}`,
    { timeout: 30000 }
  );
  return data;
}
