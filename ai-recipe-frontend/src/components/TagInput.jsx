// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

/**
 * TuiHtmlEditor (MD/HTML 하이브리드)
 * props:
 * - initialValue: string        // 서버 원문 (MD 또는 HTML)
 * - initialFormat: "md"|"html"|"auto"
 * - onChange: (html: string) => void  // 항상 HTML로 콜백
 * - upload: (file: Blob) => Promise<string> // 업로드 후 URL
 * - height?: string
 * - placeholder?: string
 */
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
      // 표준 툴바만 넣고, 커스텀 버튼은 마운트 후 DOM에 붙입니다.
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task", "indent", "outdent"],
        ["table", "image", "link"],
        ["code", "codeblock"],
      ],
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            callback(url, "image"); // WYSIWYG에 <img> 삽입
          } catch (e) {
            console.error(e);
            alert(e?.message || "이미지 업로드에 실패했어요.");
          }
          return false;
        },
      },
    });

    // 초기 원문 주입 (MD면 setMarkdown, HTML이면 setHTML)
    try {
      const fmt =
        initialFormat === "auto"
          ? (isLikelyHtml(initialValue) ? "html" : "md")
          : initialFormat;
      if (fmt === "md") editor.setMarkdown(initialValue || "");
      else if (typeof editor.setHTML === "function") editor.setHTML(initialValue || "");
      else editor.setMarkdown(initialValue || ""); // 구버전 안전장치
    } catch {
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 변경되면 항상 HTML을 넘기기
    const push = () => {
      try { onChange?.(editor.getHTML()); }
      catch { try { onChange?.(editor.getMarkdown()); } catch {} }
    };
    editor.on("change", push);
    // 마운트 직후 한 번 현재값 전달
    push();

    // 루트 엘리먼트 (버전 호환)
    const rootEl =
      typeof editor.getRootElement === "function"
        ? editor.getRootElement()
        : elRef.current;

    // 에디터 내부 IMG 클릭 추적
    const onClick = (e) => {
      const t = e.target;
      if (t && t.tagName === "IMG") lastImgRef.current = t;
    };
    rootEl.addEventListener("click", onClick);

    // 🔧 커스텀: 이미지 크기 버튼을 툴바에 추가
    const toolbar = elRef.current.querySelector(".toastui-editor-defaultUI-toolbar");
    let imgSizeBtn;
    if (toolbar) {
      imgSizeBtn = document.createElement("button");
      imgSizeBtn.type = "button";
      imgSizeBtn.className = "toastui-editor-toolbar-icons";
      imgSizeBtn.style.width = "28px";
      imgSizeBtn.style.height = "28px";
      imgSizeBtn.style.backgroundSize = "18px 18px";
      imgSizeBtn.title = "이미지 크기";
      imgSizeBtn.textContent = "↔️"; // 간단 아이콘

      imgSizeBtn.addEventListener("click", () => {
        const img = lastImgRef.current;
        if (!img) {
          alert("크기를 조절할 이미지를 먼저 클릭하세요.");
          return;
        }
        const current = img.getAttribute("width") || "";
        const val = prompt("이미지 너비(px). 예: 320  (비우면 자동)", current);
        if (val == null) return; // 취소

        const px = String(val).trim();
        if (!px) {
          img.removeAttribute("width");
          img.removeAttribute("height");
        } else if (!/^\d+$/.test(px)) {
          alert("숫자(px)만 입력해주세요. 예: 320");
          return;
        } else {
          img.setAttribute("width", px);
          img.removeAttribute("height"); // 비율 유지
        }
        // 에디터 HTML 갱신 푸시
        push();
      });

      // 우측 끝에 붙이기
      toolbar.appendChild(imgSizeBtn);
    }

    instRef.current = editor;

    return () => {
      try { rootEl.removeEventListener("click", onClick); } catch {}
      try { imgSizeBtn && imgSizeBtn.remove(); } catch {}
      try { editor.destroy(); } catch {}
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 높이 변경 반영
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    try { ed.setHeight(height); } catch {}
  }, [height]);

  return <div ref={elRef} />;
}
