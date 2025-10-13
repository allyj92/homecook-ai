// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

// 초기 HTML에서 <img> 메타 추출 (src, 순번, width(px), 클래스)
function extractImgMeta(html) {
  const meta = [];
  try {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const bySrcCount = new Map();
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const prev = bySrcCount.get(src) ?? 0;
      bySrcCount.set(src, prev + 1);

      // width(px) 탐색: style.width > width 속성
      let w = null;
      const sw = (img.getAttribute("style") || "").match(/width\s*:\s*(\d+(?:\.\d+)?)px/i);
      if (sw) w = Math.round(parseFloat(sw[1]));
      if (!w && img.hasAttribute("width")) {
        const n = parseFloat(img.getAttribute("width"));
        if (!Number.isNaN(n)) w = Math.round(n);
      }

      // 클래스 보존 (rf-inline 등)
      const cls = img.getAttribute("class") || "";

      meta.push({ src, idx: prev, width: w, className: cls });
    });
  } catch {}
  return meta;
}

// 현재 에디터 DOM에 메타 재적용 (src + 등장순서를 기준으로 매칭)
function rehydrateImgMeta(proseRoot, meta) {
  if (!proseRoot || !Array.isArray(meta) || !meta.length) return;
  const counters = new Map();

  const imgs = proseRoot.querySelectorAll("img");
  imgs.forEach((img) => {
    const src = img.getAttribute("src") || "";
    const cur = counters.get(src) ?? 0;
    counters.set(src, cur + 1);

    const m = meta.find((x) => x.src === src && x.idx === cur);
    if (!m) return;

    // width 재적용
    if (m.width && m.width > 0) {
      img.style.width = `${m.width}px`;
      img.setAttribute("width", String(m.width)); // 저장 시에도 안전
    }
    // 클래스 재적용 (rf-inline 등)
    if (m.className) {
      const prev = (img.getAttribute("class") || "").trim();
      const merged = (prev ? prev + " " : "") + m.className;
      img.setAttribute("class", merged);
    }
  });
}

