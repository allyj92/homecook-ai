// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

/**
 * HTML 기반 Toast UI Editor 래퍼
 *
 * props:
 * - valueHtml: string (초기/외부 값 - HTML)
 * - onChange: (html: string) => void  // 변경 시 HTML 반환
 * - upload: (file: Blob) => Promise<string>  // 이미지 업로드 후 URL 반환
 * - height?: string (기본 520px)
 * - placeholder?: string
 */
export default function TuiHtmlEditor({
  valueHtml = "",
  onChange,
  upload,
  height = "520px",
  placeholder = "여기에 내용을 입력하세요…",
}) {
  const elRef = useRef(null);
  const instRef = useRef(null);

  // 1) 에디터 생성
  useEffect(() => {
    if (!elRef.current) return;

    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "wysiwyg", // WYSIWYG 모드
      previewStyle: "vertical",
      initialValue: "", // 최초는 비워두고 아래서 setHTML로 주입
      usageStatistics: false,
      placeholder,
      hooks: {
        // 붙여넣기/드래그 이미지 → 업로드 → 본문 삽입
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
          return false; // 기본 업로더 막기
        },
      },
    });

    // 최초 값(HTML) 주입
    try {
      if (valueHtml) editor.setHTML?.(valueHtml);
    } catch {
      // setHTML이 실패하면 마크다운 폴백
      try { editor.setMarkdown(valueHtml || ""); } catch {}
    }

    // 변경 감지 → HTML로 외부 전달
    editor.on("change", () => {
      try {
        onChange?.(editor.getHTML());
      } catch {
        // 폴백
        onChange?.(editor.getMarkdown());
      }
    });

    instRef.current = editor;
    return () => {
      try { editor.destroy(); } catch {}
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 외부 valueHtml 변경 시 동기화
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    let curr = "";
    try { curr = ed.getHTML(); } catch { curr = ed.getMarkdown(); }
    if ((valueHtml || "") !== (curr || "")) {
      try { ed.setHTML?.(valueHtml || ""); }
      catch { try { ed.setMarkdown(valueHtml || ""); } catch {} }
    }
  }, [valueHtml]);

  // 3) 높이 반영
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    try { ed.setHeight(height); } catch {}
  }, [height]);

  return <div ref={elRef} />;
}
