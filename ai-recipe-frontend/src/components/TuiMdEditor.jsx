import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

// 드롭 마커(시각 피드백)
function createDropMarker() {
  const m = document.createElement("div");
  Object.assign(m.style, {
    position: "fixed",
    width: "2px",
    height: "24px",
    background: "#2b8a3e",
    boxShadow: "0 0 0 2px rgba(43,138,62,.15)",
    zIndex: 99999,
    display: "none",
  });
  document.body.appendChild(m);
  return m;
}

export default function TuiHtmlEditor({
  initialValue = "",
  initialFormat = "auto", // "md" | "html" | "auto"
  onChange,
  upload,
  height = "520px",
  placeholder = "여기에 내용을 입력하세요…",
}) {
  const elRef = useRef(null);
  const instRef = useRef(null);

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
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            callback(url, "image");
          } catch (e) {
            console.error(e);
            alert(e?.message || "이미지 업로드에 실패했어요.");
          }
          return false;
        },
      },
    });

    // 초기값 주입 (MD/HTML 자동 판별)
    try {
      const fmt =
        initialFormat === "auto"
          ? (isLikelyHtml(initialValue) ? "html" : "md")
          : initialFormat;
      if (fmt === "md") editor.setMarkdown(initialValue || "");
      else editor.setHTML?.(initialValue || "");
    } catch {
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 변경 시 항상 HTML 전달
    const emitHtml = () => {
      try {
        // style.width(px) => width 속성 동기화
        const doc = new DOMParser().parseFromString(editor.getHTML(), "text/html");
        doc.querySelectorAll("img").forEach((img) => {
          const sw = (img.style?.width || "").trim();
          const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
          if (m) img.setAttribute("width", String(Math.round(parseFloat(m[1]))));
        });
        onChange?.(doc.body.innerHTML);
      } catch {
        onChange?.(editor.getHTML());
      }
    };
    editor.on("change", emitHtml);

    // 이미지 리사이즈 + 옆으로 끌어 배치 활성화
    enableImageResizeAndReflow(editor, emitHtml);

    // mount 직후 현재값 전달
    emitHtml();

    instRef.current = editor;
    return () => {
      try { editor.destroy(); } catch {}
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부 높이 변경 반영
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    try { ed.setHeight(height); } catch {}
  }, [height]);

  return <div ref={elRef} />;
}

