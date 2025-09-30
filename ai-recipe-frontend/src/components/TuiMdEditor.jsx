import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

const TuiMdEditor = forwardRef(function TuiMdEditor(
  { initialValue = "", height = "480px", onUploadImage },
  ref
) {
  const elRef = useRef(null);
  const instRef = useRef(null);

  useEffect(() => {
    instRef.current = new Editor({
      el: elRef.current,
      initialEditType: "markdown",
      previewStyle: "vertical",
      height,
      initialValue,
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          try {
            if (onUploadImage) {
              const url = await onUploadImage(blob);
              if (url) callback(url, blob.name || "image");
            }
          } catch (e) {
            console.error(e);
            alert("이미지 업로드 실패");
          }
          return false; // 기본 업로드 막기
        },
      },
    });
    return () => instRef.current?.destroy();
  }, [height, initialValue, onUploadImage]);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => instRef.current?.getMarkdown() || "",
    setMarkdown: (md) => instRef.current?.setMarkdown(md ?? ""),
    insertText: (txt) => instRef.current?.insertText(txt ?? ""),
  }));

  return <div ref={elRef} />;
});

export default TuiMdEditor;
