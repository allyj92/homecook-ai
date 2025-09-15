// src/lib/upload.js
// 이미지 파일을 브라우저에서 축소/압축 + (선택) 자동 가로 회전 후 업로드합니다.
import { apiFetch } from './http';

/* =========================
 * 설정값 (필요 시 조절)
 * ========================= */
// 축소 목표 최대 크기(px)
const MAX_WIDTH  = 1600;
const MAX_HEIGHT = 1600;

// 전송 목표 최대 바이트(압축 반복의 목표치)
const TARGET_BYTES = 2 * 1024 * 1024; // 2MB

// 안전 상한(이 크기 넘으면 업로드 시작 전 에러)
const HARD_LIMIT_BYTES = 8 * 1024 * 1024; // 8MB

// JPEG 압축 품질 범위
const JPEG_QUALITY_MAX = 0.9;
const JPEG_QUALITY_MIN = 0.6;

// 세로 사진을 자동으로 가로로 회전할지 여부(기본 on)
const FORCE_LANDSCAPE = true;

/* =========================
 * 유틸
 * ========================= */
function isImage(file) {
  return file && typeof file.type === 'string' && file.type.startsWith('image/');
}

function loadImageBitmap(blob) {
  // EXIF 회전을 반영(가능한 브라우저에서)
  if ('createImageBitmap' in window) {
    try {
      return createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch { /* fallback */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 불러오지 못했습니다.')); };
    img.src = url;
  });
}

function computeTargetSize(sw, sh, maxW = MAX_WIDTH, maxH = MAX_HEIGHT) {
  let tw = sw, th = sh;
  if (tw > maxW || th > maxH) {
    const s = Math.min(maxW / tw, maxH / th);
    tw = Math.round(tw * s);
    th = Math.round(th * s);
  }
  return { tw, th };
}

function blobFromCanvas(canvas, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('이미지 변환에 실패했습니다.'));
      resolve(b);
    }, type, quality);
  });
}

/** PNG/WebP 처럼 알파가 있을 수 있는 타입인지 대략 추정 */
function mayHaveAlpha(mime) {
  return mime === 'image/png' || mime === 'image/webp';
}

/** 캔버스 → 목표 용량에 맞춰 JPEG 품질 이진탐색 */
async function compressJpegToTarget(canvas, targetBytes) {
  let lo = JPEG_QUALITY_MIN;
  let hi = JPEG_QUALITY_MAX;
  let best = await blobFromCanvas(canvas, 'image/jpeg', hi);
  if (best.size <= targetBytes) return best;

  let bestBlob = best;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const b = await blobFromCanvas(canvas, 'image/jpeg', mid);
    if (b.size <= targetBytes) { bestBlob = b; lo = mid; } else { hi = mid; }
  }
  if (bestBlob.size > targetBytes) {
    const minBlob = await blobFromCanvas(canvas, 'image/jpeg', JPEG_QUALITY_MIN);
    return minBlob.size < bestBlob.size ? minBlob : bestBlob;
  }
  return bestBlob;
}

/**
 * 이미지 파일을 리사이즈/압축(+필요 시 가로 회전)하여 Blob 반환
 * - PNG/WebP는 우선 원본 포맷 유지(너무 크면 JPEG로 전환)
 * - FORCE_LANDSCAPE=true면 세로사진(sh>sw)을 90도 회전하여 가로로 저장
 */
async function resizeImageFile(file, {
  maxW = MAX_WIDTH,
  maxH = MAX_HEIGHT,
  targetBytes = TARGET_BYTES,
  allowLossyIfHuge = true,
  forceLandscape = FORCE_LANDSCAPE,
} = {}) {
  const bitmap = await loadImageBitmap(file);
  const sw = bitmap.width;
  const sh = bitmap.height;

  const willRotate = Boolean(forceLandscape && sh > sw); // 세로 → 가로로 회전

  // 회전 여부에 따라 기준 너비/높이를 결정(회전 후 기준)
  const baseW = willRotate ? sh : sw;
  const baseH = willRotate ? sw : sh;

  // 회전 후 기준으로 최대 크기 적용
  const { tw, th } = computeTargetSize(baseW, baseH, maxW, maxH);

  // 캔버스 준비
  const canvas = document.createElement('canvas');
  canvas.width  = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');

  if (willRotate) {
    // 90도 회전(가로화)
    ctx.save();
    ctx.translate(tw / 2, th / 2);
    ctx.rotate(Math.PI / 2); // 시계방향 90°
    // 회전 후 원본 가로(sw) → 화면 세로(th), 원본 세로(sh) → 화면 가로(tw)가 되도록 매핑
    // 즉 drawImage의 dWidth=th, dHeight=tw 로 그리면 비율 유지
    ctx.drawImage(bitmap, -th / 2, -tw / 2, th, tw);
    ctx.restore();
  } else {
    // 회전 없이 그대로 리사이즈
    ctx.drawImage(bitmap, 0, 0, tw, th);
  }

  const originMime = (file.type || '').toLowerCase();
  const keepAlpha = mayHaveAlpha(originMime);

  // 포맷 선택
  if (keepAlpha) {
    // PNG/WebP는 무손실 → 너무 크면 JPEG로 전환
    let out = await blobFromCanvas(canvas, originMime || 'image/png');
    if (allowLossyIfHuge && out.size > targetBytes) {
      out = await compressJpegToTarget(canvas, targetBytes);
      return out;
    }
    return out;
  } else {
    // 사진류는 JPEG 압축
    const out = await compressJpegToTarget(canvas, targetBytes);
    return out;
  }
}

/* =========================
 * 공개 API
 * ========================= */

/**
 * 파일 업로드 (이미지면 자동 리사이즈/압축/가로화 후 업로드)
 * 반환: { url }
 */
export async function uploadFile(file) {
  if (!file) throw new Error('파일이 없습니다.');

  // HEIC 같은 미지원 포맷 방어
  if (file.type && /heic|heif/i.test(file.type)) {
    throw new Error('HEIC/HEIF 이미지는 브라우저에서 변환할 수 없어요. JPG/PNG로 저장 후 올려주세요.');
  }

  let toSend = file;

  if (isImage(file)) {
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('파일이 너무 큽니다. 50MB 이하로 줄여주세요.');
    }

    // 🔁 리사이즈/압축 + 세로 → 가로 자동 회전
    const blob = await resizeImageFile(file, {
      maxW: MAX_WIDTH,
      maxH: MAX_HEIGHT,
      targetBytes: TARGET_BYTES,
      allowLossyIfHuge: true,
      forceLandscape: FORCE_LANDSCAPE,
    });

    if (blob.size > HARD_LIMIT_BYTES) {
      throw new Error('이미지가 너무 큽니다. 해상도를 더 줄이거나 압축 후 다시 시도해주세요.');
    }

    const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
    toSend = new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + `-resized.${ext}`, { type: blob.type });
  }

  const fd = new FormData();
  fd.append('file', toSend);

  const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 413) {
      throw new Error('이미지가 서버 허용 용량을 초과했어요. 더 작게 줄여서 다시 시도해주세요.');
    }
    throw new Error(`업로드 실패: ${res.status} ${t}`);
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.url) throw new Error('업로드 응답이 올바르지 않습니다.');
  return { url: data.url };
}

/** YouTube 썸네일 헬퍼 */
export const ytThumb = (id, q = 'hqdefault') =>
  (id ? `https://i.ytimg.com/vi/${id}/${q}.jpg` : null);
