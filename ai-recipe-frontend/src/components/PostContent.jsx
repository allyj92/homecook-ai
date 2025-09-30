import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({
  html: false,     // 생 HTML 금지
  linkify: true,   // URL 자동 링크
  breaks: true,    // 줄바꿈 -> <br>
});

// 이미지 허용
const ALLOWED_TAGS = [
  "p","br","blockquote","pre","code","span","strong","em","ul","ol","li",
  "a","img","h1","h2","h3","h4","h5","h6","hr","table","thead","tbody","tr","th","td"
];
const ALLOWED_ATTR = ["href","target","rel","src","alt","title"];

export default function PostContent({ markdown }) {
  const html = useMemo(() => {
    const raw = md.render(markdown || "");
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      USE_PROFILES: { html: true },
    });
  }, [markdown]);

  return <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />;
}