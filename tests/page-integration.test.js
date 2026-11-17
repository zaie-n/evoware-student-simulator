const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptTags = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.map(match => match[1]).filter(source => source.trim());

assert.ok(html.includes('<script src="validator.js"></script>'), "index.html must load validator.js");
assert.ok(html.includes('<script src="worktable.js"></script>'), "index.html must load worktable movement helpers");
assert.ok(!html.includes("Drag commands into the Script Editor. For the worktable"), "The small instructional text under the Control Bar must be removed");
assert.ok(html.includes('id="toggleInfopad"') && html.includes('id="infopadPanel"'), "INFOPAD must have a dedicated collapse control");
assert.ok(html.includes('panel.classList.toggle("collapsed")') && html.includes('collapsed?"Expand":"Collapse"'), "INFOPAD control must collapse and expand its properties area");
assert.ok(html.includes('deck=Array.from({length:8},()=>null)'), "Worktable must contain exactly eight deck positions");
assert.ok(html.includes('grid-template-columns:repeat(8,minmax(0,1fr))') && html.includes('min-width:0;width:100%'), "Eight worktable positions must fit the available workspace width");
assert.ok(html.indexOf('<section class="panel workpanel">') > html.indexOf('id="infopadPanel"') && html.indexOf('<section class="panel workpanel">') < html.indexOf('<section class="panel simulation-controls-panel">'), "Worktable must sit beneath INFOPAD in the workspace column");
assert.ok(html.includes('"Start Timer":{timerName:"mix_timer",seconds:30}') && html.includes('"Wait for Timer":{timerName:"mix_timer"}'), "Start Timer and Wait for Timer must share a default timer name");
assert.ok(html.includes('input("timerName","Timer name"') && html.includes('input("timerName","Timer name to wait for"'), "Start Timer and Wait for Timer must expose their shared timer-name property");
assert.ok(!html.includes('input("timer","Timer name"'), "Wait for Timer must not show a redundant second timer-name field");
assert.ok(html.includes('await waitForNamedTimer(String(command.params.timerName||"").trim(),token)'), "Wait for Timer must match the Start Timer name through the single timerName property");
assert.ok(html.includes('simulationTimers[timerName]={startedAt:Date.now(),durationMs:Math.max(0,Number(activeCommand.params.seconds)||0)*1000}'), "Start Timer must record its named duration and start time");
assert.ok(html.includes('await waitForNamedTimer(String(command.params.timerName||"").trim(),token)'), "Wait for Timer must block execution until its named timer reaches the configured duration");
assert.ok(html.includes('timer.startedAt+timer.durationMs-Date.now()') && html.includes('await new Promise(resolve=>setTimeout(resolve,remaining))'), "Wait for Timer must wait only for the remaining time on the named timer");
assert.ok(html.includes('simulationTimers={};mountedSimulationChannels={};'), "A fresh simulation run must clear prior timer state");

