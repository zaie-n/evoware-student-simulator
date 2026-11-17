const assert = require("node:assert/strict");
const { validateMethod } = require("../validator.js");

const carrierTypes = {
  "MP 4Pos flat": {
    sites: 4,
    compatible: ["96 Well Microplate"],
    label: "4-position microplate carrier"
  },
  "MP 4Pos flat - MagPlate": {
    sites: 4,
    compatible: ["96 Well Microplate - MagPlat"],
    label: "4-position magnetic microplate carrier"
  },
  "DiTi 2Pos + Waste": {
    sites: 3,
    compatible: ["DiTi 1000µL LiHa", "DiTi 200µL LiHa", "DiTi Waste"],
    siteCompatible: {
      0: ["DiTi 1000µL LiHa", "DiTi 200µL LiHa"],
      1: ["DiTi 1000µL LiHa", "DiTi 200µL LiHa"],
      2: ["DiTi Waste"]
    },
    label: "Two DiTi rack sites plus waste at site 3"
  },
  "Trough 3Pos 25+100ml": {
    sites: 3,
    compatible: ["Trough 100ml"],
    label: "Three trough positions"
  },
  "Tube 13mm 16 Pos": {
    sites: 16,
    compatible: ["1.5mL tube", "0.2mL tube"],
    label: "16-position tube carrier"
  }
};

function deckWithSupplies({ includeWaste = true, rackSite = 0, wasteSite = 2, duplicateLabel = false } = {}) {
  const plates = [
    { name: "96 Well Microplate", label: "Samples" },
    { name: "96 Well Microplate", label: duplicateLabel ? "Samples" : "Cleaned samples" },
    null,
    null
  ];
  const tips = [null, null, null];
  tips[rackSite] = { name: "DiTi 200µL LiHa", label: "200uL Tips" };
  if (includeWaste) tips[wasteSite] = { name: "DiTi Waste", label: "Tip Waste" };
  return [
    { name: "MP 4Pos flat", items: plates },
    { name: "DiTi 2Pos + Waste", items: tips }
  ];
}

const channels = [1, 2, 3, 4, 5, 6, 7, 8];
const column1 = ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"];
const getTips = () => ({ name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [...channels] } });
const aspirate = (overrides = {}) => ({
  name: "Aspirate",
  params: {
    source: "Samples",
    volume: 23,
    liquidClass: "Water",
    channels: [...channels],
    wells: [...column1],
    ...overrides
  }
});
const dispense = (overrides = {}) => ({
  name: "Dispense",
  params: {
    destination: "Cleaned samples",
    volume: 23,
    liquidClass: "Water",
    channels: [...channels],
    wells: [...column1],
    ...overrides
  }
});
const mix = (overrides = {}) => ({
  name: "Mix",
  params: {
    target: "Cleaned samples",
    volume: 100,
    cycles: 3,
    channels: [...channels],
    wells: [...column1],
    ...overrides
  }
});
const dropTips = (overrides = {}) => ({
  name: "Drop DiTi",
  params: { channels: [...channels], waste: "Tip Waste", ...overrides }
});
const findingsFor = (method, deck = [], types = carrierTypes) => validateMethod(method, deck, types);
const errors = findings => findings.filter(item => item.severity === "error");
const hasErrorAt = (findings, command) => errors(findings).some(item => item.command === command);
const hasMessage = (findings, text) => findings.some(item => item.message.includes(text));

let passed = 0;
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("matching Begin Loop and End Loop names pass", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "Sample transfer", cycles: 8 } },
    { name: "End Loop", params: { loopName: "Sample transfer" } }
  ]);
  assert.equal(errors(findings).length, 0);
});

test("mismatched loop names point to the End Loop command", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "Sample transfer", cycles: 8 } },
    { name: "Aspirate", params: { channels: [1] } },
    { name: "End Loop", params: { loopName: "Bead wash" } }
  ]);
  assert.equal(hasErrorAt(findings, 3), true);
  assert.equal(hasMessage(findings, 'does not match the active Begin Loop "Sample transfer"'), true);
});

