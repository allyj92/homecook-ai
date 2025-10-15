import React from "react";

export default function SiteFooter({ className = "" }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`site-footer text-secondary small mt-4 ${className}`}>
      <hr className="my-3" />
      <div className="content-narrow text-center text-md-start">
        <div className="fw-bold text-dark mb-1">성장스토리</div>
        <div className="mb-1">
          대표: <span className="text-dark">임은재</span>
          <span className="ms-2">동업자: <span className="text-dark">이재순</span></span>
        </div>
        <div className="mb-1">
          사업자등록번호: <span className="text-dark">106-17-14474</span>
          <span className="ms-2">
            통신판매업 신고번호: <span className="text-dark">2022-충남천안-2722</span>
          </span>
        </div>
        <address className="mb-1" style={{ fontStyle: "normal" }}>
          주소: <span className="text-dark">인천광역시 연수구 능허대로 79번길 30, 106동 101호</span>
        </address>
        <div className="mb-2">
          사이트:{" "}
          <a
            href="https://recipfree.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-secondary"
          >
            recipfree.com
          </a>
        </div>

        <div className="mb-1">
          * 커뮤니티 내 일부 링크는 제휴/광고일 수 있으며, 구매 시 수수료를 받을 수 있습니다.
        </div>
        <div>© {year} RecipFree</div>
      </div>
    </footer>
  );
}