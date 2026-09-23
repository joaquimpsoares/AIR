/**
 * AIR Schedule / Calendar IR & Presentation Compiler
 *
 * Compiles platform-neutral temporal allocation intents (resources, intervals,
 * blackouts, timezones, and responsive layout) into deterministic Schedule IR.
 *
 * Invariants:
 * 1. Calendar displays intervals and visual states; it NEVER performs overlap/capacity
 *    validation, pricing arithmetic, or atomic constraint checks.
 * 2. Visual positions are computed from exact instants in the specified IANA timezone.
 * 3. Exact accessible linear representations are always provided alongside spatial grids.
 * 4. Zero application-specific or domain-specific branches.
 */

import {
  SCHEDULE_REPRESENTATION,
  SCHEDULE_VIEW_MODE,
  resolveScheduleArtifactLayout,
  ARTIFACT_STATES
} from "./ui_hierarchy.mjs";

export const SCHEDULE_IR_VERSION = 1;

const FORMATTER_CACHE = new Map();
function getDateTimeFormatter(timezone) {
  let f = FORMATTER_CACHE.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric"
    });
    FORMATTER_CACHE.set(timezone, f);
  }
  return f;
}

/**
 * Extracts zoned date and time parts from an ISO string or Date object
 * using deterministic Intl.DateTimeFormat in the target IANA timezone.
 */
export function getZonedDateParts(isoStringOrDate, timezone = "UTC") {
  if (!isoStringOrDate) {
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, dateString: "1970-01-01", timeString: "00:00", totalMinutes: 0 };
  }
  const date = typeof isoStringOrDate === "string" ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) {
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, dateString: "1970-01-01", timeString: "00:00", totalMinutes: 0 };
  }

  if (timezone === "UTC") {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();
    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const totalMinutes = hour * 60 + minute + second / 60;
    return { year, month, day, hour, minute, second, dateString, timeString, totalMinutes };
  }

  const formatter = getDateTimeFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;



  const year = parseInt(get("year") || "1970", 10);
  const month = parseInt(get("month") || "1", 10);
  const day = parseInt(get("day") || "1", 10);
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  const second = parseInt(get("second") || "0", 10);

  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const totalMinutes = hour * 60 + minute + second / 60;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString,
    timeString,
    totalMinutes
  };
}

/**
 * Shifts a YYYY-MM-DD date string by a given number of days deterministically in UTC.
 */
