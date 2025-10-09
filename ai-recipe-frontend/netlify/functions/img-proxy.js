// /.netlify/functions/img-proxy.js
// CommonJS (Netlify Functions 기본). node-fetch v3 동적 import
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const { URL } = require('url');
const { AbortController } = require('abort-controller');

// --- 설정값 ---
const TIMEOUT_MS = 8000;          // 8초 타임아웃
const MAX_BYTES = 5 * 1024 * 1024; // 5MB 상한
const MAX_REDIRECTS = 3;

// 허용 스킴
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

// (선택) 호스트 허용목록이 필요하면 채우세요. 비워두면 전체 허용(사설IP/로컬 제외)
const ALLOWLIST_HOSTS = new Set([
  // 'images.example.com',
  // 'i.ytimg.com',
]);

// 사설/로컬 대역 차단용 정규식 (hostname이 IP인 경우만 필터 가능)
// 도메인이 사설 IP로 해석되는 공격은 런타임에서 DNS 확인이 필요하지만, 여기서는 최소 차단만 수행
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const LOCALHOST_RE = /^(localhost|\.?local|\.?internal)$/i;

function badRequest(msg) {
  return { statusCode: 400, body: msg || 'Bad Request' };
}

function forbidden(msg) {
  return { statusCode: 403, body: msg || 'Forbidden' };
}

function notFound() {
  return { statusCode: 404, body: 'Not Found' };
}

function upstreamError(code, msg) {
  return { statusCode: code || 502, body: msg || 'Upstream error' };
}

function serverError(msg) {
  return { statusCode: 500, body: msg || 'Server Error' };
}

function okBinary(bodyBuf, headers = {}) {
  return {
    statusCode: 200,
    headers: {
      // CORS (이미지 용도면 *로 충분. 필요시 특정 오리진만 허용)
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Origin',
      // 캐시
      'Cache-Control': 'public, max-age=86400',
      ...headers,
    },
    body: bodyBuf.toString('base64'),
    isBase64Encoded: true,
  };
}

// 파일명 유추(옵션)
function filenameFromUrl(u) {
  try {
    const pathname = new URL(u).pathname || '';
    const base = pathname.split('/').pop() || 'image';
    return base.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  } catch {
    return 'image';
  }
}

exports.handler = async (event) => {
  try {
    // 프리플라이트 대응 (필요한 경우)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,If-Modified-Since,If-None-Match',
          'Vary': 'Origin',
          'Cache-Control': 'public, max-age=86400',
        },
      };
    }

    if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      return badRequest('Only GET/HEAD');
    }

    const targetRaw = new URLSearchParams(event.queryStringParameters || {}).get('u');
    if (!targetRaw) return badRequest('Missing u');

    let target;
    try {
      target = new URL(targetRaw);
    } catch {
      return badRequest('Invalid URL');
    }

    // 스킴 제한
    if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
      return forbidden('Protocol not allowed');
    }

    // 사설/로컬 차단(호스트가 숫자 IP일 때만 확실히 차단 가능)
    // 도메인 -> 사설IP 해석은 여기서 검증 불가(서버측 DNS 검사 필요)
    const hostLower = target.hostname.toLowerCase();
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostLower);
    if (isIp && PRIVATE_IP_RE.test(hostLower)) {
      return forbidden('Private network not allowed');
    }
    if (LOCALHOST_RE.test(hostLower)) {
      return forbidden('Localhost not allowed');
    }

    // (선택) 허용목록 체크
    if (ALLOWLIST_HOSTS.size > 0 && !ALLOWLIST_HOSTS.has(hostLower)) {
      return forbidden('Host not allowed');
    }

    // 업스트림 요청
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // ETag/Last-Modified 조건부 요청 패스스루(캐시 효율↑)
    const condHeaders = {};
    const reqHeaders = event.headers || {};
    if (reqHeaders['if-none-match']) condHeaders['if-none-match'] = reqHeaders['if-none-match'];
    if (reqHeaders['if-modified-since']) condHeaders['if-modified-since'] = reqHeaders['if-modified-since'];

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      follow: MAX_REDIRECTS,
      signal: controller.signal,
      // 이미지 친화 헤더만 전송(민감 헤더 제거)
      headers: {
        'User-Agent': 'Mozilla/5.0 (img-proxy/1.0; +https://netlify.com/)',
        'Accept': 'image/*,*/*;q=0.8',
        ...condHeaders,
      },
    }).finally(() => clearTimeout(timer));

    // 304 패스스루
    if (upstream.status === 304) {
      return {
        statusCode: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Vary': 'Origin, If-None-Match, If-Modified-Since',
          'Cache-Control': 'public, max-age=86400',
          'ETag': upstream.headers.get('etag') || undefined,
          'Last-Modified': upstream.headers.get('last-modified') || undefined,
        },
      };
    }

    if (!upstream.ok) {
      // 4xx/5xx 원상 전달(민감 바디 제거)
      return upstreamError(upstream.status, `Upstream ${upstream.status}`);
    }

    // MIME 검사: 이미지만 허용
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      // svg는 text/xml로 오는 경우가 있어서 보정
      const isSvg = target.pathname.toLowerCase().endsWith('.svg');
      if (!isSvg) return forbidden('Only image content allowed');
    }

    // 크기 제한: 스트리밍으로 누적하다가 상한 초과 시 중단
    const reader = upstream.body;
    const chunks = [];
    let bytesRead = 0;

    // node-fetch v3는 WHATWG ReadableStream. async iterator 지원
    try {
      for await (const chunk of reader) {
        bytesRead += chunk.length;
        if (bytesRead > MAX_BYTES) {
          // 스트림 중단
          reader.destroy?.();
          return upstreamError(413, 'Payload Too Large');
        }
        chunks.push(chunk);
      }
    } catch (e) {
      return upstreamError(502, 'Upstream stream error');
    }

    const buf = Buffer.concat(chunks);

    // 응답 헤더 구성
    const hdrs = {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': String(buf.length),
      'ETag': upstream.headers.get('etag') || undefined,
      'Last-Modified': upstream.headers.get('last-modified') || undefined,
      // inline 표시 + 파일명 힌트
      'Content-Disposition': `inline; filename="${filenameFromUrl(target.toString())}"`,
    };

    return okBinary(buf, hdrs);
  } catch (e) {
    const msg = (e && e.name === 'AbortError') ? 'Timeout' : 'proxy error';
    return serverError(msg);
  }
};
