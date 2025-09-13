import { apiFetch, buildUrl } from './http';

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch(buildUrl('/api/uploads'), { method: 'POST', body: fd });
  if (!res.ok) {
    const t = await res.text().catch(()=> '');
    throw new Error(`업로드 실패: ${res.status} ${t}`);
  }
  return res.json(); // { url, name, size, type }
}

export function ytThumb(youtubeId, quality='hqdefault') {
  return youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg` : null;
}
