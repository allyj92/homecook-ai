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
      initialEditType: "wysiwyg",
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

    // 변경 시: img 스타일 width → width 속성 동기화 후 콜백
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

    // 이미지 드래그 리사이즈 활성화
    const dispose = enableImageResize(ed, emitHtml);

    return () => {
      try { dispose?.(); } catch {}
      ed?.destroy();
    };
  }, []);

  // 외부에서 초기값/포맷 변경 시 반영
  useEffect(() => {
    const ed = edRef.current;
    if (!ed) return;
    const fmt = initialFormat === "auto" ? (isLikelyHtml(initialValue) ? "html" : "md") : initialFormat;
    if (fmt === "html") ed.setHTML(initialValue || "");
    else ed.setMarkdown(initialValue || "");
  }, [initialValue, initialFormat]);

  return <div ref={rootRef} />;
}

/**
 * 이미지 드래그 리사이즈 - 핸들을 document.body에 고정으로 띄워 clipping 문제 제거
 * - 이미지 클릭 시 핸들 표시
 * - 드래그로 img.style.width(px) 변경
 * - 변경 후 외부 onChanged 호출
 */
function enableImageResize(editor, onChanged) {
  // 에디터 내부 ProseMirror 루트 찾기 (여러 버전 대응)
  const els = editor.getEditorElements?.();
  const editorEl =
    els?.wwEditor ||
    els?.el?.querySelector?.(".toastui-editor-ww-container") ||
    els?.el ||
    editor?.getRootElement?.() ||
    document;

  const prose =
    editorEl?.querySelector?.(".ProseMirror") ||
    editorEl?.querySelector?.(".toastui-editor-contents") ||
    editorEl;

  // 상태
  let targetImg = null;
  let startX = 0;
  let startW = 0;

  // 핸들(document.body 고정)
  const handle = document.createElement("div");
  handle.className = "rf-img-handle";
  Object.assign(handle.style, {
    position: "fixed",
    width: "14px",
    height: "14px",
    border: "2px solid #2b8a3e",
    background: "#fff",
    borderRadius: "4px",
    cursor: "nwse-resize",
    boxShadow: "0 1px 4px rgba(0,0,0,.2)",
    zIndex: "99999",
    display: "none",
  });
  handle.title = "드래그해서 크기 조절";
  document.body.appendChild(handle);

  // 컨테이너 폭
  const getContentWidth = () => {
    const r = prose.getBoundingClientRect?.();
    return r?.width || prose.clientWidth || 800;
  };

  // 현재 이미지 폭(px) 파싱
  const getImgPxWidth = (img) => {
    const sw = (img.style?.width || "").trim();
    const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
    if (m) return parseFloat(m[1]);
    if (img.getAttribute("width")) return parseFloat(img.getAttribute("width")) || img.clientWidth || 200;
    return img.clientWidth || 200;
  };

  // 폭 기준으로 자동 랩 클래스 적용/해제
  const WRAP_RATIO = 0.66; // 66% 이하이면 랩 적용
  const autoWrapByWidth = (img) => {
    const cw = getContentWidth();
    const w  = getImgPxWidth(img);
    if (w <= cw * WRAP_RATIO) {
      img.classList.add("rf-wrap-left");
      img.classList.remove("rf-wrap-right");
    } else {
      img.classList.remove("rf-wrap-left");
      img.classList.remove("rf-wrap-right");
    }
  };

  // 선택 강조 & 핸들 위치
  const selectImg = (img) => {
    if (targetImg && targetImg !== img) {
      targetImg.classList.remove("rf-img-selected");
      targetImg.style.outline = "";
      targetImg.style.outlineOffset = "";
    }
    targetImg = img;
    if (targetImg) {
      targetImg.classList.add("rf-img-selected");
      targetImg.style.outline = "2px solid #2b8a3e";
      targetImg.style.outlineOffset = "2px";
      positionHandle();
      // 클릭 시점에도 한 번 자동 랩 평가
      autoWrapByWidth(targetImg);
    } else {
      hideHandle();
    }
  };

  const positionHandle = () => {
    if (!targetImg) return hideHandle();
    const r = targetImg.getBoundingClientRect();
    handle.style.left = `${r.right - 8}px`;
    handle.style.top  = `${r.bottom - 8}px`;
    handle.style.display = "block";
  };

  const hideHandle = () => {
    handle.style.display = "none";
    if (targetImg) {
      targetImg.classList.remove("rf-img-selected");
      targetImg.style.outline = "";
      targetImg.style.outlineOffset = "";
    }
    targetImg = null;
  };

  // 클릭으로 이미지 선택
  const onClick = (e) => {
    const img = e.target?.closest?.("img");
    if (img && prose.contains(img)) selectImg(img);
    else hideHandle();
  };

  // 드래그 시작
  const onHandleDown = (e) => {
    if (!targetImg) return;
    e.preventDefault();
    startX = e.clientX;
    startW = getImgPxWidth(targetImg);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // 드래그 중
  const onMove = (e) => {
    if (!targetImg) return;
    const dx = e.clientX - startX;
    const next = Math.max(80, Math.round(startW + dx));
    targetImg.style.width = `${next}px`;

    // 자동 랩 적용/해제
    autoWrapByWidth(targetImg);

    // 변경 통지
    try { editor.eventEmitter?.emit("change"); } catch {}
    try { onChanged?.(); } catch {}
    positionHandle();
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  const onAnyScroll = () => positionHandle();
  const onWinResize = () => positionHandle();

  prose.addEventListener("click", onClick, true);
  document.addEventListener("scroll", onAnyScroll, true);
  window.addEventListener("resize", onWinResize, { passive: true });
  handle.addEventListener("mousedown", onHandleDown);

  // 초기 DOM 스캔: 이미 들어있는 이미지들도 한 번 자동 랩
  const scanAndWrap = () => {
    prose.querySelectorAll("img").forEach((img) => autoWrapByWidth(img));
  };
  scanAndWrap();

  // DOM 변화 추적
  const mo = new MutationObserver(() => {
    if (!targetImg || !prose.contains(targetImg)) hideHandle();
    else positionHandle();
    // 새 이미지/폭 변경도 반영
    scanAndWrap();
  });
  mo.observe(prose, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "width", "class"] });

  // 클린업
  return () => {
    try { mo.disconnect(); } catch {}
    prose.removeEventListener("click", onClick, true);
    document.removeEventListener("scroll", onAnyScroll, true);
    window.removeEventListener("resize", onWinResize);
    handle.removeEventListener("mousedown", onHandleDown);
    try { handle.remove(); } catch {}
  };
}