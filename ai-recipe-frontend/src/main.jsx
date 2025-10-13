// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import axios from "axios";
import { fetchMe } from "./lib/auth";   // ← 경로와 함수명 수정!

axios.defaults.withCredentials = true;

export function BootProbe() {
  React.useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();     // ← getMe 대신 fetchMe 사용
        console.log("me:", me);
      } catch (e) {
        console.error("getMe failed", e);
      }
    })();
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <BootProbe />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

/* 보기/편집 공통: 기본 이미지 */
.post-content img,
.toastui-editor-contents img {
  max-width: 100%;
  height: auto;
}

/* 병렬 배치용: inline-block + 여백 */
.post-content img.rf-inline,
.toastui-editor-contents img.rf-inline {
  display: inline-block;
  vertical-align: top;
  margin-right: 12px;
  margin-bottom: 12px;
}

/* 선택 표시(편집기 전용) */
.rf-img-selected {
  outline: 2px solid #2b8a3e !important;
  outline-offset: 2px;
}

/* 드래그 핸들 (옵션) */
.rf-img-handle{
  position: fixed;
  width: 14px; height: 14px;
  border: 2px solid #2b8a3e;
  background: #fff;
  border-radius: 4px;
  cursor: nwse-resize;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
  z-index: 99999;
  display: none;
}
