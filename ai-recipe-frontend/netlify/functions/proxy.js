// netlify/functions/proxy.js
export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "https://recipfree.com", // ★ '*' 금지
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

  // 클라이언트의 쿠키를 백엔드로 전달
  const cookie = event.headers.cookie || "";

  const resp = await fetch("https://recipfree.com/api/auth/me", {
    method: "GET",
    headers: { Cookie: cookie },
  });

  // 백엔드의 Set-Cookie를 그대로 통과시켜야 함
  const setCookie = resp.headers.get("set-cookie");
  if (setCookie) headers["Set-Cookie"] = setCookie;

  const body = await resp.text();
  return { statusCode: resp.status, headers: { ...headers, "Content-Type": "application/json" }, body };
};
