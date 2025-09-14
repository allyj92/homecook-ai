/* eslint-env node */
export async function handler(event) {
  // CORS 전용(여기에 Content-Type 넣지 말기!)
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS };
    }
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "POST only" }),
      };
    }

    const BACKEND = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
    const API_PREFIX = (process.env.BACKEND_API_PREFIX ?? "/api").replace(/\/+$/, "");
    if (!BACKEND) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "BACKEND_URL is not configured" }),
      };
    }

    const url = `${BACKEND}${API_PREFIX}/recommendTop`;

    // 클라이언트 → 백엔드로 쿠키/인증 포워딩(세션 사용하는 경우 중요)
    const h = event.headers || {};
    const upstreamHeaders = {
      "Content-Type": "application/json",
      Accept: h["accept"] || "application/json, text/plain, */*",
      Cookie: h["cookie"] || "",
      Authorization: h["authorization"] || "",
      "User-Agent": h["user-agent"] || "netlify-fn",
      // 필요 시 X-Forwarded-For 등 추가 가능
    };

    // 타임아웃 제어(90초)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    const res = await fetch(url, {
      method: "POST",
      headers: upstreamHeaders,
      body: event.body ?? "{}",
      signal: controller.signal,
    });

    const text = await res.text();
    clearTimeout(timeout);

    // 업스트림 Content-Type 그대로 사용(없다면 내용으로 추정)
    const upstreamCT = res.headers.get("content-type") || "";
    const contentType =
      upstreamCT ||
      ((text.trim().startsWith("{") || text.trim().startsWith("[")) ?
        "application/json; charset=utf-8" :
        "text/plain; charset=utf-8");

    return {
      statusCode: res.status,
      headers: { ...CORS, "Content-Type": contentType },
      body: text || (res.statusText ?? ""),
    };
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Upstream timeout" : (e?.message || "Server error");
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: msg, code: e?.name || "Error" }),
    };
  }
}
