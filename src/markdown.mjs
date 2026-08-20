import { normalizeHeading } from "./util.mjs";

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

export function parseMarkdown(body) {
  const source = stripHtmlComments(String(body || ""));
  const lines = source.split(/\r?\n/);
  const sections = [];
  const visibleLines = [];
  let fence = null;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      if (current) current.lines.push(line);
      continue;
    }
    if (fence) {
      if (current) current.lines.push(line);
      continue;
    }
    visibleLines.push({ line, number: index + 1 });
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = {
        level: heading[1].length,
        heading: heading[2].trim(),
        normalizedHeading: normalizeHeading(heading[2]),
        startLine: index + 1,
        lines: []
      };
    } else if (current) current.lines.push(line);
  }
  if (current) sections.push(current);

  for (const section of sections) {
    section.content = section.lines.join("\n").trim();
    section.checked = [];
    section.unchecked = [];
    section.lines.forEach((line, offset) => {
      const checkbox = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (!checkbox) return;
      const item = { text: checkbox[2].trim(), line: section.startLine + offset + 1 };
      if (checkbox[1].toLowerCase() === "x") section.checked.push(item);
      else section.unchecked.push(item);
    });
  }

  return {
    source,
    sections,
    visibleText: visibleLines.map(({ line }) => line).join("\n"),
    getSection(heading) {
      const normalized = normalizeHeading(heading);
      return sections.find((section) => section.normalizedHeading === normalized) || null;
    }
  };
}