assert.ok(html.includes('id="pauseRun"') && html.includes('id="simAction"'), "Live simulation must expose pause and current-action feedback");
assert.ok(html.includes("async function executeSimulationCommand(command,token,loopPath=[],sampleChannels=null,variableValues={})"), "Run simulation must execute commands through the live simulation engine");
assert.ok(html.includes("function moveSimulationArm(label,wells=[])"), "Live worktable must animate the arm to configured labware and wells");
assert.ok(html.includes('setAttribute("class","simulation-arm-layer")'), "Worktable must include an animated LiHa arm overlay");
assert.ok(html.includes("simulationPlaying=true"), "Run simulation must execute the method continuously");
assert.ok(html.includes("function buildExecutionPlan()"), "Simulation must expand loop bodies into repeated execution steps");
const planStart = html.indexOf("function buildExecutionPlan(){");
const planEnd = html.indexOf("\nfunction prepareRun()", planStart);
assert.ok(planStart >= 0 && planEnd > planStart, "Variable-aware execution planner must be present");
const planSource = html.slice(planStart, planEnd);
const planExpressionStart = html.indexOf("function evaluateNumericExpression");
const planExpressionEnd = html.indexOf("\nfunction addChannelPicker", planExpressionStart);
const planExpressionSource = html.slice(planExpressionStart, planExpressionEnd);
const makePlan = new Function("method", planExpressionSource + "\n" + planSource + "\nreturn buildExecutionPlan();");
const variablePlan = makePlan([
  {name:"Set Variable",params:{name:"Num_Samples",value:12}},
  {name:"Begin Loop",params:{loopName:"Bead addition",cycles:"Num_Samples"}},
  {name:"User Prompt",params:{message:"Sample operation"}},
  {name:"End Loop",params:{loopName:"Bead addition"}},
  {name:"Set Variable",params:{name:"Another_Count",value:3}},
  {name:"Begin Loop",params:{loopName:"Elution",cycles:"Another_Count"}},
  {name:"User Prompt",params:{message:"Elution operation"}},
  {name:"End Loop",params:{loopName:"Elution"}}
]);
assert.equal(variablePlan.filter(step => step.commandIndex === 3).length, 12, "SAMPLE_CNT must expand the first loop to the user's numeric sample count");
assert.equal(variablePlan.filter(step => step.commandIndex === 6).length, 3, "Resetting SAMPLE_CNT must change the next loop's iteration count");
const samplePlan = makePlan([
  {name:"Set Variable",params:{name:"Num_Samples",value:12}},
  {name:"Set Variable",params:{name:"SAMPLE_CNT",value:"Num_Samples"}},
  {name:"Begin Loop",params:{loopName:"Bead pipetting",cycles:"SAMPLE_CNT"}},
  {name:"Get DiTi",params:{channels:[1,2,3,4,5,6,7,8]}},
  {name:"Aspirate",params:{channels:[1,2,3,4,5,6,7,8],wells:["A1","B1","C1","D1","E1","F1","G1","H1"]}},
  {name:"Dispense",params:{channels:[1,2,3,4,5,6,7,8],wells:["A1","B1","C1","D1","E1","F1","G1","H1"]}},
  {name:"Drop DiTi",params:{channels:[1,2,3,4,5,6,7,8]}},
  {name:"End Loop",params:{loopName:"Bead pipetting"}}
]);
const getTipSteps = samplePlan.filter(step=>step.commandIndex===3);
const aspirateSteps = samplePlan.filter(step=>step.commandIndex===4);
assert.equal(getTipSteps.length,2,"12 samples on an 8-channel LiHa must create two loop cycles, not twelve");
assert.deepEqual(getTipSteps.map(step=>step.sampleChannels.length),[8,4],"The final cycle must select only the remaining four channels");
assert.deepEqual(aspirateSteps.map(step=>step.sampleChannels.length),[8,4],"All sample-dependent pipetting commands must use the same partial final tip mask");
assert.deepEqual(aspirateSteps[1].sampleChannels,[1,2,3,4],"The final cycle must retain physical channel identity and use the first four selected tips");
const resetSamplePlan = makePlan([
  {name:"Set Variable",params:{name:"Num_Samples",value:12}},
  {name:"Set Variable",params:{name:"SAMPLE_CNT",value:"Num_Samples"}},
  {name:"Begin Loop",params:{loopName:"First sample loop",cycles:"SAMPLE_CNT"}},
  {name:"Get DiTi",params:{channels:[1,2,3,4,5,6,7,8]}},
  {name:"End Loop",params:{loopName:"First sample loop"}},
  {name:"Set Variable",params:{name:"SAMPLE_CNT",value:"Num_Samples"}},
  {name:"Begin Loop",params:{loopName:"Second sample loop",cycles:"SAMPLE_CNT"}},
  {name:"Get DiTi",params:{channels:[1,2,3,4,5,6,7,8]}},
  {name:"End Loop",params:{loopName:"Second sample loop"}}
]);
assert.equal(resetSamplePlan.filter(step=>step.commandIndex===3).length,2,"The first SAMPLE_CNT loop must cover 12 samples in two cycles");
assert.equal(resetSamplePlan.filter(step=>step.commandIndex===7).length,2,"Reassigning SAMPLE_CNT must restore the sample count for the next loop");



