import Tags from "@yaireo/tagify/dist/react.tagify";
import "@yaireo/tagify/dist/tagify.css";

export default function TagInput({ value = [], onChange, whitelist = [] }) {
  const settings = {
    whitelist,
    dropdown: { enabled: 0 },
    maxTags: 8,
    delimiters: ",| ",
    placeholder: "태그 입력 후 Enter",
  };

  return (
    <Tags
      value={value.join(",")}
      settings={settings}
      onChange={(e) => {
        const items = JSON.parse(e.detail.value || "[]").map((t) => t.value);
        onChange?.(items);
      }}
    />
  );
}
