/**
 * AIR Visualization IR & Semantic Visual Intent Compiler
 *
 * Translates platform-neutral analytical questions (measure, aggregation,
 * dimension, visual intent) and structural relationship models (workflows,
 * DAGs, timelines) into deterministic Visualization IR and Graph IR.
 *
 * Invariants:
 * 1. AI expresses meaning and visual intent, never SVG/Canvas pixels or library config.
 * 2. Visualizations derive directly from semantic runtime data without duplicated datasets.
 * 3. Exact accessible data representations are always generated alongside visual representations.
 */

import { Duration, UtilizationRatio, parseDurationLiteral, subtractInstants } from "./air.mjs";

export const VISUALIZATION_IR_VERSION = 1;

export const VISUAL_INTENTS = Object.freeze({
  TREND: "trend",
  COMPARE: "compare",
  DISTRIBUTION: "distribution",
  RELATIONSHIP: "relationship",
  COMPOSITION: "composition",
  PROGRESS: "progress"
});

export const DATA_VISUALIZATION_REPRESENTATIONS = Object.freeze({
  FULL_LINE: "full_line",
  COMPACT_LINE: "compact_line",
  SPARKLINE_SUMMARY: "sparkline_summary",
  FULL_AREA: "full_area",
  COMPACT_AREA: "compact_area",
  VERTICAL_BAR: "vertical_bar",
  HORIZONTAL_BAR: "horizontal_bar",
  COMPACT_BAR: "compact_bar",
  STACKED_BAR: "stacked_bar",
  NORMALIZED_STACK: "normalized_stack",
  FULL_SCATTER: "full_scatter",
  COMPACT_SCATTER: "compact_scatter",
  SPARKLINE: "sparkline"
});

export const SEMANTIC_GRAPH_MODES = Object.freeze({
  WORKFLOW: "workflow",
  DAG: "dag",
  ARCHITECTURE_FLOW: "architecture_flow",
  TIMELINE: "timeline"
});

export const SEMANTIC_GRAPH_REPRESENTATIONS = Object.freeze({
  SPATIAL_WORKFLOW_GRAPH: "spatial_workflow_graph",
  COMPACT_WORKFLOW_GRAPH: "compact_workflow_graph",
  VERTICAL_STATE_PATH: "vertical_state_path",
  SPATIAL_DAG: "spatial_dag",
  LINEAR_DEPENDENCY_VIEW: "linear_dependency_view",
  SPATIAL_FLOW: "spatial_flow",
  LINEAR_FLOW: "linear_flow",
  HORIZONTAL_TIMELINE: "horizontal_timeline",
  VERTICAL_TIMELINE: "vertical_timeline"
});

/**
 * Standard Design System Palette mapping
 */
export const VISUAL_PALETTE = Object.freeze([
  { id: "primary", hex: "#7662e8", tone: "violet", label: "Primary" },
  { id: "emerald", hex: "#22a77c", tone: "emerald", label: "Positive" },
  { id: "blue", hex: "#3973e7", tone: "blue", label: "Informational" },
  { id: "amber", hex: "#d08a26", tone: "amber", label: "Warning" },
  { id: "rose", hex: "#c84454", tone: "rose", label: "Accent Rose" },
  { id: "cyan", hex: "#0891b2", tone: "cyan", label: "Cyan" }
]);

/**
 * Deterministically auto-selects visual representation based on analytical intent and dimensions
 */
export function autoSelectVisualRepresentation(intent, meta = {}) {
  const {
    dimensionType = "category",
    isTimeSeries = false,
    categoryCount = 4,
    hasSecondaryDimension = false,
    isComposition = false,
    numericMeasureCount = 1
  } = meta;

  // 1. Progress Intent
  if (intent === VISUAL_INTENTS.PROGRESS) {
    return DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY;
  }

  // 2. Trend Intent (Time Series / Continuous dimension)
  if (intent === VISUAL_INTENTS.TREND || isTimeSeries) {
    if (isComposition) return DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA;
    return DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE;
  }

  // 3. Composition Intent (Part to Whole)
  if (intent === VISUAL_INTENTS.COMPOSITION || isComposition) {
    return DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR;
  }

  // 4. Relationship Intent (Numeric vs Numeric)
  if (intent === VISUAL_INTENTS.RELATIONSHIP || (dimensionType === "number" && numericMeasureCount >= 2)) {
    return DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER;
  }

  // 5. Compare Intent (Categorical dimension)
  if (intent === VISUAL_INTENTS.COMPARE || dimensionType === "category" || dimensionType === "enum" || dimensionType === "ref") {
    if (hasSecondaryDimension) return DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR;
    if (categoryCount > 6) return DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR;
    return DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR;
  }

  // Default fallback
  return DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR;
}

