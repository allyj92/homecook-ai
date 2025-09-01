// netlify/functions/communityCreate.js
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "https://recipfree.com", // 프론트 오리진으로 제한 권장
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ message: "POST only" }) };

  const BASE = process.env.BACKEND_URL || "";
  if (!BASE) {
    // 임시 스텁
    return { statusCode: 200, headers, body: JSON.stringify({ id: 123 }) };
  }

  const url = `${BASE.replace(/\/+$/, "")}/api/community/posts`;

  // ★ 쿠키/토큰 포워딩
  const fwdHeaders = { "Content-Type": "application/json" };
  if (event.headers?.cookie)        fwdHeaders.Cookie = event.headers.cookie;
  if (event.headers?.authorization) fwdHeaders.Authorization = event.headers.authorization;

  try {
    const r = await fetch(url, { method: "POST", headers: fwdHeaders, body: event.body || "{}" });
    const text = await r.text();
    return { statusCode: r.status, headers, body: text };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ message: "proxy error", detail: String(e) }) };
  }
};