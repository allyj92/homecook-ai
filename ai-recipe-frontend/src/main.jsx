// src/main.jsx
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import axios from "axios";
import { getMe } from "./api/auth";

axios.defaults.withCredentials = true;

export function BootProbe() {   // ← export 추가!
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
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
