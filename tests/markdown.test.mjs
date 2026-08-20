import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "../src/markdown.mjs";

test("parser finds sections and checked items while ignoring fenced headings", () => {
  const parsed = parseMarkdown(`## Summary\nUseful content\n\n\`\`\`md\n## Fake\n\`\`\`\n\n## Validation\n- [x] Tests run\n- [ ] Release cut\n`);
  assert.equal(parsed.getSection("Summary").content.includes("Useful content"), true);
  assert.equal(parsed.getSection("Fake"), null);
  assert.deepEqual(parsed.getSection("Validation").checked.map((item) => item.text), ["Tests run"]);
});
