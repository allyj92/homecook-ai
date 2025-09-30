// src/components/TuiMdEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

/**
 * props:
 * - value: string (markdown)
 * - onChange: (md: string) => void
 * - upload: (file: Blob) => Promise<string>  // 업로드 후 URL 반환
 * - height?: string (기본 520px)
 * - placeholder?: string
 */
export default function TuiMdEditor({
  value = "",
  onChange,
  upload,
  height = "520px",
  placeholder = "여기에 내용을 입력하세요…",
}) {
  const elRef = useRef(null);
  const instRef = useRef(null);

  // 1) 생성
  useEffect(() => {
    if (!elRef.current) return;
    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "wysiwyg", // ← 바로 이미지가 보이게
      previewStyle: "vertical",
      initialValue: value || "",
      usageStatistics: false,
      placeholder,
      hooks: {
        // 붙여넣기/드래그 이미지 → 업로드 → 본문에 삽입
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            callback(url, "image"); // 에디터에 즉시 삽입
          } catch (e) {
            console.error(e);
            alert(e?.message || "이미지 업로드에 실패했어요.");
          }
          return false; // 기본 동작 막기
        },
      },
      events: {
        change: () => {
          onChange?.(editor.getMarkdown());
        },
      },
    });

    instRef.current = editor;
    return () => {
      try {
        editor?.destroy();
      } catch {}
      instRef.current = null;
    };
  }, []); // 한번만 생성

  // 2) 외부 value가 바뀌면 동기화 (필요한 경우에만)
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    const curr = ed.getMarkdown();
    if ((value || "") !== (curr || "")) {
      ed.setMarkdown(value || "");
    }
  }, [value]);

  // 3) 높이 변경 반영(선택)
  useEffect(() => {
    const ed = instRef.current;
    if (!ed) return;
    try {
      ed.setHeight(height);
    } catch {}
  }, [height]);

  return <div ref={elRef} />;
}
