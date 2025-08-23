// netlify/functions/recommend.js

// ⚙️ 환경변수 예시: https://api.yourdomain.com  (뒤에 슬래시 금지)
// Netlify > Site settings > Environment variables > BACKEND_URL
const BASE = process.env.BACKEND_URL;

// 간단한 지연 함수(재시도 간 백오프)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  // CORS 프리플라이트
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  // 메서드 제한
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: "POST only" }),
    };
  }

  // 환경변수 체크
  if (!BASE) {
    console.error("[functions/recommend] BACKEND_URL is not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "BACKEND_URL is not configured" }),
    };
  }

  // 컨트롤러 경로 고정 매핑
  const backendUrl = `${BASE.replace(/\/+$/, "")}/api/recommend`;

  // 요청 바디 (그대로 프록시, 비어있으면 {})
  const body = event.body ?? "{}";

  // 타임아웃 컨트롤 (Netlify Node 18에서는 AbortController 사용 가능)
  const controller = new AbortController();
  const timeoutMs = 90_000; // 프론트 axios와 맞춤(90s)
  const t = setTimeout(() => controller.abort(), timeoutMs);

  // 최대 2회 재시도(일시적 네트워크/게이트웨이 오류 대비)
  const maxRetries = 1;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      // 응답 원문을 그대로 전달 (JSON/텍스트 상관없이)
      const text = await resp.text();

      // 4xx/5xx도 그대로 상태코드 유지해 반환하되, 백엔드 메시지가 있으면 그대로 전달
      // 프런트에서 에러 이유를 확인할 수 있도록 body는 가능한 백엔드 원문을 유지
      clearTimeout(t);
      return {
        statusCode: resp.status,
        headers,
        body: text || JSON.stringify({ message: resp.statusText || "Upstream empty response" }),
      };
    } catch (e) {
      lastError = e;
      console.error(
        `[functions/recommend] attempt=${attempt} error=`,
        e?.name,
        e?.message
      );
      if (e?.name === "AbortError") {
        // 타임아웃이면 즉시 중단
        break;
      }
      if (attempt < maxRetries) {
        // 간단 백오프
        await wait(300);
        continue;
      }
    }
  }

  clearTimeout(t);
  // 최종 실패 시 프록시 에러 반환
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      message: lastError?.message || "Proxy error",
      code: lastError?.name || "ProxyError",
    }),
  };
};