assert.ok(html.includes('input("value","Numeric value or existing variable name"'), "Set Variable must accept a custom numeric value or a variable reference");
assert.ok(html.includes('input("cycles","Loop cycles (use SAMPLE_CNT for sample-aware looping)"'), "Begin Loop must accept a variable name such as SAMPLE_CNT");
assert.ok(html.includes('resolved=resolveValue(rawCycles)'), "Execution planning must resolve variable-driven loop counts");
assert.ok(html.includes('variables[name.toUpperCase()]=value'), "Set Variable must update the variable environment used by subsequent loops");
assert.ok(html.includes("for(let cycle=1;cycle<=cycles;cycle++){"), "Loop cycles must repeat the commands inside the matching loop");
assert.ok(html.includes("loopPath.map(x=>x.name+\" \"+x.cycle+\"/\"+x.total)"), "Execution feedback must identify the active loop iteration");
assert.ok(html.includes("runSteps=buildExecutionPlan(overrides)"), "Run preparation must build the expanded execution plan");
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
assert.ok(html.includes('let dims=["column","row","well"]'), "Loop options must include only column, row, and well advancement");
assert.ok(!html.includes('"labware"') || !html.includes('let dims=["column","row","well","labware"]'), "Labware advancement must be removed from loop options");
assert.ok(html.includes("function applyLoopWellOffsets(command,loopPath)"), "Simulation must calculate well offsets from active loop iterations");
assert.ok(html.includes("executeSimulationCommand(command,token,step.loopPath,step.sampleChannels,step.variables||{})"), "Each executed command must receive its active nested loop path");
const offsetStart = html.indexOf("function applyLoopWellOffsets(command,loopPath){");
const offsetEnd = html.indexOf("\nfunction describeSimulationCommand", offsetStart);
assert.ok(offsetStart >= 0 && offsetEnd > offsetStart, "Loop well offset helper must be present");
const offsetSource = html.slice(offsetStart, offsetEnd);
const makeOffsetHelper = new Function("command","loopPath","getLabwareItems","wellLayout","commandTarget", offsetSource + "\nreturn applyLoopWellOffsets;");
const plate = {label:"Plate A",name:"96 Well Microplate"};
const getPlate = () => [plate];
const plateLayout = () => ({rows:8,cols:12,kind:"plate"});
const targetLabel = command => command.params.source || command.params.destination || command.params.target;
const applyOffsets = makeOffsetHelper(null,null,getPlate,plateLayout,targetLabel);
const makeCommand = (name, scope, wells, options) => ({name,params:{[scope]:"Plate A",wells,loopOptions:{enabled:true,[scope]:options}}});
const advance = applyOffsets(makeCommand("Aspirate","source",["B3","E3"],{row:{enabled:true,step:1}}),[{name:"Outer",cycle:2,total:3}],getPlate,plateLayout,targetLabel);
assert.deepEqual(advance.params.wells,["C3","F3"], "Row advancement must preserve columns and multi-channel spacing");
const columns = applyOffsets(makeCommand("Dispense","destination",["B3","E3"],{column:{enabled:true,step:2}}),[{name:"Outer",cycle:2,total:3}],getPlate,plateLayout,targetLabel);
assert.deepEqual(columns.params.wells,["B5","E5"], "Column advancement must preserve rows and apply the configured step");
const wells = applyOffsets(makeCommand("Mix","target",["B3","E3"],{well:{enabled:true,step:1}}),[{name:"Outer",cycle:2,total:3}],getPlate,plateLayout,targetLabel);
assert.deepEqual(wells.params.wells,["B4","E4"], "Well advancement must move sequentially through the plate");
const nested = applyOffsets(makeCommand("Aspirate","source",["B3"],{row:{enabled:true,step:1}}),[{name:"Outer",cycle:2,total:3},{name:"Inner",cycle:3,total:4}],getPlate,plateLayout,targetLabel);
assert.deepEqual(nested.params.wells,["E3"], "Nested loop offsets must accumulate across enclosing iterations");
const outOfBounds = applyOffsets(makeCommand("Aspirate","source",["H12"],{row:{enabled:true,step:1}}),[{name:"Outer",cycle:2,total:3}],getPlate,plateLayout,targetLabel);
assert.deepEqual(outOfBounds.params.wells,["OUT OF RANGE"], "Loop advancement must not wrap beyond the edge of labware");


assert.ok(html.includes('input("cycles","Loop cycles"'), "Loop cycle field should not include the SAMPLE_CNT parenthetical");
assert.ok(html.includes('["SAMPLE_CNT","Custom Variable"]'), "Set Variable should offer SAMPLE_CNT and Custom Variable choices");
assert.ok(html.includes('password!=="purify"'), "Premade bead-cleanup templates should require the instructor password");
assert.ok(html.includes('waste-stream-symbol'), "DiTi Waste should render as a waste-stream outline, not a channel bank");
const expressionStart = html.indexOf("function evaluateNumericExpression");
const expressionEnd = html.indexOf("\\nfunction addChannelPicker", expressionStart);
assert.ok(expressionStart >= 0 && expressionEnd > expressionStart, "Arithmetic expression evaluator should be present");
const evaluateExpression = new Function(html.slice(expressionStart, expressionEnd) + "\\nreturn evaluateNumericExpression;")();
assert.equal(evaluateExpression("SAMPLE_CNT*4", {SAMPLE_CNT:4}), 16, "Arithmetic should resolve variables in numeric fields");
assert.equal(evaluateExpression("(SAMPLE_CNT+2)/2", {SAMPLE_CNT:4}), 3, "Arithmetic should support precedence and parentheses");
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
