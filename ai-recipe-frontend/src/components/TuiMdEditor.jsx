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

  // 1) 에디터 생성 (한 번만)
  useEffect(() => {
    if (!elRef.current) return;

    const editor = new Editor({
      el: elRef.current,
      height,
      initialEditType: "markdown",     // ✅ 항상 Markdown 모드
      previewStyle: "vertical",
      initialValue: value || "",
      usageStatistics: false,
      placeholder,
      hooks: {
        // 붙여넣기/드래그 이미지 → 업로드 → Markdown으로 삽입
        addImageBlobHook: async (blob, callback) => {
          try {
            if (!upload) throw new Error("업로드 함수가 없습니다.");
            const url = await upload(blob);
            if (!url) throw new Error("업로드 응답에 URL이 없습니다.");
            // ✅ HTML <img>가 아니라 Markdown으로 삽입
            editor.insertText(`![image](${url})\n`);
            // 콜백은 뷰어/미리보기에 도움(필수는 아님)
            callback(url, "image");
          } catch (e) {
            console.error(e);
            alert(e?.message || "이미지 업로드에 실패했어요.");
          }
          // 기본 동작(내장 업로더) 방지
          return false;
        },
      },
    });

    // 변경 감지 → 항상 Markdown으로 외부에 전달
    editor.on("change", () => {
      onChange?.(editor.getMarkdown());
    });

    instRef.current = editor;

    return () => {
      try {
        editor.destroy();
      } catch {}
      instRef.current = null;
    };
    // 생성은 한 번만. height/placeholder 변경은 아래 별도 effect에서 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 외부 value 변경 시 동기화(필요할 때만 갱신)
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
