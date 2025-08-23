// src/components/AdCarousel.jsx
import { useEffect, useRef, useState } from 'react';

export default function AdCarousel({
  items = [],
  intervalMs = 3500,
  height = 160,
  ariaLabel = '프로모션 배너',
}) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const len = items.length;

  // prefers-reduced-motion이면 자동재생 끔
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (len === 0 || reduceMotion) return;
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, len, reduceMotion, intervalMs]);

  function start() {
    stop();
    if (len > 1) {
      timerRef.current = setTimeout(() => setIdx((p) => (p + 1) % len), intervalMs);
    }
  }
  function stop() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  const go = (next) => {
    stop();
    setIdx((p) => {
      if (next === 'prev') return (p - 1 + len) % len;
      if (next === 'next') return (p + 1) % len;
      return p;
    });
  };

  return (
    <section
      className="position-relative overflow-hidden rounded-3 border bg-light my-3"
      role="region"
      aria-label={ariaLabel}
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocusCapture={stop}
      onBlurCapture={start}
      style={{ minHeight: height }}
    >
      {/* 슬라이드 뷰포트 */}
      <div className="position-relative" style={{ height }}>
        {items.map((it, i) => {
          const active = i === idx;
          return (
            <a
              key={i}
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-end text-decoration-none"
              href={it.href || '#'}
              onClick={(e) => { if (!it.href) e.preventDefault(); }}
              aria-hidden={active ? 'false' : 'true'}
              tabIndex={active ? 0 : -1}
              // 부트스트랩 느낌의 페이드 전환 (인라인로 충분)
              style={{
                opacity: active ? 1 : 0,
                transition: 'opacity 300ms ease',
                pointerEvents: active ? 'auto' : 'none',
              }}
            >
              {/* 배경 이미지 */}
              <div
                className="position-absolute top-0 start-0 w-100 h-100"
                style={{
                  background: it.img
                    ? `url(${it.img}) center/cover no-repeat`
                    : undefined,
                }}
                aria-hidden="true"
              />
              {/* 텍스트 오버레이 */}
              <div className="position-relative w-100 p-3">
                <div className="d-inline-flex flex-column gap-1 px-3 py-2 rounded-2 bg-white bg-opacity-75 shadow-sm">
                  <strong className="text-dark">{it.title}</strong>
                  {it.desc && <span className="small text-secondary">{it.desc}</span>}
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* 컨트롤(이전/다음) */}
      {len > 1 && (
        <>
          <button
            type="button"
            className="btn btn-light border position-absolute top-50 start-0 translate-middle-y shadow-sm rounded-circle"
            style={{ width: 36, height: 36 }}
            aria-label="이전 배너"
            onClick={() => go('prev')}
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn-light border position-absolute top-50 end-0 translate-middle-y shadow-sm rounded-circle"
            style={{ width: 36, height: 36 }}
            aria-label="다음 배너"
            onClick={() => go('next')}
          >
            ›
          </button>
        </>
      )}

      {/* 인디케이터(점) */}
      {len > 1 && (
        <div
          className="position-absolute start-50 translate-middle-x d-flex gap-2"
          style={{ bottom: 8 }}
          role="tablist"
          aria-label="배너 인디케이터"
        >
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`btn p-0 rounded-circle ${i === idx ? 'bg-dark' : 'bg-white border'}`}
              onClick={() => setIdx(i)}
              style={{ width: 8, height: 8 }}
              aria-label={`${i + 1}번째 배너`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
