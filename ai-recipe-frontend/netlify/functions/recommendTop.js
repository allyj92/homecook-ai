/* eslint-env node */
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
    if (event.httpMethod !== "POST")
      return { statusCode: 405, headers, body: JSON.stringify({ message: "POST only" }) };

    const BACKEND = (process.env.BACKEND_URL || "").replace(/\/+$/,"");
    const API_PREFIX = (process.env.BACKEND_API_PREFIX ?? "/api").replace(/\/+$/,"");

    if (!BACKEND) throw new Error("BACKEND_URL is not configured");

    const url = `${BACKEND}${API_PREFIX}/recommendTop`;

    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body,
    });

    const text = await res.text();
    return { statusCode: res.status, headers, body: text };
  } catch (e) {
    console.error("[functions/recommendTop] error:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ message: e.message || "Server error" }) };
  }
}
