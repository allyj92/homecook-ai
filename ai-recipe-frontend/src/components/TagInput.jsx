// src/components/TagInput.jsx
import { useEffect, useMemo, useRef } from "react";
import Tagify from "@yaireo/tagify";
import "@yaireo/tagify/dist/tagify.css";

/**
 * TagInput (Tagify 기반)
 * props:
 *  - value: string[] | Array<{value:string}> | string
 *  - onChange: (string[]) => void
 *  - placeholder?: string
 *  - maxTags?: number
 *  - maxLength?: number     // 각 태그 최대 길이 (default 30)
 *  - lowercase?: boolean    // 소문자 강제 (default true)
 */
export default function TagInput({
  value = [],
  onChange,
  placeholder = "태그 입력 후 Enter",
  maxTags = 10,
  maxLength = 30,
  lowercase = true,
}) {
  const inputRef = useRef(null);
  const tagifyRef = useRef(null);

  // ---- sanitize helpers ----------------------------------------------------
  const stripHtml = (s = "") =>
    String(s)
      .replace(/<[^>]*>/g, " ")
      .replace(/[<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const canon = (s = "") => {
    let t = stripHtml(s);
    if (lowercase) t = t.toLowerCase();
    return t.slice(0, maxLength);
  };

  const normalize = (v) => {
    if (!v && v !== 0) return "";
    if (typeof v === "string") return canon(v);
    if (typeof v === "object" && v) return canon(v.value ?? v.text ?? String(v));
    return canon(String(v));
  };

  const normalizeArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v))
      return v.map(normalize).filter(Boolean);
    if (typeof v === "string")
      return v
        .split(/[,\s]+/)
        .map(normalize)
        .filter(Boolean);
    return [];
  };

  // 외부에서 온 값(정규화)
  const external = useMemo(() => normalizeArray(value), [JSON.stringify(value), maxLength, lowercase]);

  // ---- mount / re-create on option changes --------------------------------
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // 기존 인스턴스 정리
    try { tagifyRef.current?.destroy(); } catch {}
    tagifyRef.current = new Tagify(el, {
      maxTags,
      duplicates: false,
      enforceWhitelist: false,
      placeholder,
      dropdown: { enabled: 0 },
      delimiters: ",| ",            // 쉼표/공백/Enter 로 분리
      skipInvalid: true,            // validate 통과 못하면 즉시 무시
      editTags: 1,                  // 태그 더블클릭 편집 허용
      originalInputValueFormat: (valuesArr) =>
        JSON.stringify(valuesArr.map((v) => v.value)),

      // 입력 → 태그로 만들기 전 정제
      transformTag: (tagData) => {
        tagData.value = canon(tagData.value);
        return tagData;
      },

      // 최종 검증
      validate: (tagData) => {
        const v = canon(tagData.value);
        // 공백/HTML/길이/제어문자/URL류 간단 차단
        if (!v) return false;
        if (/[<>]/.test(v)) return false;
        if (v.length > maxLength) return false;
        if (/^https?:\/\//i.test(v)) return false;
        return true;
      },
    });

    // 초기 값 주입
    try { tagifyRef.current.addTags(external); } catch {}

    // 이벤트 → 상위로 배열 발행
    const emit = () => {
      const arr = (tagifyRef.current?.value || []).map((t) => normalize(t.value));
      // 중복 제거(순서 유지)
      const seen = new Set();
      const uniq = arr.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
      onChange?.(uniq.slice(0, maxTags));
    };

    const inst = tagifyRef.current;
    inst.on("add", emit);
    inst.on("remove", emit);
    inst.on("blur", emit);
    inst.on("invalid", emit);
    inst.on("edit:updated", emit);
    inst.on("paste", () => setTimeout(emit, 0)); // 붙여넣기 후 동기화

    return () => {
      try { inst.destroy(); } catch {}
      tagifyRef.current = null;
    };
    // 옵션 변경 시에만 재생성
  }, [maxTags, maxLength, lowercase, placeholder]);

  // ---- external value sync (controlled) -----------------------------------
  useEffect(() => {
    const inst = tagifyRef.current;
    if (!inst) return;
    const curr = (inst.value || []).map((t) => normalize(t.value));
    // 동일하면 skip (순서까지 비교)
    if (JSON.stringify(curr) === JSON.stringify(external)) return;

    inst.removeAllTags();
    try { inst.addTags(external); } catch {}
  }, [external]);

  return <input ref={inputRef} className="form-control" aria-label="태그 입력" />;
}