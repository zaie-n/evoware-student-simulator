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

  function isLabelUnique(deck, label, excludePos = -1, excludeSite = -1) {
    return (deck || []).every((carrier, pos) =>
      !carrier || (carrier.items || []).every((item, site) => {
        if (!item || (pos === excludePos && site === excludeSite)) return true;
        return item.label !== label && !(item.renamedFrom || []).includes(label);
      })
    );
  }

  function renameLabware(deck, pos, site, requestedLabel) {
    if (!Array.isArray(deck) || !Number.isInteger(pos) || !Number.isInteger(site) ||
        pos < 0 || pos >= deck.length || !deck[pos] ||
        site < 0 || site >= deck[pos].items.length || !deck[pos].items[site]) {
      return { ok: false, message: "Select an existing labware item before renaming it." };
    }
    const newLabel = String(requestedLabel || "").trim();
    if (!newLabel) {
      return { ok: false, message: "A labware name is required." };
    }
    const item = deck[pos].items[site];
    const oldLabel = String(item.label || "").trim();
    if (newLabel === oldLabel) {
      return { ok: true, changed: false, oldLabel, newLabel };
    }
    if (!isLabelUnique(deck, newLabel, pos, site)) {
      return {
        ok: false,
        message: 'Another labware item or previous labware name is already using "' + newLabel + '". Choose a unique exact name.'
      };
    }
    const renamedFrom = Array.isArray(item.renamedFrom) ? [...item.renamedFrom] : [];
    if (oldLabel && !renamedFrom.includes(oldLabel)) renamedFrom.push(oldLabel);
    item.renamedFrom = renamedFrom;
    item.label = newLabel;
    return { ok: true, changed: true, oldLabel, newLabel, item };
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

  return { isSiteCompatible, isLabelUnique, renameLabware, findFirstCompatibleSite, moveLabware, moveCarrier };
});