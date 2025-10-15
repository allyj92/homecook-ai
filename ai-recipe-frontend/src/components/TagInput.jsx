// src/components/TuiMdEditor.jsx
import { useEffect, useRef, useState } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

export default function TuiHtmlEditor({
  initialValue = "",
  initialFormat = "auto",
  onChange,
  upload,
  height = "520px",
  placeholder = "여기에 내용을 입력하세요…",
}) {
  const elRef = useRef(null);
  const instRef = useRef(null);
  const lastImgRef = useRef(null);
  const [isBig, setIsBig] = useState(false);

  const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

  useEffect(() => {
    if (!elRef.current) return;

    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      initialValue: "",
      usageStatistics: false,
      placeholder,
      hideModeSwitch: true,              // ✅ Markdown 전환 금지 (width 보존)
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            callback(url, "image");       // <img src="..."> 삽입
          } catch (e) {
            console.error(e);
            alert(e?.message || "이미지 업로드에 실패했어요.");
          }
          return false;
        },
      },
    });

    // 초기값 주입 (MD면 setMarkdown, HTML이면 setHTML)
    try {
      const fmt = initialFormat === "auto"
        ? (isLikelyHtml(initialValue) ? "html" : "md")
        : initialFormat;
      if (fmt === "md") editor.setMarkdown(initialValue || "");
      else if (typeof editor.setHTML === "function") editor.setHTML(initialValue || "");
      else editor.setMarkdown(initialValue || "");
    } catch {
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 변경 시 항상 HTML 전달
    const push = () => {
      try { onChange?.(editor.getHTML()); }
      catch { try { onChange?.(editor.getMarkdown()); } catch {} }
    };
    editor.on("change", push);
    push();

    // 루트 엘리먼트 (버전 가드)
    const rootEl =
      typeof editor.getRootElement === "function"
        ? editor.getRootElement()
        : elRef.current;

    // IMG 클릭 추적
    const onClick = (e) => {
      const t = e.target;
      if (t && t.tagName === "IMG") lastImgRef.current = t;
    };
    rootEl.addEventListener("click", onClick);

    // 툴바 버튼들 추가
    const toolbar = elRef.current.querySelector(".toastui-editor-defaultUI-toolbar");
    let imgSizeBtn, bigToggleBtn;
    if (toolbar) {
      // ↔️ 이미지 크기
      imgSizeBtn = document.createElement("button");
      imgSizeBtn.type = "button";
      imgSizeBtn.className = "toastui-editor-toolbar-icons";
      imgSizeBtn.style.width = "28px";
      imgSizeBtn.style.height = "28px";
      imgSizeBtn.style.backgroundSize = "18px 18px";
      imgSizeBtn.title = "이미지 크기";
      imgSizeBtn.textContent = "↔️";
      imgSizeBtn.addEventListener("click", () => {
        const img = lastImgRef.current;
        if (!img) { alert("크기를 조절할 이미지를 먼저 클릭하세요."); return; }
        const current = img.getAttribute("width") || "";
        const val = prompt("이미지 너비(px). 예: 320  (비우면 자동)", current);
        if (val == null) return;
        const px = String(val).trim();
        if (!px) { img.removeAttribute("width"); img.removeAttribute("height"); }
        else if (!/^\d+$/.test(px)) { alert("숫자(px)만 입력해주세요. 예: 320"); return; }
        else { img.setAttribute("width", px); img.removeAttribute("height"); }
        push();
      });
      toolbar.appendChild(imgSizeBtn);

      // ⛶ 크게/작게
      bigToggleBtn = document.createElement("button");
      bigToggleBtn.type = "button";
      bigToggleBtn.className = "toastui-editor-toolbar-icons";
      bigToggleBtn.style.width = "28px";
      bigToggleBtn.style.height = "28px";
      bigToggleBtn.style.backgroundSize = "18px 18px";
      bigToggleBtn.title = "창 크게/작게";
      bigToggleBtn.textContent = "⛶";
      bigToggleBtn.addEventListener("click", () => {
        setIsBig((v) => !v);
      });
      toolbar.appendChild(bigToggleBtn);
    }

    instRef.current = editor;
    return () => {
      try { rootEl.removeEventListener("click", onClick); } catch {}
      try { imgSizeBtn && imgSizeBtn.remove(); } catch {}
      try { bigToggleBtn && bigToggleBtn.remove(); } catch {}
      try { editor.destroy(); } catch {}
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 높이/전체화면 반영
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    try {
      ed.setHeight(isBig ? "88vh" : height);   // ✅ 시원하게
    } catch {}
  }, [height, isBig]);

  return <div ref={elRef} />;
}
