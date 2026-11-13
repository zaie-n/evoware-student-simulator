const assert = require("node:assert/strict");
const {
  isSiteCompatible,
  isLabelUnique,
  findFirstCompatibleSite,
  moveLabware,
  moveCarrier
} = require("../worktable.js");

const carrierTypes = {
  "MP 4Pos flat": {
    sites: 4,
    compatible: ["96 Well Microplate"]
  },
  "DiTi 2Pos + Waste": {
    sites: 3,
    compatible: ["DiTi 200µL LiHa", "DiTi Waste"],
    siteCompatible: {
      0: ["DiTi 200µL LiHa"],
      1: ["DiTi 200µL LiHa"],
      2: ["DiTi Waste"]
    }
  },
  "Tube 13mm 16 Pos": {
    sites: 16,
    compatible: ["1.5mL tube", "0.2mL tube"]
  }
};

function deckFixture() {
  return [
    {
      name: "MP 4Pos flat",
      items: [
        { name: "96 Well Microplate", label: "Samples" },
        { name: "96 Well Microplate", label: "Destination" },
        null,
        null
      ]
    },
    {
      name: "DiTi 2Pos + Waste",
      items: [
        { name: "DiTi 200µL LiHa", label: "Tips" },
        null,
        { name: "DiTi Waste", label: "Waste" }
      ]
    },
    {
      name: "Tube 13mm 16 Pos",
      items: [
        { name: "1.5mL tube", label: "Beads" },
        { name: "0.2mL tube", label: "Buffer" },
        ...Array(14).fill(null)
      ]
    },
    null
  ];
}

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("labware can move between empty sites on the same carrier", () => {
  const deck = deckFixture();
  const moved = moveLabware(deck, 0, 0, 0, 2, carrierTypes);
  assert.equal(moved.ok, true);
  assert.equal(deck[0].items[0], null);
  assert.equal(deck[0].items[2].label, "Samples");
});

test("labware can swap with another item in compatible sites", () => {
  const deck = deckFixture();
  const moved = moveLabware(deck, 0, 0, 0, 1, carrierTypes);
  assert.equal(moved.ok, true);
  assert.equal(moved.swapped, true);
  assert.equal(deck[0].items[0].label, "Destination");
  assert.equal(deck[0].items[1].label, "Samples");
});

test("labware can move between compatible carriers and sites", () => {
  const deck = deckFixture();
  const moved = moveLabware(deck, 2, 0, 2, 2, carrierTypes);
  assert.equal(moved.ok, true);
  assert.equal(deck[2].items[0], null);
  assert.equal(deck[2].items[2].label, "Beads");
});

test("labware cannot be moved into a site that does not support its type", () => {
  const deck = deckFixture();
  const before = JSON.stringify(deck);
  const moved = moveLabware(deck, 0, 0, 1, 0, carrierTypes);
  assert.equal(moved.ok, false);
  assert.match(moved.message, /not compatible/);
  assert.equal(JSON.stringify(deck), before);
});

test("labware swap is rejected when the displaced item cannot occupy the source site", () => {
  const deck = deckFixture();
  deck[0].items[1] = { name: "1.5mL tube", label: "Unexpected tube" };
  const before = JSON.stringify(deck);
  const moved = moveLabware(deck, 0, 0, 0, 1, carrierTypes);
  assert.equal(moved.ok, false);
  assert.match(moved.message, /cannot be swapped/);
  assert.equal(JSON.stringify(deck), before);
});

test("DiTi waste can only be placed in its designated third carrier site", () => {
  const carrier = deckFixture()[1];
  assert.equal(isSiteCompatible(carrier, 0, "DiTi Waste", carrierTypes), false);
  assert.equal(isSiteCompatible(carrier, 2, "DiTi Waste", carrierTypes), true);
  assert.equal(findFirstCompatibleSite(carrier, "DiTi Waste", carrierTypes), -1);
  carrier.items[2] = null;
  assert.equal(findFirstCompatibleSite(carrier, "DiTi Waste", carrierTypes), 2);
});

test("whole carriers can move into an empty deck position with contents intact", () => {
  const deck = deckFixture();
  const carrier = deck[0];
  const moved = moveCarrier(deck, 0, 3);
  assert.equal(moved.ok, true);
  assert.equal(moved.swapped, false);
  assert.equal(deck[0], null);
  assert.equal(deck[3], carrier);
  assert.equal(deck[3].items[0].label, "Samples");
  assert.equal(deck[3].items[1].label, "Destination");
});

test("whole carriers can swap deck positions while retaining all labware", () => {
  const deck = deckFixture();
  const plateCarrier = deck[0];
  const tipCarrier = deck[1];
  const moved = moveCarrier(deck, 0, 1);
  assert.equal(moved.ok, true);
  assert.equal(moved.swapped, true);
  assert.equal(deck[0], tipCarrier);
  assert.equal(deck[1], plateCarrier);
  assert.equal(deck[1].items[0].label, "Samples");
  assert.equal(deck[1].items[1].label, "Destination");
  assert.equal(deck[0].items[0].label, "Tips");
  assert.equal(deck[0].items[2].label, "Waste");
});

test("moving a carrier to its current position makes no change", () => {
  const deck = deckFixture();
  const before = JSON.stringify(deck);
  const moved = moveCarrier(deck, 0, 0);
  assert.equal(moved.ok, true);
  assert.equal(moved.changed, false);
  assert.equal(JSON.stringify(deck), before);
});

test("worktable prevents an exact duplicate labware label", () => {
  const deck = deckFixture();
  assert.equal(isLabelUnique(deck, "Samples"), false);
  assert.equal(isLabelUnique(deck, "New Samples"), true);
});

test("worktable label uniqueness is exact and case-sensitive", () => {
  const deck = deckFixture();
  assert.equal(isLabelUnique(deck, "samples"), true);
  assert.equal(isLabelUnique(deck, "Samples", 0, 0), true);
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
process.stdout.write("\n" + passed + "/" + tests.length + " worktable movement tests passed.\n");
if (passed !== tests.length) process.exitCode = 1;