test("properly nested loops close from inner to outer", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "Samples", cycles: 8 } },
    { name: "Begin Loop", params: { loopName: "Wash steps", cycles: 3 } },
    { name: "End Loop", params: { loopName: "Wash steps" } },
    { name: "End Loop", params: { loopName: "Samples" } }
  ]);
  assert.equal(errors(findings).length, 0);
});

test("out-of-order nested loop closure gives one actionable structural error", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "Samples", cycles: 8 } },
    { name: "Begin Loop", params: { loopName: "Wash steps", cycles: 3 } },
    { name: "End Loop", params: { loopName: "Samples" } },
    { name: "End Loop", params: { loopName: "Wash steps" } }
  ]);
  assert.equal(errors(findings).length, 1);
  assert.equal(hasErrorAt(findings, 3), true);
  assert.equal(hasMessage(findings, "Close the inner loop"), true);
});

test("missing loop names are reported at their own command numbers", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "", cycles: 8 } },
    { name: "End Loop", params: { loopName: "" } }
  ]);
  assert.equal(hasErrorAt(findings, 1), true);
  assert.equal(hasErrorAt(findings, 2), true);
});

test("a missing End Loop points to the Begin Loop that was left open", () => {
  const findings = findingsFor([
    { name: "Begin Loop", params: { loopName: "Samples", cycles: 8 } },
    { name: "User Prompt", params: { message: "Continue" } }
  ]);
  assert.equal(hasErrorAt(findings, 1), true);
  assert.equal(hasMessage(findings, 'Begin Loop "Samples" is missing'), true);
});

test("an unmatched End Loop points to the End Loop command", () => {
  const findings = findingsFor([
    { name: "End Loop", params: { loopName: "Samples" } }
  ]);
  assert.equal(hasErrorAt(findings, 1), true);
  assert.equal(hasMessage(findings, "no matching Begin Loop"), true);
});

test("a complete bead-cleanup sequence validates with tip acquisition, transfers, mixing, looping, and disposal", () => {
  const method = [
    { name: "Begin Loop", params: { loopName: "Sample columns", cycles: 8 } },
    getTips(),
    aspirate({ source: "Samples" }),
    dispense({ destination: "Cleaned samples" }),
    mix({ target: "Cleaned samples" }),
    dropTips(),
    { name: "End Loop", params: { loopName: "Sample columns" } }
  ];
  const findings = findingsFor(method, deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
  assert.equal(findings.some(item => item.severity === "warning"), false);
});

test("Get DiTi reports a missing rack at the acquisition command", () => {
  const findings = findingsFor([getTips()], deckWithSupplies({ rackSite: 0, includeWaste: false }).map((carrier, index) => {
    if (index === 1) return { ...carrier, items: [null, null, null] };
    return carrier;
  }));
  assert.equal(hasErrorAt(findings, 1), true);
  assert.equal(hasMessage(findings, "No DiTi 200µL LiHa rack is placed"), true);
});

test("Drop DiTi requires an actual waste item on the worktable", () => {
  const findings = findingsFor([getTips(), dropTips()], deckWithSupplies({ includeWaste: false }));
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "No DiTi Waste item is on the worktable"), true);
});

test("DiTi waste placed in a tip-rack site is flagged as a carrier-site error", () => {
  const findings = findingsFor([getTips(), dropTips()], deckWithSupplies({ wasteSite: 0 }));
  assert.equal(hasMessage(findings, "site 1 has Tip Waste"), true);
});

test("a duplicate labware label is rejected as ambiguous", () => {
  const findings = findingsFor([getTips()], deckWithSupplies({ duplicateLabel: true }));
  assert.equal(hasMessage(findings, "used more than once"), true);
});

test("an invalid well coordinate is reported at the affected liquid-handling command", () => {
  const findings = findingsFor([getTips(), aspirate({ wells: ["Z9"] })], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "Z9 do not exist on Samples"), true);
});

test("a pipetting command cannot target a tip rack", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ source: "200uL Tips" })
  ], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "not a liquid-containing labware type"), true);
});

test("a 200 µL tip cannot be used above its configured range", () => {
  const findings = findingsFor([getTips(), aspirate({ volume: 250 })], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "outside the configured DiTi 200µL LiHa range"), true);
});

test("duplicate channel selections are rejected", () => {
  const findings = findingsFor([getTips(), aspirate({ channels: [1, 1], wells: ["A1", "B1"] })], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "selected more than once"), true);
});

