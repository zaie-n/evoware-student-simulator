const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptTags = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.map(match => match[1]).filter(source => source.trim());

assert.ok(html.includes('<script src="validator.js"></script>'), "index.html must load validator.js");
assert.ok(html.includes('<script src="worktable.js"></script>'), "index.html must load worktable movement helpers");
assert.ok(html.includes('id="renameItem"') && html.includes('id="removeItem"'), "Selected labware must show Rename labware next to Remove labware");
assert.ok(html.includes("EvoWareWorktable.renameLabware(deck,x.pos,x.site,requested)"), "Rename labware action must use the rename helper");
assert.ok(html.includes("Associated commands were not changed automatically"), "Rename confirmation must state associated commands are not updated automatically");
assert.ok(html.includes("function updateDeckSelectionHighlight()"), "Worktable selection must update visible highlighting");
assert.ok(html.includes(".carrier.selected-carrier"), "Selected carrier must receive a yellow outline");
assert.ok(html.includes(".labware.selected-labware"), "Selected labware must receive a yellow outline");
assert.ok(html.includes('el.classList.toggle("selected-carrier",!!chosen)'), "Carrier highlight must track the selected carrier");
assert.ok(html.includes('el.classList.toggle("selected-labware",!!chosen)'), "Labware highlight must track the selected labware");
assert.ok(html.includes('EvoWareWorktable.isSiteCompatible(c,j,name,carrierTypes)'), "Labware placement must validate a specific carrier site before adding it");
assert.ok(html.includes('EvoWareWorktable.isLabelUnique(deck,exactName,pos,j)'), "Labware placement must reject duplicate exact labels immediately");
assert.ok(html.includes('The DiTi Waste container can only be placed in position 3 of this carrier.'), "The carrier properties panel must explain the DiTi Waste position rule");
assert.ok(html.includes('DiTi Waste can only be placed in position 3 of a DiTi 2Pos + Waste carrier.'), "Invalid DiTi Waste placement must be rejected immediately");
assert.ok(html.includes('title.draggable=true'), "Carrier headers must be draggable");
assert.ok(html.includes('z.draggable=true'), "Placed labware must be draggable");
assert.ok(html.includes('moveCarrierOnDeck(dragMove.fromPos,i)'), "Worktable must support moving or swapping whole carriers");
assert.ok(html.includes('moveLabwareOnDeck(dragMove.fromPos,dragMove.fromSite,i,j)'), "Worktable must support moving or swapping individual labware");
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
