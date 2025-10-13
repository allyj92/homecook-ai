// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

/**
 * Toast UI Editor (하이브리드)
 * - initialValue: 서버/초기 원문 (MD 또는 HTML)
 * - initialFormat: "md" | "html" | "auto"
 * - onChange: (html) => void  // 항상 HTML로 콜백
 * - upload: (file: Blob) => Promise<string>
 * - height, placeholder
 *
 * ⚠️ 초기값은 mount 때만 주입. 값 교체는 key 변경으로 새로 마운트하세요.
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

  const isLikelyHtml = (s = "") => /<\/?[a-z][\s\S]*>/i.test(s);

  useEffect(() => {
    if (!elRef.current) return;

    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "wysiwyg",     // 시각 모드
      previewStyle: "vertical",
      initialValue: "",               // 바로 아래에서 set으로 주입
      usageStatistics: false,
      placeholder,
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            callback(url, "image"); // WYSIWYG에 <img>가 들어가게
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
      const useFmt =
        initialFormat === "auto"
          ? (isLikelyHtml(initialValue) ? "html" : "md")
          : initialFormat;

      if (useFmt === "md") editor.setMarkdown(initialValue || "");
      else editor.setHTML?.(initialValue || "");
    } catch (e) {
      // 어느 쪽이든 실패하면 안전하게 markdown로
      try { editor.setMarkdown(initialValue || ""); } catch {}
    }

    // 변경 시 항상 HTML로 부모에 전달
    const push = () => {
      try { onChange?.(editor.getHTML()); }
      catch { try { onChange?.(editor.getMarkdown()); } catch {} }
    };
    editor.on("change", push);

    // ✅ mount 직후 한 번 현재값을 부모로 전달(검증/임시저장에 필요)
    push();

    instRef.current = editor;
    return () => {
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
