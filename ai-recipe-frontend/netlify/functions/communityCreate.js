// netlify/functions/communityCreate.js
const BASE = process.env.BACKEND_URL; // 예: https://api.yourdomain.com  (뒤에 슬래시 X)

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ message: "POST only" }) };
  }
  if (!BASE) {
    return { statusCode: 500, headers, body: JSON.stringify({ message: "BACKEND_URL is not configured" }) };
  }

  const url = `${BASE.replace(/\/+$/,"")}/api/community/posts`;
  try {
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: event.body });
    const data = await resp.json();
    return { statusCode: resp.status, headers, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ message: "proxy error", detail: String(e) }) };
  }
}