// 드롭 마커(이미지 사이 배치 위치 시각화)
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
  initialFormat = "auto",
  onChange,
  upload,
  height = "520px",
  placeholder = "여기에 내용을 입력하세요…",
}) {
  const elRef = useRef(null);
  const instRef = useRef(null);

  // 🔹 수정 진입 시 재수화를 위해 초기 이미지 메타를 먼저 추출해 둔다
  const initialImgMeta = isLikelyHtml(initialValue) ? extractImgMeta(initialValue) : [];

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

    // 초기값 주입 (MD/HTML)
    try {
      const fmt = initialFormat === "auto"
        ? (isLikelyHtml(initialValue) ? "html" : "md")
        : initialFormat;
      if (fmt === "md") editor.setMarkdown(initialValue || "");
      else editor.setHTML?.(initialValue || "");
    } catch {
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 🧩 에디터 DOM이 구성된 다음, 초기 이미지 메타를 재적용
    //   - setTimeout/RAF로 DOM 반영 타이밍을 보장
    const prose = editor.getEditorElements?.().wwEditor?.querySelector?.(".ProseMirror")
      || editor.getEditorElements?.().wwEditor
      || editor.getRootElement?.()
      || document;
    const reapply = () => rehydrateImgMeta(prose, initialImgMeta);
    requestAnimationFrame(() => { reapply(); setTimeout(reapply, 0); });

    // 변경 시: style.width → width 속성 동기화 후 HTML 콜백
    const emitHtml = () => {
      let html = editor.getHTML();
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("img").forEach((img) => {
          const sw = (img.style?.width || "").trim();
          const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
          if (m) img.setAttribute("width", String(Math.round(parseFloat(m[1]))));
        });

        // 이미지만 있는 문단 다음의 빈 문단 제거(엔터시 빈칸 방지)
        const isEmptyPara = (p) => {
          if (!p || p.tagName !== "P") return false;
          return Array.from(p.childNodes).every((n) =>
            (n.nodeType === 3 && !n.nodeValue.trim()) ||
            (n.nodeType === 1 && n.tagName === "BR")
          );
        };
        doc.querySelectorAll("p").forEach((p) => {
          const imgs = p.querySelectorAll(":scope > img");
          if (imgs.length === 1 && p.childNodes.length === 1) {
            const next = p.nextElementSibling;
            if (isEmptyPara(next)) next?.remove();
          }
        });

        onChange?.(doc.body.innerHTML);
      } catch {
        onChange?.(html);
      }
    };
    editor.on("change", emitHtml);

    // 리사이즈 + 이미지-이미지 나란히 배치 활성화
    enableResizeAndInline(editor, emitHtml);

    // mount 직후 한번 콜백
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

/* ---------------- 리사이즈 + 이미지 나란히 배치 ---------------- */
function enableResizeAndInline(editor, onChanged) {
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

  let targetImg = null;
  let startX = 0;
  let startW = 0;
  const EDGE_GRAB = 16;
  const INLINE_RATIO = 0.66;

  const handle = document.createElement("div");
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
  handle.className = "rf-img-handle";
  handle.title = "드래그해서 크기 조절";
  document.body.appendChild(handle);

  const marker = createDropMarker();

  const getContentWidth = () => (prose.getBoundingClientRect?.().width || prose.clientWidth || 800);
  const getImgWidthPx  = (img) => {
    const sw = (img.style?.width || "").trim();
    const m = sw.match(/^(\d+(?:\.\d+)?)px$/i);
    if (m) return parseFloat(m[1]);
    const a = parseFloat(img.getAttribute("width") || "");
    if (!Number.isNaN(a)) return a;
    return img.clientWidth || 200;
  };
  const isNearBR = (img, x, y) => {
    const r = img.getBoundingClientRect();
    return (r.right - x <= EDGE_GRAB) && (r.bottom - y <= EDGE_GRAB);
  };
  const applyInlineRule = (img) => {
    const w = getImgWidthPx(img);
    if (w <= getContentWidth() * INLINE_RATIO) img.classList.add("rf-inline");
    else img.classList.remove("rf-inline");
  };
  const positionHandle = () => {
    if (!targetImg) return (handle.style.display = "none");
    const r = targetImg.getBoundingClientRect();
    handle.style.left = `${r.right - 8}px`;
    handle.style.top  = `${r.bottom - 8}px`;
    handle.style.display = "block";
  };
  const selectImg = (img) => {
    targetImg = img;
    applyInlineRule(targetImg);
    positionHandle();
  };

  // 리사이즈: 이미지 모서리 직접 드래그
  const onMouseDown = (e) => {
    const img = e.target?.closest?.("img");
    if (!img || !prose.contains(img)) return;
    if (!isNearBR(img, e.clientX, e.clientY)) return;
    e.preventDefault();
    selectImg(img);
    startX = e.clientX;
    startW = getImgWidthPx(img);
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
  // 핸들 드래그
  handle.addEventListener("mousedown", (e) => {
    if (!targetImg) return;
    e.preventDefault();
    startX = e.clientX;
    startW = getImgWidthPx(targetImg);
    document.addEventListener("mousemove", onMoveResize);
    document.addEventListener("mouseup", onUpResize);
  });

  // 이미지 선택 (핸들 표시)
  prose.addEventListener("click", (e) => {
    const img = e.target?.closest?.("img");
    if (img && prose.contains(img)) selectImg(img);
  }, true);

  // 이미지 D&D로 서로 옆 배치
  const ensureDraggable = () => {
    prose.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("draggable")) img.setAttribute("draggable", "true");
    });
  };
  ensureDraggable();

  let dragImg = null;
  prose.addEventListener("dragstart", (e) => {
    const img = e.target?.closest?.("img");
    if (!img || !prose.contains(img)) return;
    dragImg = img;
    e.dataTransfer?.setData("text/plain", "img");
    e.dataTransfer?.setDragImage?.(img, img.width / 2, img.height / 2);
  }, true);

  prose.addEventListener("dragover", (e) => {
    const t = e.target?.closest?.("img");
    if (!t || !prose.contains(t)) return;
    e.preventDefault();
    const r = t.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    marker.style.display = "block";
    marker.style.top = `${r.top - 8}px`;
    marker.style.height = `${r.height + 16}px`;
    marker.style.left = `${e.clientX < mid ? r.left : r.right}px`;
  }, true);

  prose.addEventListener("dragleave", (e) => {
    const to = e.relatedTarget;
    if (!to || !prose.contains(to)) marker.style.display = "none";
  }, true);

  prose.addEventListener("drop", (e) => {
    const t = e.target?.closest?.("img");
    if (!t || !prose.contains(t) || !dragImg) return;
    e.preventDefault();
    if (t === dragImg) { marker.style.display = "none"; return; }
    const r = t.getBoundingClientRect();
    const side = (e.clientX < r.left + r.width / 2) ? "left" : "right";
    if (side === "left") t.insertAdjacentElement("beforebegin", dragImg);
    else t.insertAdjacentElement("afterend", dragImg);

    // 나란히 배치 보장
    t.classList.add("rf-inline");
    dragImg.classList.add("rf-inline");
    try {
      const html = prose.innerHTML;
      editor.setHTML(html);               // 내부 상태 동기화
      editor.eventEmitter?.emit("change");
      onChanged?.();
    } finally {
      marker.style.display = "none";
    }
  }, true);

  // 리스너 등록
  prose.addEventListener("mousedown", onMouseDown, true);

  // DOM 변화에 반응
  const mo = new MutationObserver(() => {
    ensureDraggable();
    if (targetImg && prose.contains(targetImg)) positionHandle();
    else handle.style.display = "none";
  });
  mo.observe(prose, { childList: true, subtree: true, attributes: true });

  // 스크롤/리사이즈 시 위치 보정
  const onAnyScroll = () => positionHandle();
  const onWinResize = () => positionHandle();
  document.addEventListener("scroll", onAnyScroll, true);
  window.addEventListener("resize", onWinResize, { passive: true });

  // 클린업 반환
  return () => {
    try { mo.disconnect(); } catch {}
    prose.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("scroll", onAnyScroll, true);
    window.removeEventListener("resize", onWinResize);
    try { handle.remove(); } catch {}
    try { marker.remove(); } catch {}
  };
}