test("Drop DiTi explains that waste is missing even before a waste label is selected", () => {
  const findings = findingsFor([getTips(), dropTips({ waste: "" })], deckWithSupplies({ includeWaste: false }));
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "No DiTi Waste item is on the worktable"), true);
});

test("sparse channel selection preserves physical gaps from the channel 1 reference", () => {
  const sparseTips = { ...getTips(), params: { ...getTips().params, channels: [2, 5] } };
  const findings = findingsFor([
    sparseTips,
    aspirate({ channels: [2, 5], wells: ["B3", "E3"] })
  ], deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("sparse channel selections cannot use compressed well positions", () => {
  const sparseTips = { ...getTips(), params: { ...getTips().params, channels: [2, 5] } };
  const findings = findingsFor([
    sparseTips,
    aspirate({ channels: [2, 5], wells: ["A3", "D3"] })
  ], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "physical spacing of the selected LiHa channels"), true);
});

test("dispense volume equal to aspirated volume is allowed", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ volume: 80 }),
    dispense({ volume: 80 }),
    dropTips()
  ], deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("dispense volume greater than the aspirated volume is rejected", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ volume: 80 }),
    dispense({ volume: 81 })
  ], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 3), true);
  assert.equal(hasMessage(findings, "Dispense volume 81 µL exceeds the liquid volume aspirated"), true);
});

test("multiple aspirates add to the amount available for dispensing", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ volume: 30 }),
    aspirate({ volume: 20 }),
    dispense({ volume: 50 }),
    dropTips()
  ], deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("successive partial dispenses cannot exceed the remaining aspirated volume", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ volume: 30 }),
    dispense({ volume: 20 }),
    dispense({ volume: 11 })
  ], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 4), true);
  assert.equal(hasMessage(findings, "(10 µL available)"), true);
});

test("aspirated volume is tracked independently for each selected channel", () => {
  const findings = findingsFor([
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [1, 2] } },
    aspirate({ channels: [1], wells: ["A1"], volume: 25 }),
    aspirate({ channels: [2], wells: ["B1"], volume: 25 }),
    dispense({ channels: [1], wells: ["A1"], volume: 25 }),
    dispense({ channels: [2], wells: ["B1"], volume: 25 }),
    dropTips({ channels: [1, 2] })
  ], deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("a new tip starts with no previously aspirated liquid", () => {
  const findings = findingsFor([
    getTips(),
    aspirate({ volume: 20 }),
    dropTips(),
    getTips(),
    dispense({ volume: 1 })
  ], deckWithSupplies());
  assert.equal(hasErrorAt(findings, 5), true);
  assert.equal(hasMessage(findings, "Dispense volume 1 µL exceeds the liquid volume aspirated"), true);
});

test("labware labels must match exactly to count as duplicates", () => {
  const deck = deckWithSupplies();
  deck[0].items[1].label = "samples";
  const findings = findingsFor([], deck);
  assert.equal(hasMessage(findings, "used more than once"), false);
});

test("Aspirate, Dispense, and Mix commands flag old labware names after a rename without rewriting parameters", () => {
  const deck = deckWithSupplies();
  deck[0].items[0] = { ...deck[0].items[0], label: "Incoming samples", renamedFrom: ["Samples"] };
  deck[0].items[1] = { ...deck[0].items[1], label: "Product plate", renamedFrom: ["Cleaned samples"] };
  const method = [
    getTips(),
    aspirate({ source: "Samples" }),
    dispense({ destination: "Cleaned samples" }),
    mix({ target: "Cleaned samples" }),
    dropTips()
  ];
  const findings = findingsFor(method, deck);
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasErrorAt(findings, 3), true);
  assert.equal(hasErrorAt(findings, 4), true);
  assert.equal(findings.filter(item =>
    item.message.includes("Update the labware selection manually") &&
    item.message.includes("not changed automatically")
  ).length, 3);
  assert.equal(method[1].params.source, "Samples");
  assert.equal(method[2].params.destination, "Cleaned samples");
  assert.equal(method[3].params.target, "Cleaned samples");
});