/* ------------------------ 핵심 로직 ------------------------ */
function enableImageResizeAndReflow(editor, onChanged) {
  // ProseMirror/contents 루트
  const els = editor.getEditorElements?.();
  const root =
    els?.wwEditor ||
    els?.el?.querySelector?.(".toastui-editor-ww-container") ||
    els?.el ||
    editor?.getRootElement?.() ||
    document;

  const prose =
    root?.querySelector?.(".ProseMirror") ||
    root?.querySelector?.(".toastui-editor-contents") ||
    root;

  /* 상태 */
  let targetImg = null;
  let startX = 0;
  let startW = 0;
  const EDGE_GRAB = 16;          // 모서리 인식 범위(px)
  const INLINE_RATIO = 0.66;     // 컨텐트 폭의 66% 이하이면 옆배치 모드(rf-inline)

  // 핸들(옵션) – 없어도 모서리 직접 드래그 가능
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
    zIndex: 99999,
    display: "none",
  });
  handle.title = "드래그해서 크기 조절";
  document.body.appendChild(handle);

  // 드롭 마커
  const marker = createDropMarker();

  /* 유틸 */
  const getContentRect = () => prose.getBoundingClientRect?.() || { left: 0, top: 0, width: prose.clientWidth || 800 };
  const getContentWidth = () => getContentRect().width;

  const getImgPxWidth = (img) => {
    const sw = (img.style?.width || "").trim();
    const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
    if (m) return parseFloat(m[1]);
    if (img.getAttribute("width")) return parseFloat(img.getAttribute("width")) || img.clientWidth || 200;
    return img.clientWidth || 200;
  };

  const isNearBottomRight = (img, x, y) => {
    const r = img.getBoundingClientRect();
    return (r.right - x <= EDGE_GRAB) && (r.bottom - y <= EDGE_GRAB);
  };

  const applyInlineRule = (img) => {
    const cw = getContentWidth();
    const w = getImgPxWidth(img);
    if (w <= cw * INLINE_RATIO) img.classList.add("rf-inline");
    else img.classList.remove("rf-inline");
  };

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
      applyInlineRule(targetImg);
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
    marker.style.display = "none";
    if (targetImg) {
      targetImg.classList.remove("rf-img-selected");
      targetImg.style.outline = "";
      targetImg.style.outlineOffset = "";
    }
    targetImg = null;
  };

  /* -------- 리사이즈: 모서리 직접 드래그 + 핸들 -------- */
  const onMouseDown = (e) => {
    const img = e.target?.closest?.("img");
    if (!img || !prose.contains(img)) return;
    // 모서리 근처에서만 리사이즈 시작
    if (!isNearBottomRight(img, e.clientX, e.clientY)) return;

    e.preventDefault();
    selectImg(img);
    startX = e.clientX;
    startW = getImgPxWidth(img);

    document.addEventListener("mousemove", onMoveResize);
    document.addEventListener("mouseup", onUpResize);
  };

  const onMoveResize = (e) => {
    if (!targetImg) return;
    const dx = e.clientX - startX;
    const next = Math.max(80, Math.round(startW + dx));
    targetImg.style.width = `${next}px`;
    applyInlineRule(targetImg);
    try { editor.eventEmitter?.emit("change"); } catch {}
    try { onChanged?.(); } catch {}
    positionHandle();
  };

  const onUpResize = () => {
    document.removeEventListener("mousemove", onMoveResize);
    document.removeEventListener("mouseup", onUpResize);
  };

  const onHandleDown = (e) => {
    if (!targetImg) return;
    e.preventDefault();
    startX = e.clientX;
    startW = getImgPxWidth(targetImg);
    document.addEventListener("mousemove", onMoveResize);
    document.addEventListener("mouseup", onUpResize);
  };

  /* --------------------- 이미지 D&D 재배치 --------------------- */
  let dragImg = null;

  // 모든 이미지에 draggable 부여
  const ensureDraggable = () => {
    prose.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("draggable")) img.setAttribute("draggable", "true");
    });
  };
  ensureDraggable();

  const onDragStart = (e) => {
    const img = e.target?.closest?.("img");
    if (!img || !prose.contains(img)) return;
    dragImg = img;
    selectImg(img);
    e.dataTransfer?.setData("text/plain", "img"); // FF 대응
    e.dataTransfer?.setDragImage?.(img, img.width / 2, img.height / 2);
  };

  const onDragOver = (e) => {
    // 이미지 사이 드롭만 허용
    const target = e.target?.closest?.("img");
    if (!target || !prose.contains(target)) return;
    e.preventDefault();

    const r = target.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    marker.style.display = "block";
    marker.style.top = `${r.top - 8}px`;
    marker.style.height = `${r.height + 16}px`;
    marker.style.left = `${e.clientX < mid ? r.left : r.right}px`;
  };

  const onDragLeave = (e) => {
    const to = e.relatedTarget;
    if (!to || !prose.contains(to)) marker.style.display = "none";
  };

  const onDrop = (e) => {
    const target = e.target?.closest?.("img");
    if (!target || !prose.contains(target) || !dragImg) return;
    e.preventDefault();
    if (target === dragImg) { marker.style.display = "none"; return; }

    // 좌/우 결정해서 DOM 이동
    const r = target.getBoundingClientRect();
    const side = (e.clientX < r.left + r.width / 2) ? "left" : "right";
    try {
      // 같은 문단으로 강제 이동해서 나란히 배치
      if (side === "left") target.insertAdjacentElement("beforebegin", dragImg);
      else target.insertAdjacentElement("afterend", dragImg);

      // 두 이미지 모두 inline 모드 적용 (옆으로 붙도록)
      applyInlineRule(target);
      applyInlineRule(dragImg);
      target.classList.add("rf-inline");
      dragImg.classList.add("rf-inline");

      // 에디터 상태 동기화
      const html = prose.innerHTML;
      editor.setHTML(html);
      try { editor.eventEmitter?.emit("change"); } catch {}
      try { onChanged?.(); } catch {}
    } finally {
      marker.style.display = "none";
    }
  };

  /* -------------------- 공통 바인딩/정리 -------------------- */
  prose.addEventListener("mousedown", onMouseDown, true);
  handle.addEventListener("mousedown", onHandleDown);
  prose.addEventListener("dragstart", onDragStart, true);
  prose.addEventListener("dragover", onDragOver, true);
  prose.addEventListener("dragleave", onDragLeave, true);
  prose.addEventListener("drop", onDrop, true);

  const onClick = (e) => {
    const img = e.target?.closest?.("img");
    if (img && prose.contains(img)) selectImg(img);
  };
  prose.addEventListener("click", onClick, true);

  // 새 이미지/구조 변화 감지
  const mo = new MutationObserver(() => {
    ensureDraggable();
    if (!targetImg || !prose.contains(targetImg)) {
      hideHandle();
    } else {
      positionHandle();
    }
  });
  mo.observe(prose, { childList: true, subtree: true, attributes: true });

  // 스크롤/리사이즈 시 위치 보정
  const onAnyScroll = () => positionHandle();
  const onWinResize = () => positionHandle();
  document.addEventListener("scroll", onAnyScroll, true);
  window.addEventListener("resize", onWinResize, { passive: true });

  // 클린업
  const dispose = () => {
    try { mo.disconnect(); } catch {}
    prose.removeEventListener("mousedown", onMouseDown, true);
    handle.removeEventListener("mousedown", onHandleDown);
    prose.removeEventListener("dragstart", onDragStart, true);
    prose.removeEventListener("dragover", onDragOver, true);
    prose.removeEventListener("dragleave", onDragLeave, true);
    prose.removeEventListener("drop", onDrop, true);
    prose.removeEventListener("click", onClick, true);
    document.removeEventListener("scroll", onAnyScroll, true);
    window.removeEventListener("resize", onWinResize);
    try { handle.remove(); } catch {}
    try { marker.remove(); } catch {}
  };

  // 반환
  return dispose;
}