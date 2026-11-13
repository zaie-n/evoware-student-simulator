(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EvoWareWorktable = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isSiteCompatible(carrier, siteIndex, labwareName, carrierTypes) {
    if (!carrier) return false;
    const definition = carrierTypes && carrierTypes[carrier.name];
    if (!definition) return false;
    const siteRules = definition.siteCompatible || {};
    const allowed = Object.prototype.hasOwnProperty.call(siteRules, siteIndex)
      ? siteRules[siteIndex]
      : (definition.compatible || []);
    return allowed.includes(labwareName);
  }

  function findFirstCompatibleSite(carrier, labwareName, carrierTypes) {
    if (!carrier || !Array.isArray(carrier.items)) return -1;
    return carrier.items.findIndex((item, index) =>
      !item && isSiteCompatible(carrier, index, labwareName, carrierTypes)
    );
  }

  function moveLabware(deck, fromPos, fromSite, toPos, toSite, carrierTypes) {
    if (!Array.isArray(deck) || !Number.isInteger(fromPos) || !Number.isInteger(toPos) ||
        !Number.isInteger(fromSite) || !Number.isInteger(toSite) ||
        fromPos < 0 || toPos < 0 || fromPos >= deck.length || toPos >= deck.length) {
      return { ok: false, message: "The selected carrier position or site is invalid." };
    }
    const sourceCarrier = deck[fromPos];
    const targetCarrier = deck[toPos];
    if (!sourceCarrier || !targetCarrier ||
        fromSite < 0 || toSite < 0 ||
        fromSite >= sourceCarrier.items.length || toSite >= targetCarrier.items.length) {
      return { ok: false, message: "Both source and destination carrier sites must exist." };
    }
    if (fromPos === toPos && fromSite === toSite) {
      return { ok: true, changed: false, swapped: false };
    }
    const movingItem = sourceCarrier.items[fromSite];
    const targetItem = targetCarrier.items[toSite];
    if (!movingItem) {
      return { ok: false, message: "There is no labware at the selected source site." };
    }
    if (!isSiteCompatible(targetCarrier, toSite, movingItem.name, carrierTypes)) {
      return {
        ok: false,
        message: movingItem.name + " is not compatible with destination site " + (toSite + 1) +
          " on " + targetCarrier.name + "."
      };
    }
    if (targetItem && !isSiteCompatible(sourceCarrier, fromSite, targetItem.name, carrierTypes)) {
      return {
        ok: false,
        message: targetItem.name + " cannot be swapped into source site " + (fromSite + 1) +
          " on " + sourceCarrier.name + "."
      };
    }
    sourceCarrier.items[fromSite] = targetItem || null;
    targetCarrier.items[toSite] = movingItem;
    return { ok: true, changed: true, swapped: !!targetItem, item: movingItem, displaced: targetItem || null };
  }

  function moveCarrier(deck, fromPos, toPos) {
    if (!Array.isArray(deck) || !Number.isInteger(fromPos) || !Number.isInteger(toPos) ||
        fromPos < 0 || toPos < 0 || fromPos >= deck.length || toPos >= deck.length) {
      return { ok: false, message: "The selected carrier position is invalid." };
    }
    if (fromPos === toPos) return { ok: true, changed: false, swapped: false };
    const movingCarrier = deck[fromPos];
    if (!movingCarrier) return { ok: false, message: "There is no carrier at the selected source position." };
    const targetCarrier = deck[toPos] || null;
    deck[toPos] = movingCarrier;
    deck[fromPos] = targetCarrier;
    return { ok: true, changed: true, swapped: !!targetCarrier, carrier: movingCarrier, displaced: targetCarrier };
  }

  return { isSiteCompatible, findFirstCompatibleSite, moveLabware, moveCarrier };
});