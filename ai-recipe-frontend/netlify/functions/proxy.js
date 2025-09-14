/* eslint-env node */

// Netlify Functions (Node 18) — ESM 스타일
// package.json에 "type": "module" 이 없으면 파일 확장자를 recommendTop.mjs 로 바꾸세요.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildCorsHeaders(origin) {
  // same-origin 호출이면 굳이 CORS가 필요 없지만,
  // 혹시 다른 오리진에서 부르면 요청 Origin을 에코해주는 편이 안전합니다.
  return {
    "Access-Control-Allow-Origin": origin || "https://recipfree.com",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function handler(event) {
  const origin = event.headers?.origin;
  const headers = buildCorsHeaders(origin);

  try {
    // CORS 프리플라이트
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ message: "POST only" }),
      };
    }

    const BACKEND = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
    const API_PREFIX = (process.env.BACKEND_API_PREFIX ?? "/api").replace(/\/+$/, "");
    if (!BACKEND) throw new Error("BACKEND_URL is not configured");

    const url = `${BACKEND}${API_PREFIX}/recommendTop`;

    // --------- 타임아웃 + 재시도 ----------
    const controller = new AbortController();
    const timeoutMs = 90_000; // 프런트 axios와 맞춤
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const maxRetries = 1;
    let lastErr;

    // 요청 바디는 원문 그대로 넘깁니다(프런트에서 JSON.stringify 된 상태)
    const reqBody = event.body ?? "{}";

    // 인증이 필요한 엔드포인트를 대비해, 브라우저가 보낸 쿠키/Authorization을 백엔드로 포워딩
    // (recommendTop이 비로그인 허용이면 없어도 됩니다. 넣어도 무해)
    const fwdHeaders = {
      "Content-Type": "application/json",
    };
    if (event.headers?.cookie) {
      // 예: RFSESSIONID=... 등의 세션 쿠키가 백엔드에서 재사용됩니다.
      fwdHeaders["Cookie"] = event.headers.cookie;
    }
    if (event.headers?.authorization) {
      fwdHeaders["Authorization"] = event.headers.authorization;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[functions/recommendTop] POST ${url} attempt=${attempt}`);
        const resp = await fetch(url, {
          method: "POST",
          headers: fwdHeaders,
          body: reqBody,
          signal: controller.signal,
        });

        const contentType = resp.headers.get("content-type") || "";
        const text = await resp.text();

        // 상태/본문을 그대로 전달
        clearTimeout(timeoutId);
        if (resp.status >= 400) {
          // 디버깅용 로그 (길면 일부만)
          console.error(
            "[functions/recommendTop] upstream error",
            resp.status,
            (text || "").slice(0, 500)
          );
        }
        return {
          statusCode: resp.status,
          headers: {
            ...headers,
            "Content-Type":
              contentType || "application/json; charset=utf-8",
          },
          body: text || JSON.stringify({ message: resp.statusText || "Upstream empty response" }),
        };
      } catch (e) {
        lastErr = e;
        console.error(
          `[functions/recommendTop] attempt=${attempt} error:`,
          e?.name,
          e?.message
        );
        if (e?.name === "AbortError") break; // 타임아웃
        if (attempt < maxRetries) {
          await wait(300);
          continue;
        }
      }
    }

    clearTimeout(timeoutId);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: lastErr?.message || "Proxy error",
        code: lastErr?.name || "ProxyError",
      }),
    };
  } catch (e) {
    console.error("[functions/recommendTop] fatal:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: e?.message || "Server error" }),
    };
  }
}
