// netlify/functions/recommend.js
/* eslint-env node */

// 간단 백오프
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// CORS 전용 헤더 (여기에 Content-Type 넣지 않음!)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler = async (event) => {
  try {
    // CORS 프리플라이트
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS };
    }

    // 메서드 제한
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "POST only" }),
      };
    }

    const BASE = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
    if (!BASE) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "BACKEND_URL is not configured" }),
      };
    }

    const backendUrl = `${BASE}/api/recommend`;
    const body = event.body ?? "{}";

    // 타임아웃
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 90_000);

    // 최대 1회 재시도
    let lastErr;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const resp = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });

        const text = await resp.text();
        clearTimeout(t);

        // 업스트림 Content-Type 그대로 사용 (없으면 내용으로 추정)
        const upstreamCT = resp.headers.get("content-type") || "";
        const contentType = upstreamCT
          ? upstreamCT
          : (text.trim().startsWith("{") || text.trim().startsWith("["))
            ? "application/json; charset=utf-8"
            : "text/plain; charset=utf-8";

        return {
          statusCode: resp.status,
          headers: { ...CORS, "Content-Type": contentType },
          body: text || (resp.statusText ? resp.statusText : ""),
        };
      } catch (e) {
        lastErr = e;
        if (e?.name === "AbortError") break;
        if (attempt === 0) await wait(300);
      }
    }

    clearTimeout(t);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        message: lastErr?.message || "Proxy error",
        code: lastErr?.name || "ProxyError",
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: e.message || "Server error" }),
    };
  }
};
