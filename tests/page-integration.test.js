const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptTags = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.map(match => match[1]).filter(source => source.trim());

assert.ok(html.includes('<script src="validator.js"></script>'), "index.html must load validator.js");
assert.ok(html.includes("EvoWareValidator.validateMethod(method,deck,carrierTypes)"), "Validate button must call the extracted validator");
assert.ok(html.includes('select("waste","DiTi Waste to use",wastes,c.params.waste)'), "Drop DiTi properties must include a DiTi waste selector");
assert.ok(html.includes('"Drop DiTi":{channels:[1,2,3,4,5,6,7,8],waste:""}'), "Drop DiTi must start with an explicit unselected waste value");
assert.ok(html.includes('row.setAttribute("role","button")'), "Command-specific findings must be selectable");
assert.ok(html.includes("activeChannels.map(ch=>ch-1)"), "Well selection must retain channel gaps relative to channel 1");
assert.ok(html.includes('target.scrollIntoView({block:"nearest",behavior:"smooth"})'), "Selecting a finding must scroll its command into view");
assert.ok(inlineScripts.length > 0, "index.html must contain its application script");

for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error("Inline script " + (index + 1) + " has a syntax error: " + error.message);
  }
}

process.stdout.write("PASS page loads the validator module\n");
process.stdout.write("PASS Drop DiTi exposes the worktable waste selector\n");
process.stdout.write("PASS validation findings can navigate to commands\n");
process.stdout.write("PASS all inline application JavaScript parses successfully\n");
