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

    // StrictMode/재마운트 대비: 컨테이너 정리
    try { elRef.current.innerHTML = ""; } catch {}

    // 커스텀 툴바: 이미지 크기 버튼
    const imgSizeBtn = document.createElement("button");
    imgSizeBtn.type = "button";
    imgSizeBtn.className = "toastui-editor-toolbar-icons";
    imgSizeBtn.style.width = "28px";
    imgSizeBtn.style.height = "28px";
    imgSizeBtn.style.backgroundSize = "18px 18px";
    imgSizeBtn.title = "이미지 크기";
    imgSizeBtn.innerHTML = "↔️";

    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      hideModeSwitch: true, // 에디터 모드 전환 버튼 숨김 (이중 입력창 느낌 방지)
      initialValue: "",
      usageStatistics: false,
      placeholder,
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task", "indent", "outdent"],
        ["table", "image", "link"],
        [{ el: imgSizeBtn, tooltip: "이미지 크기" }],
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
      else editor.setMarkdown(initialValue || "");
    } catch {
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 변경되면 항상 HTML을 넘기기
    const push = () => {
      try { onChange?.(editor.getHTML()); }
      catch { try { onChange?.(editor.getMarkdown()); } catch {} }
    };
    editor.on("change", push);
    // 마운트 직후 한 번 현재값 전달(검증/임시저장용)
    push();

    // 에디터 영역에서 IMG 추적
    const root = elRef.current;
    const onClick = (e) => {
      const img = e.target && (e.target.closest ? e.target.closest("img") : null);
      if (img) lastImgRef.current = img;
    };
    root.addEventListener("click", onClick);

    // 이미지 크기 버튼 동작
    imgSizeBtn.onclick = () => {
      const img = lastImgRef.current;
      if (!img) {
        alert("크기를 조절할 이미지를 먼저 클릭하세요.");
        return;
      }
      const current =
        (img.style.width?.replace("px","")) ||
        img.getAttribute("width") ||
        img.getAttribute("data-w") || "";

      const val = prompt("이미지 너비(px). 예: 320  (비우면 자동)", current);
      if (val == null) return; // 취소
      const px = String(val).trim();

      if (!px) {
        img.style.width = "";
        img.removeAttribute("width");
        img.removeAttribute("data-w");
      } else if (!/^\d+$/.test(px)) {
        alert("숫자(px)만 입력해주세요. 예: 320");
        return;
      } else {
        img.style.width = `${px}px`;   // 에디터 내에서는 style로 유지
        img.setAttribute("data-w", px); // 저장 시 width 복원 힌트
        img.removeAttribute("height");  // 비율 유지
      }
      push(); // 에디터 HTML 갱신을 강제 트리거
    };

    instRef.current = editor;
    return () => {
      try { root.removeEventListener("click", onClick); } catch {}
      try { editor.destroy(); } catch {}
      // 남아있는 내부 DOM 강제 제거 (중복 생성 방지)
      try { if (elRef.current) elRef.current.innerHTML = ""; } catch {}
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
