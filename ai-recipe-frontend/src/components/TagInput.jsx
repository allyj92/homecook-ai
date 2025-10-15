import { useEffect, useRef } from "react";
import Tagify from "@yaireo/tagify";
import "@yaireo/tagify/dist/tagify.css";

export default function TagInput({
  value = [],
  onChange,
  placeholder = "태그 입력 후 Enter",
  maxTags = 10,
}) {
  const inputRef = useRef(null);
  const tagifyRef = useRef(null);

  // 최초/옵션 변경 시 인스턴스 생성
  useEffect(() => {
    if (!inputRef.current) return;

    // 기존 인스턴스 정리
    try { tagifyRef.current?.destroy(); } catch {}
    tagifyRef.current = new Tagify(inputRef.current, {
      originalInputValueFormat: (valuesArr) => valuesArr.map((v) => v.value),
      enforceWhitelist: false,
      duplicates: false,
      maxTags,
      dropdown: { enabled: 0 },
      placeholder,
    });

    // 초기 값 주입
    try { tagifyRef.current.addTags(value); } catch {}

    const emit = () => {
      const vals = (tagifyRef.current?.value || []).map((t) => t.value);
      onChange?.(vals);
    };

    tagifyRef.current.on("add", emit);
    tagifyRef.current.on("remove", emit);
    tagifyRef.current.on("blur", emit);
    tagifyRef.current.on("invalid", emit);

    return () => {
      try { tagifyRef.current?.destroy(); } catch {}
      tagifyRef.current = null;
    };
  }, [maxTags, placeholder]);

  // 외부에서 value가 바뀌면 동기화
  useEffect(() => {
    const inst = tagifyRef.current;
    if (!inst) return;
    const curr = (inst.value || []).map((t) => t.value);
    const next = Array.isArray(value) ? value : [];
    if (JSON.stringify(curr) !== JSON.stringify(next)) {
      inst.removeAllTags();
      try { inst.addTags(next); } catch {}
    }
  }, [value]);

  return <input ref={inputRef} className="form-control" />;
}
