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

    // 변경 시 HTML 정규화(이미지 style.width → width 속성도 동기화) 후 콜백
    const emitHtml = () => {
      let html = ed.getHTML();
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("img").forEach((img) => {
          const sw = (img.style?.width || "").trim();
          const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
          if (m) img.setAttribute("width", String(Math.round(parseFloat(m[1]))));
        });
        html = doc.body.innerHTML;
      } catch {}
      onChange?.(html);
    };
    ed.on("change", emitHtml);

    // 이미지 드래그 리사이즈 활성화 (클린업 포함)
    const disposeResize = enableImageResize(ed, emitHtml);

    return () => {
      try { disposeResize?.(); } catch {}
      ed?.destroy();
    };
  }, []);

  // 외부에서 초기값/포맷이 바뀌는 경우
  useEffect(() => {
    const ed = edRef.current;
    if (!ed) return;
    const fmt = initialFormat === "auto" ? (isLikelyHtml(initialValue) ? "html" : "md") : initialFormat;
    if (fmt === "html") ed.setHTML(initialValue || "");
    else ed.setMarkdown(initialValue || "");
  }, [initialValue, initialFormat]);

  return <div ref={rootRef} />;
}

/** 이미지 드래그 리사이즈 (ProseMirror 내부) */
function enableImageResize(editor, onChanged) {
  // TUI 3.x 요소 탐색 (WYSIWYG 루트)
  const els = editor.getEditorElements?.();
  const wwRoot =
    els?.wwEditor?.querySelector?.(".ProseMirror") ||
    els?.wwEditor ||
    editor.getRootElement?.() ||
    document;

  // 핸들
  let handle = null;
  let targetImg = null;
  let startX = 0;
  let startW = 0;

  // 루트 포지셔닝 확보 (핸들 absolute 기준)
  try {
    const cs = getComputedStyle(wwRoot);
    if (cs.position === "static") wwRoot.style.position = "relative";
  } catch {}

  const ensureHandle = () => {
    if (handle) return handle;
    handle = document.createElement("div");
    handle.className = "rf-img-handle";
    handle.title = "드래그해서 크기 조절";
    wwRoot.appendChild(handle);
    handle.addEventListener("mousedown", onDown);
    return handle;
  };

  const onDown = (e) => {
    if (!targetImg) return;
    e.preventDefault();
    startX = e.clientX;

    // 시작 폭: style.width(px) > width 속성 > clientWidth
    const sw = (targetImg.style?.width || "").trim();
    const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
    if (m) startW = parseFloat(m[1]);
    else if (targetImg.getAttribute("width")) startW = parseFloat(targetImg.getAttribute("width")) || targetImg.clientWidth || 200;
    else startW = targetImg.clientWidth || 200;

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onMove = (e) => {
    if (!targetImg) return;
    const dx = e.clientX - startX;
    const next = Math.max(80, Math.round(startW + dx));
    // 스타일 폭(px)로 우선 적용 (WYSIWYG에서 가장 안정적으로 유지)
    targetImg.style.width = `${next}px`;
    // 변경 이벤트
    try { editor.eventEmitter?.emit("change"); } catch {}
    try { onChanged?.(); } catch {}
    positionHandle();
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  const positionHandle = () => {
    if (!handle || !targetImg) return;
    const r = targetImg.getBoundingClientRect();
    const rr = wwRoot.getBoundingClientRect?.() || { left: 0, top: 0 };
    handle.style.display = "block";
    handle.style.left = `${r.right - rr.left - 8}px`;
    handle.style.top = `${r.bottom - rr.top - 8}px`;
  };

  const hideHandle = () => {
    if (handle) handle.style.display = "none";
    targetImg = null;
  };

  // 이미지 클릭 시 핸들 표시
  const onClick = (e) => {
    const img = e.target?.closest?.("img");
    if (img) {
      targetImg = img;
      ensureHandle();
      positionHandle();
    } else {
      hideHandle();
    }
  };

  // 콘텐츠 변화에 반응(스크롤/리사이즈/DOM 변화)
  const onScroll = () => positionHandle();
  const onWinResize = () => positionHandle();

  wwRoot.addEventListener("click", onClick);
  wwRoot.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onWinResize);

  // DOM 변화를 감지해서 핸들 위치 보정/숨김
  const mo = new MutationObserver(() => {
    if (!targetImg || !wwRoot.contains(targetImg)) {
      hideHandle();
    } else {
      positionHandle();
    }
  });
  mo.observe(wwRoot, { childList: true, subtree: true, attributes: true });

  // 클린업
  return () => {
    wwRoot.removeEventListener("click", onClick);
    wwRoot.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onWinResize);
    try { mo.disconnect(); } catch {}
    try { handle?.remove(); } catch {}
  };
}
