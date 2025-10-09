// CommonJS 형태 (Netlify Functions 기본)
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  try {
    const target = new URLSearchParams(event.queryStringParameters || {}).get('u');
    if (!target) return { statusCode: 400, body: 'Missing u' };

    const r = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return { statusCode: r.status, body: 'fetch fail' };

    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || 'image/jpeg';
    return {
      statusCode: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'proxy error' };
  }
};
