import { useEffect, useMemo, useState } from "react";

/* 파스텔 배경 팔레트 */
const PASTELS = [
  ["#f3ebe3", "#e7d8c9"],
  ["#efe2d1", "#e4d5c3"],
  ["#f5eadf", "#e8dccb"],
  ["#ede5da", "#e0d2c3"],
  ["#f1e6d8", "#e5d6c6"],
  ["#f2e8de", "#e6d8c9"],
];
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * SmartThumb
 * - 이미지가 없거나 깨지면 파스텔 그라디언트 플레이스홀더로 대체
 * - props:
 *    src?: string
 *    seed?: string
 *    alt?: string
 *    width?: number
 *    height?: number
 *    rounded?: boolean
 *    className?: string
 */
export default function SmartThumb({
  src,
  seed = "fallback",
  alt = "thumbnail",
  width = 80,
  height = 56,
  rounded = true,
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setBroken(false);
  }, [src]);

  const [c1, c2] = useMemo(() => {
    const idx = hashCode(String(seed)) % PASTELS.length;
    return PASTELS[idx];
  }, [seed]);

  const hasImg = !!src && !broken;

  return (
    <div
      className={`position-relative ${className}`}
      style={{
        width,
        height,
        borderRadius: rounded ? 8 : 0,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
      aria-label={alt}
    >
      {hasImg && (
        <img
          key={src || "empty"}
          src={src}
          alt={alt}
          loading="lazy"
          className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
          style={{ display: loaded ? "block" : "none" }}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}