test("Drop DiTi flags an old waste-container name after rename without rewriting the selection", () => {
  const deck = deckWithSupplies();
  deck[1].items[2] = {
    ...deck[1].items[2],
    label: "Used tip container",
    renamedFrom: ["Tip Waste"]
  };
  const method = [getTips(), dropTips({ waste: "Tip Waste" })];
  const findings = findingsFor(method, deck);
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, 'previously named "Tip Waste"'), true);
  assert.equal(hasMessage(findings, 'renamed to "Used tip container"'), true);
  assert.equal(method[1].params.waste, "Tip Waste");
});

test("commands validate after the user manually selects the renamed labware name", () => {
  const deck = deckWithSupplies();
  deck[0].items[0] = { ...deck[0].items[0], label: "Incoming samples", renamedFrom: ["Samples"] };
  deck[0].items[1] = { ...deck[0].items[1], label: "Product plate", renamedFrom: ["Cleaned samples"] };
  const findings = findingsFor([
    getTips(),
    aspirate({ source: "Incoming samples" }),
    dispense({ destination: "Product plate" }),
    mix({ target: "Product plate" }),
    dropTips()
  ], deck);
  assert.equal(hasErrorAt(findings, 2), false);
  assert.equal(hasErrorAt(findings, 3), false);
  assert.equal(hasErrorAt(findings, 4), false);
  assert.equal(findings.filter(item => item.severity === "error").length, 0,
    JSON.stringify(errors(findings), null, 2));
});

test("Wait for Timer validates the shared timerName property", () => {
  const valid = findingsFor([
    { name: "Start Timer", params: { timerName: "bead_mix", seconds: 30 } },
    { name: "Wait for Timer", params: { timerName: "bead_mix" } }
  ]);
  assert.equal(errors(valid).length, 0, JSON.stringify(errors(valid), null, 2));

  const missing = findingsFor([
    { name: "Start Timer", params: { timerName: "bead_mix", seconds: 30 } },
    { name: "Wait for Timer", params: { timerName: "" } }
  ]);
  assert.equal(hasErrorAt(missing, 2), true);
  assert.equal(hasMessage(missing, "Specify the timer this command should wait for"), true);
});

test("custom numeric variables can be assigned to SAMPLE_CNT and used as loop counts", () => {
  const findings = findingsFor([
    { name: "Set Variable", params: { name: "Num_Samples", value: 12 } },
    { name: "Set Variable", params: { name: "SAMPLE_CNT", value: "Num_Samples" } },
    { name: "Begin Loop", params: { loopName: "Bead addition", cycles: "SAMPLE_CNT" } },
    { name: "User Prompt", params: { message: "Sample operation" } },
    { name: "End Loop", params: { loopName: "Bead addition" } }
  ]);
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("variables must be assigned before they are referenced", () => {
  const findings = findingsFor([
    { name: "Set Variable", params: { name: "SAMPLE_CNT", value: "Num_Samples" } },
    { name: "Begin Loop", params: { loopName: "Samples", cycles: "SAMPLE_CNT" } },
    { name: "End Loop", params: { loopName: "Samples" } }
  ]);
  assert.equal(hasErrorAt(findings, 1), true);
  assert.equal(hasErrorAt(findings, 2), true);
});

test("Set Variable accepts a numeric custom value", () => {
  const findings = findingsFor([
    { name: "Set Variable", params: { name: "Num_Samples", value: 8 } }
  ]);
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});


test("arithmetic expressions can use previously assigned variables in pipetting volumes", () => {
  const findings = findingsFor([
    { name: "Set Variable", params: { name: "SAMPLE_CNT", value: 4 } },
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [1] } },
    aspirate({ channels: [1], wells: ["A1"], volume: "SAMPLE_CNT*4" }),
    dispense({ channels: [1], wells: ["A1"], volume: "(SAMPLE_CNT+4)*2" }),
    dropTips({ channels: [1] })
  ], deckWithSupplies());
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("arithmetic expressions can be used for loop cycles and custom variable assignments", () => {
  const findings = findingsFor([
    { name: "Set Variable", params: { name: "Samples", value: 4 } },
    { name: "Set Variable", params: { name: "Double_Samples", value: "Samples*2" } },
    { name: "Begin Loop", params: { loopName: "Arithmetic loop", cycles: "Double_Samples/2" } },
    { name: "User Prompt", params: { message: "Loop body" } },
    { name: "End Loop", params: { loopName: "Arithmetic loop" } }
  ]);
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("a 16-position tube carrier is selected as one rack and maps consecutive occupied positions", () => {
  const deck = [
    { name: "Tube 13mm 16 Pos", rackLabel: "Elution Rack", items: [
      { name: "1.5mL tube", label: "Tube 1" },
      { name: "1.5mL tube", label: "Tube 2" },
      { name: "1.5mL tube", label: "Tube 3" },
      ...Array(13).fill(null)
    ] },
    { name: "DiTi 2Pos + Waste", items: [{ name: "DiTi 200µL LiHa", label: "200uL Tips" }, null, { name: "DiTi Waste", label: "Tip Waste" }] }
  ];
  const findings = findingsFor([
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [1, 2, 3] } },
    aspirate({ source: "Elution Rack", channels: [1, 2, 3], wells: ["1", "2", "3"] }),
    dropTips({ channels: [1, 2, 3] })
  ], deck);
  assert.equal(errors(findings).length, 0, JSON.stringify(errors(findings), null, 2));
});

test("a rack-level command cannot select an empty tube carrier position", () => {
  const deck = [
    { name: "Tube 13mm 16 Pos", rackLabel: "Elution Rack", items: [
      { name: "1.5mL tube", label: "Tube 1" },
      null,
      { name: "1.5mL tube", label: "Tube 3" },
      ...Array(13).fill(null)
    ] },
    { name: "DiTi 2Pos + Waste", items: [{ name: "DiTi 200µL LiHa", label: "200uL Tips" }, null, { name: "DiTi Waste", label: "Tip Waste" }] }
  ];
  const findings = findingsFor([
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [1, 2] } },
    aspirate({ source: "Elution Rack", channels: [1, 2], wells: ["1", "2"] })
  ], deck);
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "Carrier position 2 on Elution Rack are empty"), true);
});