/**
 * Resolves responsive representation according to container width (Minimum Viable Visual Width)
 */
export function resolveResponsiveVisualization(baseRepresentation, containerWidth = 1024, categoryCount = 4) {
  // Line / Area
  if (baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE ||
      baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA) {
    if (containerWidth >= 640) return baseRepresentation;
    if (containerWidth >= 380) {
      return baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA
        ? DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_AREA
        : DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE;
    }
    return DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY;
  }

  // Bar
  if (baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR) {
    if (containerWidth >= 640 && categoryCount <= 8) return DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR;
    if (containerWidth >= 420) return DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR;
    return DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR;
  }

  if (baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR) {
    if (containerWidth >= 400) return DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR;
    return DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR;
  }

  // Stacked Bar
  if (baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR) {
    if (containerWidth >= 520) return DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR;
    return DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR;
  }

  // Scatter
  if (baseRepresentation === DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER) {
    if (containerWidth >= 600) return DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER;
    return DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_SCATTER;
  }

  return baseRepresentation;
}

export function roundHalfAwayFromZero(val) {
  if (val < 0) return -Math.round(-val);
  return Math.round(val);
}

export function parseMoneyToMinorUnits(val, scale = 2) {
  if (val === null || val === undefined || val === "") return 0n;
  if (typeof val === "bigint") return val;
  const str = String(val).trim().replace(/[$,]/g, "");
  if (!str) return 0n;
  const isNegative = str.startsWith("-");
  const cleaned = isNegative ? str.slice(1) : str;
  const parts = cleaned.split(".");
  const integerPart = parts[0] || "0";
  const fractionPart = (parts[1] || "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(integerPart) * 100n + BigInt(fractionPart);
  return isNegative ? -units : units;
}

/**
 * Compiles a semantic analytical dataset into Visualization IR
 */
export function compileVisualizationIR(querySpec, runtimeRecords = [], options = {}) {
  const {
    id = `viz_${Date.now()}`,
    title = "Data Visualization",
    subtitle = "",
    intent = VISUAL_INTENTS.TREND,
    measure = "value",
    aggregate = "sum",
    dimension = "date",
    secondaryDimension = null,
    format = "number", // "currency", "number", "percentage", "date"
    currency = "USD",
    ordering = "natural",
    maxCategories = 12,
    containerWidth = options.containerWidth ?? 1024
  } = querySpec;

  const isDuration = format === "duration" || measure.endsWith(".duration") || measure === "duration" || measure.includes("duration");
  const isMoney = !isDuration && (format === "currency" || format === "money" || measure.includes("amount") || measure.includes("budget") || measure.includes("spend") || measure.includes("cost") || measure.includes("revenue") || measure.includes("price") || measure.includes("value"));

  function parseSafeNumber(val, defaultVal = 0) {
    if (val === null || val === undefined || val === "" || typeof val === "boolean") return defaultVal;
    if (val instanceof UtilizationRatio) return val.toRatio();
    if (val instanceof Duration) return val.ms;
    if (typeof val === "object" && val && val.start && val.end) {
      const dur = subtractInstants(val.end, val.start);
      return dur ? dur.ms : defaultVal;
    }
    const parsedDur = typeof val === "string" ? parseDurationLiteral(val) : null;
    if (parsedDur) return parsedDur.ms;
    const num = Number(val);
    if (!Number.isFinite(num) || Number.isNaN(num)) return defaultVal;
    return num;
  }

  // Detect currency compatibility across records
  const detectedCurrencies = new Set();
  for (const record of runtimeRecords) {
    const recCurr = record.currency || record.currency_code || record.currencyCode || record.unit;
    if (recCurr && typeof recCurr === "string") {
      detectedCurrencies.add(recCurr.toUpperCase());
    }
  }

  let activeCurrency = currency;
  let currencyMismatch = false;
  if (detectedCurrencies.size > 1) {
    currencyMismatch = true;
    if (options.strictCurrency) {
      throw new Error(`Currency compatibility error: Mixed currencies detected [${[...detectedCurrencies].join(", ")}]. Explicit partition or conversion required.`);
    }
  } else if (detectedCurrencies.size === 1) {
    activeCurrency = [...detectedCurrencies][0];
  }

  // 1. Group and aggregate runtime records
  const groupedData = new Map();
  const secondaryKeys = new Set();
  const timeBucket = querySpec.timeBucket || (dimension.includes("hour") ? "hour" : dimension.includes("week") ? "week" : dimension.includes("quarter") ? "quarter" : dimension.includes("year") ? "year" : "month");

  for (const record of runtimeRecords) {
    const rawDim = record[dimension] ?? "Unknown";
    const dimKey = formatDimensionKey(rawDim, dimension, timeBucket);
    
    // For money, compute in integer cents (minor units) to prevent float rounding errors
    const rawRecordVal = record[measure];
    const parsedRaw = parseSafeNumber(rawRecordVal, aggregate === "count" ? 1 : 0);
    const rawVal = isMoney ? roundHalfAwayFromZero(parsedRaw * 100) : parsedRaw;
    
    const secKey = secondaryDimension ? String(record[secondaryDimension] ?? "Default") : null;
    if (secKey) secondaryKeys.add(secKey);

    if (!groupedData.has(dimKey)) {
      groupedData.set(dimKey, {
        dimKey,
        rawDim,
        totalUnits: 0,
        count: 0,
        values: [],
        rawValues: [],
        secondary: new Map()
      });
    }

    const group = groupedData.get(dimKey);
    group.totalUnits += rawVal;
    group.count += 1;
    group.values.push(rawVal);
    if (rawRecordVal !== undefined) {
      group.rawValues.push(rawRecordVal);
    }

    if (secKey) {
      group.secondary.set(secKey, (group.secondary.get(secKey) ?? 0) + rawVal);
    }
  }

  // Sort dimensions
  let entries = [...groupedData.values()];
  if (ordering === "time" || dimension.includes("date") || dimension.includes("joined") || dimension.includes("month") || dimension.includes("time") || dimension.includes("created")) {
    entries.sort((a, b) => String(a.rawDim).localeCompare(String(b.rawDim)));
  } else if (ordering === "desc") {
    entries.sort((a, b) => b.totalUnits - a.totalUnits);
  } else if (ordering === "asc") {
    entries.sort((a, b) => a.totalUnits - b.totalUnits);
  }

  // Truncate excessive categories (Top-N + Other) to prevent unreadable crowding
  let isTruncated = false;
  if (entries.length > maxCategories && intent !== VISUAL_INTENTS.TREND) {
    isTruncated = true;
    const topEntries = entries.slice(0, maxCategories - 1);
    const otherEntries = entries.slice(maxCategories - 1);
    const otherTotal = otherEntries.reduce((sum, e) => sum + e.totalUnits, 0);
    const otherCount = otherEntries.reduce((sum, e) => sum + e.count, 0);
    topEntries.push({
      dimKey: "Other",
      rawDim: "Other",
      totalUnits: otherTotal,
      count: otherCount,
      values: [otherTotal],
      secondary: new Map()
    });
    entries = topEntries;
  }

  // 2. Compute final aggregated values
  const categories = entries.map((e) => e.dimKey);
  const dataPoints = [];
  const exactRows = [];

  let grandTotalUnits = 0;
  let minUnits = Infinity;
  let maxUnits = -Infinity;

  for (const entry of entries) {
    let finalUnits = 0;
    if (aggregate === "sum") {
      finalUnits = entry.totalUnits;
    } else if (aggregate === "avg" || aggregate === "average") {
      finalUnits = entry.count ? (isMoney || isDuration ? roundHalfAwayFromZero(entry.totalUnits / entry.count) : entry.totalUnits / entry.count) : 0;
    } else if (aggregate === "count") {
      finalUnits = entry.count;
    } else if (aggregate === "max") {
      finalUnits = entry.values.length > 0 ? Math.max(...entry.values) : 0;
    } else if (aggregate === "min") {
      finalUnits = entry.values.length > 0 ? Math.min(...entry.values) : 0;
    } else {
      finalUnits = entry.totalUnits;
    }

    grandTotalUnits += (aggregate === "sum" ? finalUnits : 0);
    minUnits = Math.min(minUnits, finalUnits);
    maxUnits = Math.max(maxUnits, finalUnits);

    const firstRaw = entry.rawValues?.[0];
    const isRatio = firstRaw instanceof UtilizationRatio || (typeof firstRaw === "object" && firstRaw !== null && firstRaw.type === "ratio");
    const ratioObj = isRatio ? (firstRaw instanceof UtilizationRatio ? firstRaw : new UtilizationRatio(firstRaw.numerator, firstRaw.denominator)) : null;

    // Convert minor units back to major units
    const displayValue = (isMoney && aggregate !== "count")
      ? roundHalfAwayFromZero(finalUnits) / 100
      : (typeof finalUnits === "number" ? Number(finalUnits.toFixed(2)) : 0);

    const formattedValue = isMoney
      ? formatMetricValue(displayValue, format, activeCurrency)
      : (ratioObj ? formatMetricValue(ratioObj, format, activeCurrency) : formatMetricValue(finalUnits, format, activeCurrency));

    dataPoints.push({
      x: entry.dimKey,
      y: displayValue,
      label: entry.dimKey,
      formattedX: entry.dimKey,
      formattedY: formattedValue,
      rawDim: entry.rawDim,
      count: entry.count
    });

    const secBreakdown = {};
    for (const [sK, sUnits] of entry.secondary.entries()) {
      secBreakdown[sK] = (isMoney && aggregate !== "count") ? roundHalfAwayFromZero(sUnits) / 100 : sUnits;
    }

    const row = {
      dimension: entry.dimKey,
      value: displayValue,
      rawMilliseconds: isDuration ? finalUnits : undefined,
      formattedValue,
      count: entry.count,
      secondaryBreakdown: secBreakdown
    };

    if (ratioObj) {
      row.ratio = { numerator: ratioObj.numerator, denominator: ratioObj.denominator };
      row.occupiedDuration = ratioObj.occupiedDuration;
      row.windowDuration = ratioObj.windowDuration;
    }

    exactRows.push(row);
  }

  const grandTotal = (isMoney && aggregate !== "count")
    ? (aggregate === "sum" ? roundHalfAwayFromZero(grandTotalUnits) / 100 : exactRows.reduce((s, r) => s + r.value, 0))
    : (aggregate === "sum" ? grandTotalUnits : exactRows.reduce((s, r) => s + r.value, 0));

  let minValue = (isMoney && aggregate !== "count") ? minUnits / 100 : minUnits;
  let maxValue = (isMoney && aggregate !== "count") ? maxUnits / 100 : maxUnits;
  if (minValue === Infinity) minValue = 0;
  if (maxValue === -Infinity) maxValue = 0;

  // Compute exact percentage ratios (handling zero denominator, negative values, >100%)
  for (const row of exactRows) {
    if (grandTotal === 0 || !Number.isFinite(grandTotal)) {
      row.percentage = 0;
    } else {
      const ratio = (row.value / grandTotal) * 100;
      row.percentage = Number.isFinite(ratio) ? roundHalfAwayFromZero(ratio) : 0;
    }
  }

  // 3. Resolve representation
  const isTimeSeries = dimension.includes("date") || dimension.includes("month") || dimension.includes("joined") || dimension.includes("time") || dimension.includes("created");
  const baseRepresentation = autoSelectVisualRepresentation(intent, {
    dimensionType: isTimeSeries ? "time" : "category",
    isTimeSeries,
    categoryCount: categories.length,
    hasSecondaryDimension: Boolean(secondaryDimension),
    isComposition: intent === VISUAL_INTENTS.COMPOSITION
  });

  const representation = resolveResponsiveVisualization(baseRepresentation, containerWidth, categories.length);

  // 4. Construct series
  const series = [];
  if (secondaryDimension && secondaryKeys.size > 0) {
    let colorIdx = 0;
    for (const secKey of secondaryKeys) {
      const paletteItem = VISUAL_PALETTE[colorIdx % VISUAL_PALETTE.length];
      const points = entries.map((entry) => {
        const rawSUnits = entry.secondary.get(secKey) ?? 0;
        const val = (isMoney && aggregate !== "count") ? Math.round(rawSUnits) / 100 : rawSUnits;
        return {
          x: entry.dimKey,
          y: val,
          formattedY: formatMetricValue(val, format, activeCurrency)
        };
      });
      series.push({
        id: secKey,
        label: secKey,
        color: paletteItem.hex,
        tone: paletteItem.tone,
        points
      });
      colorIdx++;
    }
  } else {
    series.push({
      id: "primary",
      label: title,
      color: VISUAL_PALETTE[0].hex,
      tone: VISUAL_PALETTE[0].tone,
      points: dataPoints
    });
  }

  // 5. Construct Accessible Text Summary
  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  const peakPoint = dataPoints.reduce((max, p) => p.y > (max?.y ?? -Infinity) ? p : max, dataPoints[0]);
  
  let accessibleSummary = `${title}: ${representation} visualization showing ${dataPoints.length} data points. Total aggregate is ${formatMetricValue(grandTotal, format, activeCurrency)}.`;
  if (dataPoints.length >= 2 && isTimeSeries) {
    accessibleSummary += ` Started at ${firstPoint.formattedX} (${firstPoint.formattedY}) and ended at ${lastPoint.formattedX} (${lastPoint.formattedY}). Peak value was ${peakPoint.formattedY} at ${peakPoint.formattedX}.`;
  } else if (dataPoints.length > 0) {
    accessibleSummary += ` Highest category is ${peakPoint.label} with ${peakPoint.formattedY}.`;
  }
  if (isTruncated) {
    accessibleSummary += ` Note: Categories beyond ${maxCategories} were grouped into 'Other'.`;
  }
  if (currencyMismatch) {
    accessibleSummary += ` Warning: Multiple currencies detected in dataset [${[...detectedCurrencies].join(", ")}].`;
  }

  return {
    id,
    title,
    subtitle: subtitle || `${titleCase(aggregate)} of ${measure} by ${dimension}`,
    intent,
    baseRepresentation,
    representation,
    format,
    currency: activeCurrency,
    currencyMismatch,
    detectedCurrencies: [...detectedCurrencies],
    categories,
    series,
    xAxis: {
      label: titleCase(dimension),
      type: isTimeSeries ? "time" : "category",
      ticks: categories
    },
    yAxis: {
      label: `${titleCase(aggregate)} (${titleCase(measure)})`,
      format,
      min: minValue > 0 ? 0 : minValue,
      max: maxValue,
      ticks: computeNiceTicks(minValue > 0 ? 0 : minValue, maxValue, 4, format, activeCurrency)
    },
    grandTotal,
    formattedGrandTotal: formatMetricValue(grandTotal, format, activeCurrency),
    exactData: exactRows,
    accessibleSummary,
    isTruncated,
    minWidth: getMinViableVisualWidth(representation),
    containerWidth
  };
}

/**
 * Compiles a Semantic Workflow Graph IR directly from Workflow states and transitions
 */
export function compileWorkflowGraph(workflowModel, currentRecordOrState = null, options = {}) {
  const containerWidth = options.containerWidth ?? 1024;
  let states = workflowModel?.states;
  if (!states && workflowModel?.resource?.fieldMap?.get(workflowModel?.stateField)?.options) {
    states = workflowModel.resource.fieldMap.get(workflowModel.stateField).options;
  }
  if (!states && Array.isArray(workflowModel?.transitions)) {
    const sSet = new Set();
    workflowModel.transitions.forEach((t) => {
      if (t.from) sSet.add(t.from);
      if (t.to) sSet.add(t.to);
    });
    states = [...sSet];
  }
  if (!states || states.length === 0) states = ["Draft", "Submitted", "Approved", "Rejected"];

  let transitions = workflowModel?.transitions ?? [];
  if (transitions instanceof Map) {
    transitions = [...transitions.values()];
  } else if (!Array.isArray(transitions) && typeof transitions === "object") {
    transitions = Object.values(transitions);
  }
  if (transitions.length === 0 && workflowModel?.model?.transitions) {
    const mTrans = workflowModel.model.transitions.get(workflowModel.resource?.id ?? workflowModel.id);
    if (mTrans) transitions = [...mTrans.values()];
  }

  const currentState = typeof currentRecordOrState === "string"
    ? currentRecordOrState
    : currentRecordOrState?.status ?? currentRecordOrState?.state ?? states[0];

  const nodes = [];
  const edges = [];
  const stateIndexMap = new Map();

  states.forEach((stateName, idx) => {
    stateIndexMap.set(String(stateName).toLowerCase(), idx);
  });

  const normalizedCurrent = String(currentState).toLowerCase();
  const currentRank = stateIndexMap.get(normalizedCurrent) ?? 0;

  states.forEach((stateName, idx) => {
    const normalizedName = String(stateName).toLowerCase();
    const isCurrent = normalizedName === normalizedCurrent;
    const isTerminal = ["approved", "paid", "rejected", "archived", "cancelled", "done"].includes(normalizedName);
    const isInitial = idx === 0 || normalizedName === "draft" || normalizedName === "planning";

    // Determine status of node
    let status = "locked";
    if (isCurrent) status = "active";
    else if (isTerminal && isCurrent) status = "completed";
    else if (idx < currentRank) status = "completed";
    else if (transitions.some((t) => String(t.from).toLowerCase() === normalizedCurrent && String(t.to).toLowerCase() === normalizedName)) status = "available";

    nodes.push({
      id: stateName,
      label: titleCase(String(stateName).replace(/_/g, " ")),
      rank: idx,
      isInitial,
      isTerminal,
      isCurrent,
      status,
      badge: isCurrent ? "Current State" : status === "completed" ? "Passed" : status === "available" ? "Next Action" : "Upcoming"
    });
  });

  transitions.forEach((trans, idx) => {
    const fromList = Array.isArray(trans.from) ? trans.from : [trans.from];
    fromList.forEach((fromState, fIdx) => {
      edges.push({
        id: `edge_${fromState}_${trans.to}_${idx}_${fIdx}`,
        from: fromState,
        to: trans.to,
        action: trans.action ?? "transition",
        label: trans.action ? titleCase(String(trans.action).replace(/_/g, " ")) : "Advance",
        actor: trans.by?.source ?? trans.by ?? "system",
        guard: trans.when?.source ?? trans.when ?? null,
        separation: trans.separate ?? null,
        commentRequired: trans.comment === "required",
        approvals: trans.approvals ?? 1,
        isAvailable: String(fromState).toLowerCase() === normalizedCurrent
      });
    });
  });

  // Resolve responsive representation
  let representation = SEMANTIC_GRAPH_REPRESENTATIONS.SPATIAL_WORKFLOW_GRAPH;
  if (containerWidth < 480) {
    representation = SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_STATE_PATH;
  } else if (containerWidth < 768) {
    representation = SEMANTIC_GRAPH_REPRESENTATIONS.COMPACT_WORKFLOW_GRAPH;
  }

  const accessibleSummary = `Workflow Graph containing ${nodes.length} states and ${edges.length} transitions. Current state is ${titleCase(currentState)}.`;

  return {
    id: `wf_${workflowModel?.id ?? "workflow"}`,
    mode: SEMANTIC_GRAPH_MODES.WORKFLOW,
    representation,
    currentState,
    nodes,
    edges,
    accessibleSummary,
    containerWidth,
    minWidth: 320
  };
}

/**
 * Compiles a Timeline Graph IR from timestamped transition/audit events
 */
export function compileTimelineGraph(historyEvents = [], options = {}) {
  const containerWidth = options.containerWidth ?? 1024;
  const events = historyEvents.map((evt, idx) => {
    const at = evt.at ? new Date(evt.at) : new Date();
    const formattedDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(at);
    return {
      id: evt.id ?? `evt_${idx}`,
      event: evt.event ?? evt.action ?? "event",
      label: titleCase((evt.event ?? evt.action ?? "event").replace(/_/g, " ")),
      actor: evt.actor?.id ?? evt.actor ?? "system",
      actorRole: evt.actor?.role ?? "System",
      timestamp: evt.at,
      formattedDate,
      comment: evt.comment ?? "",
      completed: evt.completed !== false,
      statusTone: ["approved", "paid", "done", "created"].includes(evt.event) ? "positive" : ["rejected", "cancelled"].includes(evt.event) ? "danger" : "neutral"
    };
  });

  const representation = containerWidth < 768
    ? SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_TIMELINE
    : SEMANTIC_GRAPH_REPRESENTATIONS.HORIZONTAL_TIMELINE;

  const accessibleSummary = `Timeline containing ${events.length} sequential history events. Latest event: ${events[events.length - 1]?.label ?? "None"}.`;

  return {
    id: `timeline_${Date.now()}`,
    mode: SEMANTIC_GRAPH_MODES.TIMELINE,
    representation,
    events,
    accessibleSummary,
    containerWidth,
    minWidth: 280
  };
}

/**
 * Compiles a generic Directed Acyclic Graph (DAG) IR
 */
export function compileDagGraph(nodeSpecs = [], edgeSpecs = [], options = {}) {
  const containerWidth = options.containerWidth ?? 1024;
  const representation = containerWidth < 768
    ? SEMANTIC_GRAPH_REPRESENTATIONS.LINEAR_DEPENDENCY_VIEW
    : SEMANTIC_GRAPH_REPRESENTATIONS.SPATIAL_DAG;

  return {
    id: options.id ?? `dag_${Date.now()}`,
    mode: SEMANTIC_GRAPH_MODES.DAG,
    representation,
    title: options.title ?? "Dependency Graph",
    nodes: nodeSpecs,
    edges: edgeSpecs,
    accessibleSummary: `Directed graph with ${nodeSpecs.length} nodes and ${edgeSpecs.length} dependency edges.`,
    containerWidth,
    minWidth: 320
  };
}

// -------------------------------------------------------------
// Helper Utilities
// -------------------------------------------------------------

export function formatDimensionKey(val, fieldName, bucket = "month", options = {}) {
  if (!val && val !== 0) return "Unknown";
  const timezone = typeof bucket === "object" ? (bucket.timezone ?? "UTC") : (options.timezone ?? "UTC");
  const actualBucket = typeof bucket === "string" ? bucket : (bucket?.bucket ?? "month");
  
  // Check if val is a date or ISO timestamp string
  if (val instanceof Date || (typeof val === "string" && /^\d{4}-\d{2}/.test(val))) {
    const d = val instanceof Date ? val : new Date(val);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(d);
      const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const year = Number(partMap.year);
      const month = Number(partMap.month) - 1; // 0-11
      const day = Number(partMap.day);
      const hours = Number(partMap.hour === "24" ? "00" : partMap.hour);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      if (actualBucket === "hour") {
        const hh = String(hours).padStart(2, "0");
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")} ${hh}:00 UTC`;
      }
      if (actualBucket === "day") {
        return `${monthNames[month]} ${day}, ${year}`;
      }
      if (actualBucket === "week") {
        // Deterministic ISO week
        const target = new Date(Date.UTC(year, month, day));
        const dayNr = (target.getUTCDay() + 6) % 7;
        target.setUTCDate(target.getUTCDate() - dayNr + 3);
        const firstThursday = target.getTime();
        target.setUTCMonth(0, 1);
        if (target.getUTCDay() !== 4) {
          target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
        }
        const weekNum = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
        return `${year}-W${String(weekNum).padStart(2, "0")}`;
      }
      if (actualBucket === "quarter") {
        const q = Math.floor(month / 3) + 1;
        return `${year}-Q${q}`;
      }
      if (actualBucket === "year") {
        return `${year}`;
      }
      // default: "month"
      return `${monthNames[month]} ${year}`;
    }
  }

  if (typeof val === "string") {
    return titleCase(val.replace(/_/g, " "));
  }
  return String(val);
}

