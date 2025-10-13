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

