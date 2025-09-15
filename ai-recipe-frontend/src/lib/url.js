// 동일 호스트면 상대경로로 바꿔 혼합콘텐츠/포트 이슈 제거
export function normalizeCoverUrl(url) {
  if (!url) return null;
  try {
    if (url.startsWith('/')) return url; // 이미 상대경로
    const u = new URL(url);
    const here = window.location;

    if (u.host === here.host) {
      // 같은 호스트면 프로토콜 이슈 제거 위해 상대경로로
      return u.pathname + u.search + u.hash;
    }

    // 페이지가 https인데 이미지가 http면 업그레이드 시도
    if (here.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
      return u.toString();
    }

    return url; // 다른 도메인이며 http->https 업그레이드 불가 시 그대로
  } catch (_) {
    return url;
  }
}