export function formatMetricValue(val, format, currency = "USD") {
  if (val instanceof UtilizationRatio) return val.toString();
  if (val instanceof Duration) return val.toString();
  if (format === "duration") {
    const dur = typeof val === "number" ? new Duration(val) : parseDurationLiteral(val);
    return dur ? dur.toString() : String(val);
  }
  if (format === "currency" || format === "money") {
    const hasCents = val % 1 !== 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2
    }).format(val);
  }
  if (format === "percentage" || format === "percent") {
    if (val instanceof UtilizationRatio) return val.toString();
    const pct = typeof val === "number" && val <= 1 && val > 0 ? val * 100 : val;
    return `${Math.round(pct)}%`;
  }
  return new Intl.NumberFormat("en-US").format(val);
}

function computeNiceTicks(min, max, count = 4, format = "number", currency = "USD") {
  if (min === max) return [{ value: min, label: formatMetricValue(min, format, currency) }];
  const step = (max - min) / count;
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    const val = Math.round(min + step * i);
    ticks.push({
      value: val,
      label: formatMetricValue(val, format, currency)
    });
  }
  return ticks;
}

function getMinViableVisualWidth(representation) {
  switch (representation) {
    case DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE:
    case DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA:
      return 540;
    case DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE:
    case DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_AREA:
      return 360;
    case DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR:
    case DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR:
      return 480;
    case DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR:
      return 380;
    case DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR:
      return 280;
    case DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY:
    case DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE:
      return 180;
    default:
      return 300;
  }
}

function titleCase(str) {
  return String(str ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
}
