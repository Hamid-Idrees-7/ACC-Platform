// A small, safe markdown renderer for AI replies (bold, italic, code, lists, headings).
// Everything is HTML escaped first, so only our own tags end up in the output. The result
// is meant for dangerouslySetInnerHTML on assistant messages only.

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineMd = (s) =>
  s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

export const renderMarkdown = (text) => {
  const lines = escapeHtml(text || "").split(/\r?\n/);
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { closeList(); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (bullet) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inlineMd(bullet[1])}</li>`);
    } else if (numbered) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inlineMd(numbered[1])}</li>`);
    } else if (heading) {
      closeList();
      out.push(`<h4>${inlineMd(heading[1])}</h4>`);
    } else {
      closeList();
      out.push(`<p>${inlineMd(line.trim())}</p>`);
    }
  }
  closeList();
  return out.join("");
};
