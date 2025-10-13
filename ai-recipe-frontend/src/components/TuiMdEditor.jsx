// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

export default function TuiHtmlEditor({
  initialValue = "",
  initialFormat = "auto", // "md" | "html" | "auto"
  onChange,
  height = "480px",
  placeholder,
  upload,
}) {
  const rootRef = useRef(null);
  const edRef = useRef(null);

  useEffect(() => {
    const ed = new Editor({
      el: rootRef.current,
      height,
      initialEditType: "wysiwyg", // HTML 편집 기본
      previewStyle: "vertical",
      placeholder,
      usageStatistics: false,
      hooks: {
        addImageBlobHook: async (blob, cb) => {
          try {
            const url = await upload?.(blob);
            cb(url, "image");
          } catch (e) {
            alert(e?.message || "이미지 업로드 실패");
          }
        },
      },
    });
    edRef.current = ed;

    // 초기 컨텐츠 주입 (md/html 구분)
    const fmt = initialFormat === "auto" ? (isLikelyHtml(initialValue) ? "html" : "md") : initialFormat;
    if (fmt === "html") ed.setHTML(initialValue || "");
    else ed.setMarkdown(initialValue || "");

    // 변경 시 HTML로만 콜백
    ed.on("change", () => {
      onChange?.(ed.getHTML());
    });

    // 이미지 드래그 리사이즈 활성화
    enableImageResize(ed);

    return () => ed?.destroy();
  }, []);

  // key 변경 없이 외부에서 초기값 바꾸는 케이스 대비
  useEffect(() => {
    const ed = edRef.current;
    if (!ed) return;
    const fmt = initialFormat === "auto" ? (isLikelyHtml(initialValue) ? "html" : "md") : initialFormat;
    if (fmt === "html") ed.setHTML(initialValue || "");
    else ed.setMarkdown(initialValue || "");
  }, [initialValue, initialFormat]);

  return <div ref={rootRef} />;
}

/** 아주 단순한 이미지 리사이즈 핸들 */
function enableImageResize(editor) {
  const root = editor.getEditorElements?.().wysiwyg || editor.getRootElement?.() || document;
  let targetImg = null;
  let startX = 0;
  let startW = 0;
  let handle = null;

  const ensureHandle = () => {
    if (handle) return handle;
    handle = document.createElement("div");
    handle.className = "rf-img-handle";
    handle.title = "드래그해서 크기 조절";
    root.appendChild(handle);
    handle.addEventListener("mousedown", onDown);
    return handle;
  };

  const onDown = (e) => {
    if (!targetImg) return;
    e.preventDefault();
    startX = e.clientX;
    startW = parseInt(targetImg.getAttribute("width") || targetImg.clientWidth || 200, 10);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onMove = (e) => {
    if (!targetImg) return;
    const dx = e.clientX - startX;
    const next = Math.max(80, startW + dx);
    targetImg.setAttribute("width", String(Math.round(next)));
    // 에디터에 변경 통지
    try {
      editor.eventEmitter?.emit("change");
    } catch {
      // fallback: 강제로 HTML 재설정하여 변경 이벤트 유발
      const html = editor.getHTML();
      editor.setHTML(html);
    }
    positionHandle();
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  const positionHandle = () => {
    if (!handle || !targetImg) return;
    const r = targetImg.getBoundingClientRect();
    const rr = root.getBoundingClientRect?.() || { left: 0, top: 0 };
    handle.style.display = "block";
    handle.style.left = `${r.right - rr.left - 8}px`;
    handle.style.top = `${r.bottom - rr.top - 8}px`;
  };

  const hideHandle = () => {
    if (handle) handle.style.display = "none";
    targetImg = null;
  };

  // 이미지 클릭 시 핸들 표시
  root.addEventListener("click", (e) => {
    const img = e.target.closest?.("img");
    if (img) {
      targetImg = img;
      ensureHandle();
      positionHandle();
    } else {
      hideHandle();
    }
  });

  // 스크롤/리사이즈 시 위치 보정
  root.addEventListener("scroll", positionHandle, true);
  window.addEventListener("resize", positionHandle);
}
