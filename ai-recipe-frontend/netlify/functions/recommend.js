// netlify/functions/recommend.js
/* eslint-env node */

// ──────────────────────────────────────────────
// CORS 헤더 (여기에 Content-Type 넣지 않음!)
// ──────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Expose-Headers":
    // 디버그 확인용 헤더를 브라우저에서 볼 수 있게 노출
    "x-upstream-status, x-upstream-content-type, x-upstream-url, x-proxy",
};

// 간단 백오프
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const API_PREFIX = (process.env.BACKEND_API_PREFIX || "/api").replace(/\/+$/, "");

    if (!BASE) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: "BACKEND_URL is not configured" }),
      };
    }

    const backendUrl = `${BASE}${API_PREFIX}/recommend`;
    const body = event.body ?? "{}";

    // 타임아웃 제어
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    let lastErr;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        // 리다이렉트는 직접 판단하려고 manual 로 받음
        const resp = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/plain, */*" },
          body,
          signal: controller.signal,
          redirect: "manual",
        });

        // 리다이렉트면 HTML로 갈 확률이 높으니 그대로 전달하되 JSON 에러로도 잡아낼 수 있게 함
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get("location") || "";
          clearTimeout(timeout);
          return {
            statusCode: 502,
            headers: {
              ...CORS,
              "Content-Type": "application/json; charset=utf-8",
              "x-upstream-status": String(resp.status),
              "x-upstream-content-type": resp.headers.get("content-type") || "",
              "x-upstream-url": backendUrl,
              "x-proxy": "recommend.fn",
              // 참고용으로 Location 도 그대로 노출
              Location: location,
            },
            body: JSON.stringify({
              error: "UpstreamRedirect",
              status: resp.status,
              location,
              message: "Upstream responded with a redirect",
            }),
          };
        }

        const raw = await resp.text();
        clearTimeout(timeout);

        // ── Content-Type 판단 로직 ─────────────────
        const upstreamCT = (resp.headers.get("content-type") || "").toLowerCase();

        const looksJson = /^\s*[\[{]/.test(raw);
        const looksHtml = /<!doctype\s+html|<html[\s>]/i.test(raw) || /^\s*</.test(raw);

        // 기본은 업스트림 CT, 단 body 모양이 확실하면 바꿔줌(axios 자동 JSON 파싱 오판 방지)
        let contentType;
        if (looksHtml) {
          contentType = "text/html; charset=utf-8";
        } else if (looksJson) {
          contentType = "application/json; charset=utf-8";
        } else if (upstreamCT) {
          contentType = upstreamCT;
        } else {
          contentType = "text/plain; charset=utf-8";
        }

        // 최종 응답
        return {
          statusCode: resp.status,
          headers: {
            ...CORS,
            "Content-Type": contentType,
            "x-upstream-status": String(resp.status),
            "x-upstream-content-type": upstreamCT,
            "x-upstream-url": backendUrl,
            "x-proxy": "recommend.fn",
          },
          body:
            raw ||
            (resp.statusText
              ? resp.statusText
              : contentType.startsWith("application/json")
              ? "{}"
              : ""),
        };
      } catch (e) {
        lastErr = e;
        if (e?.name === "AbortError") break;
        if (attempt === 0) await wait(300);
      }
    }

    clearTimeout(timeout);
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