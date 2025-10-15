import { useEffect, useMemo, useRef } from "react";
import Tagify from "@yaireo/tagify";
import "@yaireo/tagify/dist/tagify.css";

/**
 * TagInput (Tagify 기반)
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
    if (Array.isArray(v)) return v.map(normalize).filter(Boolean);
    if (typeof v === "string")
      return v.split(/[,\s]+/).map(normalize).filter(Boolean);
    return [];
  };

  const external = useMemo(() => normalizeArray(value), [JSON.stringify(value), maxLength, lowercase]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    try { tagifyRef.current?.destroy(); } catch {}
    tagifyRef.current = new Tagify(el, {
      maxTags,
      duplicates: false,
      enforceWhitelist: false,
      placeholder,
      dropdown: { enabled: 0 },
      delimiters: ",| ",
      skipInvalid: true,
      editTags: 1,
      originalInputValueFormat: (valuesArr) =>
        JSON.stringify(valuesArr.map((v) => v.value)),
      transformTag: (tagData) => {
        tagData.value = canon(tagData.value);
        return tagData;
      },
      validate: (tagData) => {
        const v = canon(tagData.value);
        if (!v) return false;
        if (/[<>]/.test(v)) return false;
        if (v.length > maxLength) return false;
        if (/^https?:\/\//i.test(v)) return false;
        return true;
      },
    });

    try { tagifyRef.current.addTags(external); } catch {}

    const emit = () => {
      const arr = (tagifyRef.current?.value || []).map((t) => normalize(t.value));
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
    inst.on("paste", () => setTimeout(emit, 0));

    return () => {
      try { inst.destroy(); } catch {}
      tagifyRef.current = null;
    };
  }, [maxTags, maxLength, lowercase, placeholder]);

  useEffect(() => {
    const inst = tagifyRef.current;
    if (!inst) return;
    const curr = (inst.value || []).map((t) => normalize(t.value));
    if (JSON.stringify(curr) === JSON.stringify(external)) return;
    inst.removeAllTags();
    try { inst.addTags(external); } catch {}
  }, [external]);

  return <input ref={inputRef} className="form-control" aria-label="태그 입력" />;
}