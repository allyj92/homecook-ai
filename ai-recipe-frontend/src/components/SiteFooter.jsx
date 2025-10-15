// src/components/SiteFooter.jsx
import React, { useEffect, useState } from "react";

export default function SiteFooter({ className = "", reserveForSticky = true }) {
  const year = new Date().getFullYear();

  // 🔧 하단 스티키 광고/모바일 바 높이만큼 자동 여유공간 확보
  const [reserve, setReserve] = useState(120);
  useEffect(() => {
    const compute = () => {
      const isDesktop = window.matchMedia("(min-width: 992px)").matches;
      const adH = isDesktop ? 120 : 80; // 스티키 광고 기본 높이(페이지별 컴포넌트와 일치)
      const navSpacer = document.querySelector(".bottom-nav-spacer");
      const navH = navSpacer ? navSpacer.getBoundingClientRect().height : 0;
      setReserve(adH + navH + 16); // 여유 16px
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  return (
    <footer className={`site-footer border-top mt-4 ${className}`}>
      <div className="container-xxl py-3">
        {/* 상단 안내 한 줄 */}
        <div className="text-secondary small text-center text-md-start mb-3">
          * 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        </div>

        {/* 정보 3열 그리드 (모바일 1열 → md부터 3열) */}
        <div className="row row-cols-1 row-cols-md-3 g-3 align-items-start">
          {/* 회사/브랜드 */}
          <div className="col">
            <div className="fw-bold mb-2" style={{ letterSpacing: "-0.01em" }}>
              성장스토리
            </div>
            <ul className="list-unstyled small m-0 text-secondary">
              <li className="mb-1">
                대표: <span className="text-dark fw-semibold">임은재</span>
              </li>
              <li className="mb-1">
                동업자: <span className="text-dark fw-semibold">이재순</span>
              </li>
              <li className="mb-1">
                사이트:{" "}
                <a
                  href="https://recipfree.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-secondary"
                >
                  recipfree.com
                </a>
              </li>
              <li className="mt-2">
                <span className="badge rounded-pill text-bg-light border">
                  © {year} RecipFree
                </span>
              </li>
            </ul>
          </div>

          {/* 사업자/통신판매 */}
          <div className="col">
            <div className="fw-bold mb-2">사업자 정보</div>
            <ul className="list-unstyled small m-0 text-secondary">
              <li className="mb-1">
                사업자등록번호:{" "}
                <span className="text-dark fw-semibold">106-17-14474</span>
              </li>
              <li className="mb-1">
                통신판매업 신고번호:{" "}
                <span className="text-dark fw-semibold">2022-충남천안-2722</span>
              </li>
              <li className="mb-1">
                상호: <span className="text-dark">성장스토리</span>
              </li>
            </ul>
          </div>

          {/* 주소/문의 */}
          <div className="col">
            <div className="fw-bold mb-2">연락/주소</div>
            <address className="small m-0 text-secondary" style={{ fontStyle: "normal" }}>
              <div className="mb-1">
                주소:{" "}
                <span className="text-dark">
                  인천광역시 연수구 능허대로 79번길 30, 106동 101호
                </span>
              </div>
              <div className="mb-1">
                고객센터:{" "}
                <span className="text-dark">
                  032-858-5380
                </span>
              </div>
              {/* 필요 시 연락처/이메일 등 추가 가능 */}
              {/* <div>문의: <a className="link-secondary" href="mailto:...">...</a></div> */}
            </address>
          </div>
        </div>
      </div>

      {/* ✅ 스티키 광고/모바일 하단바에 가리지 않게 여유 공간 확보 */}
      {reserveForSticky && (
        <div
          aria-hidden="true"
          style={{
            height: `calc(${reserve}px + env(safe-area-inset-bottom))`,
          }}
        />
      )}
    </footer>
  );
}