test("rack-level tube positions must start at the top and follow carrier order", () => {
  const deck = [
    { name: "Tube 13mm 16 Pos", rackLabel: "Elution Rack", items: [
      { name: "0.2mL tube", label: "Tube 1" },
      { name: "0.2mL tube", label: "Tube 2" },
      { name: "0.2mL tube", label: "Tube 3" },
      ...Array(13).fill(null)
    ] },
    { name: "DiTi 2Pos + Waste", items: [{ name: "DiTi 200µL LiHa", label: "200uL Tips" }, null, { name: "DiTi Waste", label: "Tip Waste" }] }
  ];
  const findings = findingsFor([
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [2, 5] } },
    aspirate({ source: "Elution Rack", channels: [2, 5], wells: ["2", "3"] })
  ], deck);
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "Mounted channels map to the top tube carrier positions starting at position 1"), true);
});

test("a single tube outside a 16-position rack cannot serve multiple channels", () => {
  const types = {
    ...carrierTypes,
    "Single tube holder": { sites: 1, compatible: ["1.5mL tube"] }
  };
  const deck = [
    { name: "Single tube holder", items: [{ name: "1.5mL tube", label: "Single Tube" }] },
    { name: "DiTi 2Pos + Waste", items: [{ name: "DiTi 200µL LiHa", label: "200uL Tips" }, null, { name: "DiTi Waste", label: "Tip Waste" }] }
  ];
  const findings = findingsFor([
    { name: "Get DiTi", params: { tips: "DiTi 200µL LiHa", channels: [1, 2] } },
    aspirate({ source: "Single Tube", channels: [1, 2], wells: ["Single Tube", "Single Tube"] })
  ], deck, types);
  assert.equal(hasErrorAt(findings, 2), true);
  assert.equal(hasMessage(findings, "single 1.5 mL or 0.2 mL tube can serve only one LiHa channel"), true);
});

for (const item of tests) {
  try {
    item.fn();
    passed += 1;
    process.stdout.write("PASS " + item.name + "\n");
  } catch (error) {
    process.stderr.write("FAIL " + item.name + "\n" + (error.stack || error.message) + "\n");
    process.exitCode = 1;
  }
}
process.stdout.write("\n" + passed + "/" + tests.length + " validation regression tests passed.\n");
if (passed !== tests.length) process.exitCode = 1;