export function addDaysToDateString(dateString, days) {
  if (!dateString) return "1970-01-01";
  const [y, m, d] = dateString.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Formats a display date string for schedule header navigation.
 */
export function formatDisplayDate(dateString, timezone = "UTC", viewMode = "day") {
  if (!dateString) return "";
  const [y, m, d] = dateString.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  if (viewMode === SCHEDULE_VIEW_MODE.WEEK) {
    const endString = addDaysToDateString(dateString, 6);
    const [ey, em, ed] = endString.split("-").map((n) => parseInt(n, 10));
    const edt = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

    const startFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
    const endFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(edt);
    return `${startFmt} – ${endFmt}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dt);
}

/**
 * Resolves semantic visual tone for status / state.
 */
export function mapStatusToTone(status) {
  if (!status) return "neutral";
  const s = String(status).toLowerCase();
  if (["confirmed", "active", "completed", "available"].includes(s)) return "positive";
  if (["requested", "pending", "in_review", "planning"].includes(s)) return "accent";
  if (["warning", "overdue", "expiring", "delayed"].includes(s)) return "warning";
  if (["cancelled", "rejected", "closed", "noshow", "no_show"].includes(s)) return "neutral";
  if (["danger", "blackout", "blocked", "maintenance", "unavailable"].includes(s)) return "danger";
  return "neutral";
}

/**
 * Compiles Schedule Visualization IR from raw inputs or AppRuntime.
 */
export function compileScheduleVisualizationIR(spec = {}, records = [], options = {}) {
  const runtime = options.runtime;
  const containerWidth = spec.containerWidth ?? options.containerWidth ?? 1024;
  const timezone = spec.timezone ?? options.timezone ?? "UTC";
  const viewMode = spec.viewMode ?? options.viewMode ?? SCHEDULE_VIEW_MODE.DAY;
  
  const displayStartHour = spec.displayStartHour ?? 8;
  const displayEndHour = spec.displayEndHour ?? 20;
  const gridTotalMinutes = (displayEndHour - displayStartHour) * 60;

  // Injected clock or now instant for deterministic testing
  const nowInstant = options.clock ?? options.now ?? new Date().toISOString();
  const nowZoned = getZonedDateParts(nowInstant, timezone);
  const currentDate = spec.currentDate ?? options.currentDate ?? nowZoned.dateString;

  // Resolve responsive layout
  const layoutDecision = resolveScheduleArtifactLayout(containerWidth, { viewMode });

  // Compute dates in view
  const datesInView = [];
  const daysCount = viewMode === SCHEDULE_VIEW_MODE.WEEK ? 7 : 1;
  for (let i = 0; i < daysCount; i++) {
    datesInView.push(addDaysToDateString(currentDate, i));
  }

  // Navigation state
  const navigation = {
    currentDate,
    rangeLabel: formatDisplayDate(currentDate, timezone, viewMode),
    previousDate: addDaysToDateString(currentDate, viewMode === SCHEDULE_VIEW_MODE.WEEK ? -7 : -1),
    nextDate: addDaysToDateString(currentDate, viewMode === SCHEDULE_VIEW_MODE.WEEK ? 7 : 1),
    todayDate: nowZoned.dateString,
    viewMode,
    timezone
  };

  // 1. Resolve Groups (Resources / Employees / Equipment / Providers)
  let groups = [];
  if (options.groups && Array.isArray(options.groups)) {
    groups = options.groups.map((g) => ({
      id: g.id,
      label: g.name ?? g.label ?? g.title ?? g.id,
      meta: g
    }));
  } else if (runtime && spec.groupResource) {
    const rawGroups = runtime.records(spec.groupResource) ?? [];
    groups = rawGroups.map((r) => ({
      id: r.id,
      label: r[spec.groupLabelField || "name"] ?? r.name ?? r.label ?? r.id,
      meta: r
    }));
  } else if (records.length > 0) {
    const groupField = spec.groupField ?? "resource";
    const uniqueIds = [...new Set(records.map((r) => r[groupField]).filter(Boolean))];
    groups = uniqueIds.map((id) => ({ id, label: id, meta: {} }));
  }

  // Group filtering if requested
  if (spec.filter && spec.groupField && spec.filter[spec.groupField]) {
    const target = spec.filter[spec.groupField];
    groups = groups.filter((g) => g.id === target);
  }

  const groupsMap = new Map(groups.map((g) => [g.id, g]));

  // 2. Resolve Interval Records (Reservations / Shifts / Maintenance / Appointments)
  let rawRecords = records;
  if ((!rawRecords || rawRecords.length === 0) && runtime && spec.resource) {
    rawRecords = runtime.records(spec.resource) ?? [];
  }

  const groupField = spec.groupField ?? "resource";
  const startField = spec.startField ?? "start_at";
  const endField = spec.endField ?? "end_at";
  const titleField = spec.titleField ?? "title";
  const statusField = spec.statusField ?? "status";

  // Filter raw records
  let filteredRecords = rawRecords;
  if (spec.hideCancelled) {
    filteredRecords = filteredRecords.filter((r) => {
      const st = String(r[statusField] ?? r.status ?? "").toLowerCase();
      return st !== "cancelled" && st !== "noshow" && st !== "no_show";
    });
  }
  if (spec.filter) {
    for (const [key, val] of Object.entries(spec.filter)) {
      if (val) {
        filteredRecords = filteredRecords.filter((r) => String(r[key]) === String(val));
      }
    }
  }

  // Process positioned interval items
  const items = [];
  for (const record of filteredRecords) {
    const startRaw = record[startField] ?? record.start ?? record.start_at;
    const endRaw = record[endField] ?? record.end ?? record.end_at;
    if (!startRaw || !endRaw) continue;

    const startZoned = getZonedDateParts(startRaw, timezone);
    const endZoned = getZonedDateParts(endRaw, timezone);

    // Check if this record falls within datesInView
    const matchesView = datesInView.some((d) => startZoned.dateString <= d && endZoned.dateString >= d);
    if (!matchesView) continue;

    const groupId = record[groupField] ?? record.resource ?? record.group ?? "default";
    const groupObj = groupsMap.get(groupId);
    const groupLabel = groupObj?.label ?? groupId;

    const durationMs = Math.max(0, new Date(endRaw).getTime() - new Date(startRaw).getTime());
    const status = record[statusField] ?? record.status ?? "Requested";
    const tone = mapStatusToTone(status);
    const title = record[titleField] ?? record.title ?? record.name ?? record.id;

    // Spatial math within day grid
    const startMin = startZoned.totalMinutes;
    const endMin = endZoned.totalMinutes;
    const gridStartMin = displayStartHour * 60;
    const gridEndMin = displayEndHour * 60;

    const clampedStart = Math.max(gridStartMin, Math.min(gridEndMin, startMin));
    const clampedEnd = Math.max(clampedStart + 15, Math.min(gridEndMin, endMin));

    const leftPercent = ((clampedStart - gridStartMin) / gridTotalMinutes) * 100;
    const widthPercent = Math.max(2, ((clampedEnd - clampedStart) / gridTotalMinutes) * 100);

    const timeRangeLabel = `${startZoned.timeString} – ${endZoned.timeString}`;
    let quote = record.quote ?? "";
    if (!quote && record.amount != null && record.amount > 0) {
      quote = `$${Number(record.amount).toFixed(2)}`;
    }

    const actions = runtime && spec.resource ? runtime.availableActions(spec.resource, record.id) : [];

    items.push({
      id: record.id,
      entityId: spec.resource ?? "records",
      recordId: record.id,
      title,
      groupId,
      groupLabel,
      start: startRaw,
      end: endRaw,
      startZoned,
      endZoned,
      durationMs,
      status,
      tone,
      quote,
      isBlackout: false,
      leftPercent: parseFloat(leftPercent.toFixed(2)),
      widthPercent: parseFloat(widthPercent.toFixed(2)),
      timeRangeLabel,
      rawRecord: record,
      actions,
      dateString: startZoned.dateString
    });
  }

  // 3. Resolve Blackouts (if any)
  let rawBlackouts = options.blackouts ?? [];
  if (rawBlackouts.length === 0 && runtime && spec.blackoutResource) {
    rawBlackouts = runtime.records(spec.blackoutResource) ?? [];
  }

  const blackoutItems = [];
  const blackoutGroupField = spec.blackoutGroupField ?? "resource";
  const blackoutStartField = spec.blackoutStartField ?? "start_at";
  const blackoutEndField = spec.blackoutEndField ?? "end_at";
  const blackoutTitleField = spec.blackoutTitleField ?? "reason";

  for (const b of rawBlackouts) {
    const st = String(b.status ?? "Active").toLowerCase();
    if (st === "resolved" || st === "cancelled" || st === "inactive") continue;

    const startRaw = b[blackoutStartField] ?? b.start ?? b.start_at;
    const endRaw = b[blackoutEndField] ?? b.end ?? b.end_at;
    if (!startRaw || !endRaw) continue;

    const startZoned = getZonedDateParts(startRaw, timezone);
    const endZoned = getZonedDateParts(endRaw, timezone);

    const matchesView = datesInView.some((d) => startZoned.dateString <= d && endZoned.dateString >= d);
    if (!matchesView) continue;

    const groupId = b[blackoutGroupField] ?? b.resource ?? "default";
    const groupObj = groupsMap.get(groupId);
    const groupLabel = groupObj?.label ?? groupId;

    const startMin = startZoned.totalMinutes;
    const endMin = endZoned.totalMinutes;
    const gridStartMin = displayStartHour * 60;
    const gridEndMin = displayEndHour * 60;

    const clampedStart = Math.max(gridStartMin, Math.min(gridEndMin, startMin));
    const clampedEnd = Math.max(clampedStart + 15, Math.min(gridEndMin, endMin));

    const leftPercent = ((clampedStart - gridStartMin) / gridTotalMinutes) * 100;
    const widthPercent = Math.max(2, ((clampedEnd - clampedStart) / gridTotalMinutes) * 100);
    const title = b[blackoutTitleField] ?? b.reason ?? b.title ?? "Maintenance Blockout";

    blackoutItems.push({
      id: b.id,
      entityId: spec.blackoutResource ?? "blackouts",
      recordId: b.id,
      title,
      groupId,
      groupLabel,
      start: startRaw,
      end: endRaw,
      startZoned,
      endZoned,
      isBlackout: true,
      tone: "unavailable",
      leftPercent: parseFloat(leftPercent.toFixed(2)),
      widthPercent: parseFloat(widthPercent.toFixed(2)),
      timeRangeLabel: `${startZoned.timeString} – ${endZoned.timeString}`,
      rawRecord: b,
      dateString: startZoned.dateString
    });
  }

  // Combine items & blackouts for lane lane-subdivision collision detection
  const allIntervals = [...items, ...blackoutItems];

  // 4. Collision & Lane Subdivision (PART 26)
  // For items in the same group on the same date, assign subLane & totalSubLanes if overlapping
  for (const group of groups) {
    const groupItems = allIntervals.filter((it) => it.groupId === group.id);
    for (let i = 0; i < groupItems.length; i++) {
      const itA = groupItems[i];
      let overlapsCount = 1;
      let myLane = 0;
      for (let j = 0; j < groupItems.length; j++) {
        if (i === j) continue;
        const itB = groupItems[j];
        if (itA.dateString === itB.dateString) {
          const aStart = itA.startZoned.totalMinutes;
          const aEnd = itA.endZoned.totalMinutes;
          const bStart = itB.startZoned.totalMinutes;
          const bEnd = itB.endZoned.totalMinutes;
          if (aStart < bEnd && aEnd > bStart) {
            overlapsCount++;
            if (j < i) myLane++;
          }
        }
      }
      itA.subLane = myLane;
      itA.totalSubLanes = overlapsCount;
    }
  }

  // 5. Current Time Marker (PART 19)
  let nowMarker = { visible: false };
  if (datesInView.includes(nowZoned.dateString)) {
    const nowMin = nowZoned.totalMinutes;
    const gridStartMin = displayStartHour * 60;
    const gridEndMin = displayEndHour * 60;
    if (nowMin >= gridStartMin && nowMin <= gridEndMin) {
      const percent = ((nowMin - gridStartMin) / gridTotalMinutes) * 100;
      nowMarker = {
        visible: true,
        percent: parseFloat(percent.toFixed(2)),
        timeLabel: nowZoned.timeString,
        dateString: nowZoned.dateString
      };
    }
  }

  // 6. Time Axis Grid Ticks
  const timeAxisTicks = [];
  for (let h = displayStartHour; h <= displayEndHour; h++) {
    const percent = ((h - displayStartHour) / (displayEndHour - displayStartHour)) * 100;
    const label = `${String(h).padStart(2, "0")}:00`;
    timeAxisTicks.push({
      hour: h,
      label,
      percent: parseFloat(percent.toFixed(2))
    });
  }

  // 7. Exact Accessible Data Table Alternative (PART 28 & PART 30)
  const accessibleTableRows = allIntervals
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((it) => ({
      id: it.id,
      title: it.title,
      group: it.groupLabel,
      start: it.start,
      end: it.end,
      timeRange: it.timeRangeLabel,
      status: it.isBlackout ? "Unavailable" : it.status,
      type: it.isBlackout ? "Blackout" : "Reservation",
      quote: it.quote || "—"
    }));

  return {
    schema: "air.schedule-visualization-ir",
    version: SCHEDULE_IR_VERSION,
    id: spec.id ?? `schedule_${spec.resource ?? "default"}`,
    title: spec.title ?? "Schedule",
    resource: spec.resource ?? "reservations",
    groupResource: spec.groupResource ?? "resources",
    representation: layoutDecision.representation,
    isGrid: layoutDecision.isGrid,
    isAgenda: layoutDecision.isAgenda,
    isCompact: layoutDecision.isCompact,
    viewMode,
    currentDate,
    timezone,
    navigation,
    displayStartHour,
    displayEndHour,
    groups,
    items,
    blackouts: blackoutItems,
    allIntervals,
    nowMarker,
    timeAxisTicks,
    accessibleTableRows,
    totalItemsCount: allIntervals.length,
    isEmpty: allIntervals.length === 0,
    emptyState: {
      title: "No scheduled items for this period",
      message: "There are no bookings or events scheduled for the selected date range."
    }
  };
}

export const compileScheduleIR = compileScheduleVisualizationIR;
