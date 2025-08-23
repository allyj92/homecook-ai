// src/api/index.js
import axios from "axios";

// Netlify Functions만 호출
export async function requestRecommend(payload) {
  const { data } = await axios.post("/.netlify/functions/recommend", payload, { timeout: 90_000 });
  return data;
}

export async function requestRecommendTop(payload, n = 3) {
  const { data } = await axios.post("/.netlify/functions/recommendTop", { ...payload, n }, { timeout: 90_000 });
  return data;
}