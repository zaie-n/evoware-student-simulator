const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptTags = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.map(match => match[1]).filter(source => source.trim());

assert.ok(html.includes('<script src="validator.js"></script>'), "index.html must load validator.js");
assert.ok(html.includes('<script src="worktable.js"></script>'), "index.html must load worktable movement helpers");
assert.ok(html.includes('id="pauseRun"') && html.includes('id="simAction"'), "Live simulation must expose pause and current-action feedback");
assert.ok(html.includes("async function executeSimulationCommand(command,token)"), "Run simulation must execute commands through the live simulation engine");
assert.ok(html.includes("function moveSimulationArm(label,wells=[])"), "Live worktable must animate the arm to configured labware and wells");
assert.ok(html.includes('setAttribute("class","simulation-arm-layer")'), "Worktable must include an animated LiHa arm overlay");
assert.ok(html.includes("simulationPlaying=true"), "Run simulation must execute the method continuously");
assert.ok(html.includes("function buildExecutionPlan()"), "Simulation must expand loop bodies into repeated execution steps");
assert.ok(html.includes("for(let cycle=1;cycle<=cycles;cycle++)appendRange(i+1,end"), "Loop cycles must repeat the commands inside the matching loop");
assert.ok(html.includes("loopPath.map(x=>x.name+\" \"+x.cycle+\"/\"+x.total)"), "Execution feedback must identify the active loop iteration");
assert.ok(html.includes("runSteps=buildExecutionPlan()"), "Run preparation must build the expanded execution plan");
assert.ok(html.includes("simulationPlaying=false"), "Simulation must support pausing and stepping");
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
assert.ok(html.indexOf('<section class="panel workpanel">') < html.indexOf('<section class="panel simulation-controls-panel">') && html.indexOf('<section class="panel simulation-controls-panel">') < html.indexOf('<div class="lower">'), "Simulation controls must sit below the worktable and above the lower panels");
assert.ok(html.indexOf('<section class="panel validation-panel" id="validationPanel">') > html.indexOf('<div class="lower">') && html.indexOf('<section class="panel validation-panel" id="validationPanel">') < html.indexOf('<section class="panel"><div class="phead">Execution Log</div>'), "Validation Results must replace Method Execution beside the Execution Log");
assert.ok(!html.includes('<div class="phead">Method Execution</div>'), "The old Method Execution panel must be removed");
assert.ok(html.includes(".validation-panel{margin:0;display:block;visibility:hidden;height:0;overflow:hidden;border:0}.validation-panel.visible{visibility:visible;height:auto;border:1px solid #aeb9c4}"), "Validation Results must reserve its lower-panel position but remain invisible until validation");
assert.ok(!html.includes('id="validate" class="primary"') && html.includes('id="validate" class="btn primary"'), "Validate must be moved into the controls below the worktable");
assert.ok(!html.includes('rows[index].scrollIntoView'), "Automatic command highlighting must not scroll the whole page during simulation");
assert.ok(html.includes('$("validationPanel").classList.add("visible");'), "Clicking Validate must reveal the validation results panel");
assert.ok(html.includes('$("resetRun").onclick=()=>{simulationRunId++;') && html.includes('$("validationPanel").classList.remove("visible");'), "Reset Run must cancel execution and hide the validation results panel");
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
