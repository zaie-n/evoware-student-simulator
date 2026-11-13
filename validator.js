(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EvoWareValidator = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TIP_RACKS = new Set(["DiTi 200µL LiHa", "DiTi 1000µL LiHa"]);
  const LIQUID_LABWARE = new Set([
    "96 Well Microplate",
    "96 Well Microplate - MagPlat",
    "Trough 100ml",
    "1.5mL tube",
    "0.2mL tube"
  ]);

  function getLabwareItems(deck) {
    return (deck || []).flatMap((carrier, pos) => {
      if (!carrier) return [];
      return (carrier.items || [])
        .map((item, site) => item ? { ...item, pos, site, carrier: carrier.name } : null)
        .filter(Boolean);
    });
  }

  function selectedChannels(params) {
    return (params.channels || []).map(Number).sort((a, b) => a - b);
  }

  function wellLayout(item) {
    if (item.name.startsWith("96 Well Microplate")) return { rows: 8, cols: 12, kind: "plate" };
    if (item.name === "Trough 100ml") return { rows: 8, cols: 1, kind: "trough" };
    if (item.carrier === "Tube 13mm 16 Pos") return { rows: 16, cols: 1, kind: "tubes" };
    if (item.name === "1.5mL tube" || item.name === "0.2mL tube") return { rows: 1, cols: 1, kind: "single" };
    if (item.name.startsWith("DiTi")) return { rows: 8, cols: 1, kind: "tips" };
    return { rows: 1, cols: 1, kind: "single" };
  }

  function validWellPositions(item) {
    const layout = wellLayout(item);
    if (layout.kind === "plate") {
      return Array.from({ length: layout.rows }, (_, row) =>
        Array.from({ length: layout.cols }, (_, col) => String.fromCharCode(65 + row) + (col + 1))
      ).flat();
    }
    if (layout.kind === "trough" || layout.kind === "tubes") {
      return Array.from({ length: layout.rows }, (_, index) => String(index + 1));
    }
    return [item.label];
  }

  function isSiteCompatible(item, carrierTypes) {
    const definition = carrierTypes && carrierTypes[item.carrier];
    if (!definition) return false;
    const allowed = definition.siteCompatible && definition.siteCompatible[item.site]
      ? definition.siteCompatible[item.site]
      : definition.compatible || [];
    return allowed.includes(item.name);
  }

  function validateMethod(method, deck, carrierTypes) {
    const findings = [];
    const items = getLabwareItems(deck);
    const mounted = {};
    const liquidVolumeByChannel = {};
    const stack = [];
    const diagnosedUnclosedLoops = new Set();
    const add = (severity, command, message) => findings.push({ severity, command, message });
    const hasWorktableCommands = (method || []).some(command =>
      ["Get DiTi", "Drop DiTi", "Aspirate", "Dispense", "Mix"].includes(command.name)
    );
    const hasCarriers = (deck || []).some(Boolean);

    if (!method || !method.length) {
      add("error", null, "The script is empty. Add at least one command.");
    }
    if (hasWorktableCommands && !hasCarriers) {
      add("error", null, "This method uses liquid-handling labware or disposable tips, but the worktable has no carriers. Add the required carriers and labware before validating again.");
    }

    // Check the actual carrier site, not just whether the labware type exists somewhere.
    const labels = new Map();
    items.forEach(item => {
      const exactLabel = String(item.label || "").trim();
      if (!exactLabel) {
        add("error", null, "A labware item on the worktable has no label. Give it a label so commands can identify it.");
      } else {
        labels.set(exactLabel, (labels.get(exactLabel) || 0) + 1);
      }
      if (!isSiteCompatible(item, carrierTypes)) {
        add(
          "error",
          null,
          "Worktable position " + (item.pos + 1) + ", site " + (item.site + 1) +
            " has " + (item.label || item.name) + " (" + item.name + ") on " + item.carrier +
            ", but that carrier site is not configured for this labware."
        );
      }
    });
    labels.forEach((count, label) => {
      if (count > 1) {
        add("error", null, "The labware label \"" + label + "\" is used more than once. Give each worktable item a unique label so commands point to one unambiguous item.");
      }
    });

    // Retain rename history so commands that still reference an old name are
    // explicitly flagged without silently rewriting their stored parameters.
    const renamedLabels = new Map();
    items.forEach(item => {
      (Array.isArray(item.renamedFrom) ? item.renamedFrom : []).forEach(oldLabel => {
        if (!renamedLabels.has(oldLabel)) renamedLabels.set(oldLabel, item);
      });
    });

    (method || []).forEach((command, index) => {
      const n = index + 1;
      const c = command || {};
      const p = c.params || {};
      const channels = selectedChannels(p);
      const invalidChannels = channels.filter(channel => !Number.isInteger(channel) || channel < 1 || channel > 8);
      if (invalidChannels.length) {
        add("error", n, "LiHa channel numbers must be whole numbers from 1 to 8.");
      }
      if (new Set(channels).size !== channels.length) {
        add("error", n, "A LiHa channel is selected more than once. Select each channel only once.");
      }

      if (c.name === "Begin Loop") {
        const loopName = String(p.loopName || "").trim();
        stack.push({ index, name: loopName });
        if (!loopName) {
          add("error", n, "Enter a descriptive name for this loop. Use the same name in its matching End Loop.");
        }
        const cycles = Number(p.cycles);
        if (!Number.isInteger(cycles) || cycles < 1) {
          add("error", n, "Loop cycles must be a positive whole number.");
        }
      }

      if (c.name === "End Loop") {
        const loopName = String(p.loopName || "").trim();
        const active = stack[stack.length - 1];
        if (!active) {
          add("error", n, loopName
            ? "This End Loop has no matching Begin Loop."
            : "Enter a loop name. This End Loop also has no matching Begin Loop.");
        } else if (!loopName) {
          add("error", n, "Enter the name of the loop this command closes. The currently active loop is \"" + (active.name || "unnamed") + "\".");
          diagnosedUnclosedLoops.add(active.index);
        } else if (active.name === loopName) {
          stack.pop();
        } else {
          const outerIndex = stack.slice(0, -1).findIndex(loop => loop.name === loopName);
          if (outerIndex >= 0) {
            const outer = stack[outerIndex];
            add("error", n, "End Loop \"" + loopName + "\" appears before the inner loop \"" + (active.name || "unnamed") + "\" is closed. Close the inner loop first, then close \"" + loopName + "\".");
            diagnosedUnclosedLoops.add(outer.index);
          } else {
            add("error", n, "End Loop name \"" + loopName + "\" does not match the active Begin Loop" + (active.name ? " \"" + active.name + "\"." : " (which has no name)."));
            diagnosedUnclosedLoops.add(active.index);
          }
        }
      }

      if (["Get DiTi", "Drop DiTi", "Aspirate", "Dispense", "Mix"].includes(c.name) && !channels.length) {
        add("error", n, "Select at least one LiHa channel.");
      }

      if (c.name === "Get DiTi") {
        const matchingRacks = items.filter(item => item.name === p.tips && TIP_RACKS.has(item.name));
        if (!matchingRacks.length && !hasCarriers) {
          // The worktable-level finding already explains why no rack can be found.
        } else if (!matchingRacks.length) {
          add("error", n, "No " + (p.tips || "selected DiTi type") + " rack is placed on the worktable. Place the required tip rack on a DiTi rack site.");
        } else if (!matchingRacks.some(item => isSiteCompatible(item, carrierTypes))) {
          // The worktable position/site finding identifies the misplaced rack.
        } else {
          const alreadyMounted = channels.filter(channel => mounted[channel]);
          if (alreadyMounted.length) {
            add("error", n, "Channel" + (alreadyMounted.length === 1 ? " " : "s ") + alreadyMounted.join(", ") + (alreadyMounted.length === 1 ? " already has" : " already have") + " a mounted tip. Drop the existing tip before acquiring another.");
          }
          channels.forEach(channel => {
            if (!mounted[channel]) {
              mounted[channel] = p.tips;
              liquidVolumeByChannel[channel] = 0;
            }
          });
        }
      }

      if (["Aspirate", "Dispense", "Mix"].includes(c.name)) {
        const missingTips = channels.filter(channel => !mounted[channel]);
        if (missingTips.length) {
          add("error", n, "Channel" + (missingTips.length === 1 ? " " : "s ") + missingTips.join(", ") + (missingTips.length === 1 ? " has" : " have") + " no mounted tip. Add a Get DiTi command before this operation.");
        }

        const key = c.name === "Aspirate" ? "source" : c.name === "Dispense" ? "destination" : "target";
        const role = c.name === "Aspirate" ? "source" : c.name === "Dispense" ? "destination" : "mixing target";
        const item = items.find(labwareItem => labwareItem.label === p[key]);
        if (!item) {
          const renamedItem = renamedLabels.get(p[key]);
          if (renamedItem) {
            add("error", n, "This command still refers to labware previously named \"" + p[key] +
              "\". It has been renamed to \"" + renamedItem.label +
              "\". Update the labware selection manually in this command's properties; the command was not changed automatically.");
          } else if (hasCarriers) {
            add("error", n, "Choose valid worktable labware for the " + role + ".");
          }
        } else if (!LIQUID_LABWARE.has(item.name)) {
          add("error", n, "\"" + item.label + "\" (" + item.name + ") is not a liquid-containing labware type for " + c.name + ".");
        } else {
          const wells = Array.isArray(p.wells) ? p.wells : [];
          const layout = wellLayout(item);
          const knownPositions = new Set(validWellPositions(item));
          const invalidWells = wells.filter(well => !knownPositions.has(String(well)));
          if (invalidWells.length) {
            add("error", n, "The selected position" + (invalidWells.length === 1 ? " " : "s ") + invalidWells.join(", ") + " do not exist on " + item.label + ".");
          }
          if (wells.length !== channels.length) {
            add("error", n, "Select exactly " + channels.length + " labware position" + (channels.length === 1 ? "" : "s") + " for the selected channels.");
          }
          if (new Set(wells).size !== wells.length) {
            add("error", n, "The same labware position is selected more than once.");
          }
          const columns = new Set(wells.map(well =>
            layout.kind === "plate" ? Number(String(well).match(/\d+$/)?.[0]) : 1
          ));
          if (columns.size > 1) {
            add("error", n, "Selected positions must be in one column for this LiHa channel selection.");
          }
          if (wells.length === channels.length && invalidWells.length === 0 &&
              channels.every(channel => Number.isInteger(channel) && channel >= 1 && channel <= 8)) {
            const rowIndexes = wells.map(well =>
              layout.kind === "plate" ? String(well).charCodeAt(0) - 65 :
              layout.kind === "single" ? 0 : Number(well) - 1
            );
            const referenceRows = rowIndexes.map((row, position) => row - (channels[position] - 1));
            const uniqueReferenceRows = new Set(referenceRows);
            if (uniqueReferenceRows.size > 1 || referenceRows.some(row => row < 0) ||
                referenceRows.some(row => row + Math.max(...channels.map(channel => channel - 1)) >= layout.rows)) {
              add("error", n, "Selected positions do not match the physical spacing of the selected LiHa channels. The clicked well is the channel 1 reference, so gaps between selected channels must be preserved.");
            }
          }
        }

        const volume = Number(p.volume);
        if (!Number.isFinite(volume) || volume <= 0) {
          add("error", n, "Enter a positive pipetting volume.");
        }

        const rangeGroups = new Map();
        channels.forEach(channel => {
          const tip = mounted[channel];
          const min = tip === "DiTi 1000µL LiHa" ? 10 : tip === "DiTi 200µL LiHa" ? 2 : null;
          const max = tip === "DiTi 1000µL LiHa" ? 1000 : tip === "DiTi 200µL LiHa" ? 200 : null;
          if (min !== null && Number.isFinite(volume) && volume > 0 && (volume < min || volume > max)) {
            const key = tip + "|" + min + "|" + max;
            if (!rangeGroups.has(key)) rangeGroups.set(key, { tip, min, max, channels: [] });
            rangeGroups.get(key).channels.push(channel);
          }
        });
        rangeGroups.forEach(group => {
          add("error", n, volume + " µL is outside the configured " + group.tip + " range for channel" + (group.channels.length === 1 ? " " : "s ") + group.channels.join(", ") + " (" + group.min + "–" + group.max + " µL).");
        });

        if (Number.isFinite(volume) && volume > 0 && c.name === "Aspirate") {
          channels.forEach(channel => {
            if (mounted[channel]) {
              liquidVolumeByChannel[channel] = (liquidVolumeByChannel[channel] || 0) + volume;
            }
          });
        } else if (Number.isFinite(volume) && volume > 0 && c.name === "Dispense") {
          const overdrawn = channels
            .filter(channel => mounted[channel] && volume > (liquidVolumeByChannel[channel] || 0) + 1e-9)
            .map(channel => ({ channel, available: liquidVolumeByChannel[channel] || 0 }));
          if (overdrawn.length) {
            const groups = new Map();
            overdrawn.forEach(entry => {
              const key = String(entry.available);
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(entry.channel);
            });
            groups.forEach((groupChannels, available) => {
              add("error", n, "Dispense volume " + volume + " µL exceeds the liquid volume aspirated on channel" +
                (groupChannels.length === 1 ? " " : "s ") + groupChannels.join(", ") +
                " (" + Number(available) + " µL available). Dispense no more than the volume currently held in the tip.");
            });
          }
          channels.forEach(channel => {
            if (mounted[channel] && volume <= (liquidVolumeByChannel[channel] || 0) + 1e-9) {
              liquidVolumeByChannel[channel] = Math.max(0, (liquidVolumeByChannel[channel] || 0) - volume);
            }
          });
        }

        if (c.name !== "Mix" && !["Water", "Glycerol", "Ethanol"].includes(p.liquidClass)) {
          add("error", n, "Choose a liquid class from the simulator's available liquid classes.");
        }
        if (c.name === "Mix" && (!Number.isInteger(Number(p.cycles)) || Number(p.cycles) < 1)) {
          add("error", n, "Mix cycles must be a positive whole number.");
        }

        const loopOptions = p.loopOptions;
        if (loopOptions && loopOptions.enabled) {
          if (!stack.length) {
            add("error", n, "Loop Options are enabled, but this command is not inside a Begin Loop / End Loop block.");
          }
          const scope = loopOptions[key] || {};
          const enabled = Object.entries(scope).filter(([, value]) => value && value.enabled);
          if (!enabled.length) {
            add("error", n, "Choose at least one loop dimension or turn off Loop Options.");
          }
          enabled.forEach(([dimension, settings]) => {
            if (!["column", "row", "well", "labware"].includes(dimension)) {
              add("error", n, "The selected loop dimension is not supported.");
            }
            if (!Number.isInteger(Number(settings.step)) || Number(settings.step) < 1) {
              add("error", n, "The " + dimension + " loop increment must be a positive whole number.");
            }
          });
        }
      }

      if (c.name === "Drop DiTi") {
        const availableWaste = items.filter(item => item.name === "DiTi Waste");
        const selectedWaste = availableWaste.find(item => item.label === p.waste);
        if (!availableWaste.length) {
          if (hasCarriers) add("error", n, "No DiTi Waste item is on the worktable. Add DiTi Waste to site 3 of a DiTi 2Pos + Waste carrier.");
        } else if (!p.waste) {
          add("error", n, "Select the DiTi Waste item that this command should use.");
        } else if (!selectedWaste) {
          const renamedWaste = renamedLabels.get(p.waste);
          if (renamedWaste && renamedWaste.name === "DiTi Waste") {
            add("error", n, "This Drop DiTi command still refers to the DiTi Waste container previously named \"" + p.waste +
              "\". It has been renamed to \"" + renamedWaste.label +
              "\". Update the waste selection manually in this command's properties; it was not changed automatically.");
          } else {
            add("error", n, "The selected DiTi Waste label is not on the worktable. Choose the label of an existing DiTi Waste item.");
          }
        } else if (!isSiteCompatible(selectedWaste, carrierTypes)) {
          // The worktable position/site finding identifies the misplaced waste.
        }

        const missingTips = channels.filter(channel => !mounted[channel]);
        if (missingTips.length) {
          add("error", n, "Channel" + (missingTips.length === 1 ? " " : "s ") + missingTips.join(", ") + (missingTips.length === 1 ? " has" : " have") + " no mounted tip to drop.");
        }
        channels.forEach(channel => {
          if (mounted[channel]) {
            delete mounted[channel];
            delete liquidVolumeByChannel[channel];
          }
        });
      }

      if (c.name === "Start Timer") {
        const seconds = Number(p.seconds);
        if (!Number.isFinite(seconds) || seconds < 0) {
          add("error", n, "Timer length must be zero or a positive number of seconds.");
        }
      }
      if (c.name === "Wait for Timer" && !String(p.timer || "").trim()) {
        add("error", n, "Specify the timer this command should wait for.");
      }
      if (c.name === "Set Variable") {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(p.name || "").trim())) {
          add("error", n, "Enter a valid variable name (letters, numbers, and underscores; it cannot start with a number).");
        }
        if (p.value === "" || !Number.isFinite(Number(p.value))) {
          add("error", n, "Enter a numeric value for this variable.");
        }
      }
      if (c.name === "If – Then" && !String(p.condition || "").trim()) {
        add("error", n, "Enter a condition for the If–Then command.");
      }
      if (c.name === "User Prompt" && !String(p.message || "").trim()) {
        add("error", n, "Enter the message students should see.");
      }
    });

    stack.forEach(loop => {
      if (!diagnosedUnclosedLoops.has(loop.index)) {
        add("error", loop.index + 1, "Begin Loop \"" + (loop.name || "unnamed") + "\" is missing a matching End Loop with the same name.");
      }
    });

    const mountedChannels = Object.keys(mounted).map(Number).sort((a, b) => a - b);
    if (mountedChannels.length) {
      add("warning", null, "Channels " + mountedChannels.join(", ") + " still have mounted tips at the end of the method. Confirm that leaving them mounted is intentional.");
    }

    add("info", null, "Checked " + (method || []).length + " command" + ((method || []).length === 1 ? "" : "s") + ", " + items.length + " worktable labware item" + (items.length === 1 ? "" : "s") + ", and loop structure.");
    return findings;
  }

  return { validateMethod };
});