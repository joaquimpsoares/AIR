/**
 * AIR Web Platform Renderer for Data Visualizations and Semantic Graphs
 *
 * Renders platform-neutral Visualization IR and Graph IR directly into accessible
 * HTML and SVG components using AIR Design System tokens and CSS variables.
 *
 * Invariants:
 * 1. Zero external chart-library dependencies (pure native SVG + semantic HTML).
 * 2. Exact accessible data table representation is rendered for every visual chart.
 * 3. Responsive Minimum Viable Visual Width recomposition.
 * 4. Semantic tooltips, keyboard navigation, and aria-live announcements.
 */

import {
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  SEMANTIC_GRAPH_MODES,
  SEMANTIC_GRAPH_REPRESENTATIONS,
  VISUAL_PALETTE
} from "./visualization_ir.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

/**
 * Renders Data Visualization Artifact (Line, Area, Bar, Stacked Bar, Scatter, Sparkline)
 */
export function renderDataVisualization(vizIr, options = {}) {
  if (!vizIr) return "";

  const state = options.state ?? "idle";
  const showTableInitially = Boolean(options.showTable);
  const vizId = vizIr.id || `viz_${Math.random().toString(36).slice(2, 9)}`;

  // 1. Standard Artifact States
  if (state === "loading") {
    return `<section class="panel visualization-panel loading-state" data-artifact="data_visualization" data-state="loading" aria-busy="true" aria-label="Loading ${escapeHtml(vizIr.title)}">
      <div class="panel-heading"><div><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text" style="width: 60%;"></div></div></div>
      <div class="viz-stage-skeleton"><div class="skeleton-chart-bar" style="height: 40%;"></div><div class="skeleton-chart-bar" style="height: 75%;"></div><div class="skeleton-chart-bar" style="height: 55%;"></div><div class="skeleton-chart-bar" style="height: 90%;"></div></div>
    </section>`;
  }

  if (state === "error") {
    return `<section class="panel visualization-panel error-state" data-artifact="data_visualization" data-state="error" role="alert">
      <div class="panel-heading"><div><h3>${escapeHtml(vizIr.title)}</h3><p>Unable to compute visualization</p></div></div>
      <div class="error-banner"><p>An error occurred while aggregating data for this chart.</p></div>
    </section>`;
  }

  if (state === "empty" || (vizIr.exactData && vizIr.exactData.length === 0)) {
    return `<section class="panel visualization-panel empty-state" data-artifact="data_visualization" data-state="empty" aria-label="${escapeHtml(vizIr.title)}">
      <div class="panel-heading"><div><h3>${escapeHtml(vizIr.title)}</h3><p>${escapeHtml(vizIr.subtitle)}</p></div></div>
      <div class="empty-state-content">
        <svg class="icon empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        <p class="empty-title">No data available</p>
        <p class="empty-desc">No records currently match this metric query.</p>
      </div>
    </section>`;
  }

  // 2. Render Visual SVG Representation
  const visualContent = renderSvgChart(vizIr);

  // 3. Render Accessible Exact Data Table
  const tableContent = renderAccessibleDataTable(vizIr);

  // 4. Render Series Legend (if multi-series)
  const legendMarkup = (vizIr.series && vizIr.series.length > 1)
    ? `<div class="viz-legend" role="list" aria-label="Series legend">
        ${vizIr.series.map((s) => `
          <div class="viz-legend-item" role="listitem">
            <span class="viz-legend-dot" style="background-color: ${escapeHtml(s.color)};"></span>
            <span class="viz-legend-label">${escapeHtml(s.label)}</span>
          </div>
        `).join("")}
      </div>`
    : "";

  return `
    <section class="panel visualization-panel" 
      id="viz-container-${escapeHtml(vizId)}"
      data-artifact="data_visualization" 
      data-representation="${escapeHtml(vizIr.representation)}" 
      data-intent="${escapeHtml(vizIr.intent)}"
      data-section-relationship="independent"
      aria-label="${escapeHtml(vizIr.title)}">
      
      <div class="panel-heading viz-header">
        <div class="viz-titles">
          <p class="eyebrow">${escapeHtml(vizIr.intent.toUpperCase())} INSIGHT</p>
          <div class="viz-title-row">
            <h3 class="viz-title">${escapeHtml(vizIr.title)}</h3>
            ${vizIr.formattedGrandTotal ? `<span class="viz-grand-total">${escapeHtml(vizIr.formattedGrandTotal)}</span>` : ""}
          </div>
          ${vizIr.subtitle ? `<p class="viz-subtitle">${escapeHtml(vizIr.subtitle)}</p>` : ""}
        </div>
        
        <div class="viz-controls">
          ${legendMarkup}
          <button type="button" 
            class="button secondary icon-button viz-toggle-btn" 
            data-viz-toggle="${escapeHtml(vizId)}" 
            aria-expanded="${showTableInitially ? "true" : "false"}"
            aria-controls="viz-table-${escapeHtml(vizId)}"
            title="Toggle between visual chart and accessible data table">
            <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            <span class="sr-only">Toggle accessible data table view</span>
          </button>
        </div>
      </div>

      <!-- Screen Reader Summary (Polite Live Region) -->
      <p class="sr-only" aria-live="polite">${escapeHtml(vizIr.accessibleSummary)}</p>

      <!-- Visual Representation Container -->
      <div class="viz-stage ${showTableInitially ? "hidden" : ""}" id="viz-stage-${escapeHtml(vizId)}" role="img" aria-label="${escapeHtml(vizIr.title)} visual chart">
        ${visualContent}
      </div>

      <!-- Accessible Exact Data Table Container -->
      <div class="viz-table-container ${showTableInitially ? "" : "hidden"}" id="viz-table-${escapeHtml(vizId)}" role="region" aria-label="${escapeHtml(vizIr.title)} accessible data">
        ${tableContent}
      </div>
    </section>
  `;
}

/**
 * Dispatches to specific SVG renderer based on Representation
 */
function renderSvgChart(vizIr) {
  const rep = vizIr.representation;

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE) {
    return renderSvgLineChart(vizIr, { isCompact: rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE, filled: false });
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_AREA) {
    return renderSvgLineChart(vizIr, { isCompact: rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_AREA, filled: true });
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR) {
    return renderSvgVerticalBarChart(vizIr);
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR) {
    return renderSvgHorizontalBarChart(vizIr, { isCompact: rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR });
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.NORMALIZED_STACK) {
    return renderSvgStackedBarChart(vizIr);
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_SCATTER) {
    return renderSvgScatterChart(vizIr);
  }

  if (rep === DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE ||
      rep === DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY) {
    return renderSvgSparkline(vizIr);
  }

  return renderSvgVerticalBarChart(vizIr);
}

/**
 * 1. Line / Area Chart Renderer
 */
function renderSvgLineChart(vizIr, { isCompact = false, filled = false } = {}) {
  const width = isCompact ? 500 : 700;
  const height = isCompact ? 180 : 260;
  const padLeft = isCompact ? 35 : 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = isCompact ? 25 : 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = vizIr.series?.[0]?.points ?? [];
  if (points.length === 0) return `<div class="viz-no-points">No data points</div>`;

  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const minY = vizIr.yAxis?.min ?? 0;
  const yRange = maxY - minY || 1;

  const coords = points.map((p, i) => {
    const x = padLeft + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
    const normalizedY = (p.y - minY) / yRange;
    const y = padTop + chartH - normalizedY * chartH;
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? "M" : "L"} ${c.x.toFixed(1)},${c.y.toFixed(1)}`, "").trim();
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)},${(padTop + chartH).toFixed(1)} L ${coords[0].x.toFixed(1)},${(padTop + chartH).toFixed(1)} Z`;

  const strokeColor = vizIr.series?.[0]?.color ?? VISUAL_PALETTE[0].hex;

  // Gridlines
  const yTicks = vizIr.yAxis?.ticks ?? [];
  const gridlines = yTicks.map((tick) => {
    const norm = (tick.value - minY) / yRange;
    const yPos = padTop + chartH - norm * chartH;
    return `
      <line x1="${padLeft}" y1="${yPos.toFixed(1)}" x2="${width - padRight}" y2="${yPos.toFixed(1)}" stroke="var(--border, rgba(255,255,255,0.08))" stroke-dasharray="3 3"/>
      <text x="${padLeft - 8}" y="${(yPos + 4).toFixed(1)}" font-size="10" fill="var(--meta, #94a3b8)" text-anchor="end" font-family="inherit">${escapeHtml(tick.label)}</text>
    `;
  }).join("");

  // X Axis Labels
  const xLabels = coords.map((c, i) => {
    if (points.length > 8 && i % 2 !== 0) return ""; // Skip every other on crowded
    return `
      <text x="${c.x.toFixed(1)}" y="${height - 6}" font-size="10" fill="var(--meta, #94a3b8)" text-anchor="middle" font-family="inherit">${escapeHtml(c.point.formattedX || c.point.x)}</text>
    `;
  }).join("");

  // Interactive dots with semantic titles
  const dots = coords.map((c) => `
    <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isCompact ? 3.5 : 4.5}" fill="${strokeColor}" stroke="var(--surface, #0f172a)" stroke-width="2" class="viz-data-dot" tabindex="0" role="graphics-symbol" aria-label="${escapeHtml(c.point.formattedX)}: ${escapeHtml(c.point.formattedY)}">
      <title>${escapeHtml(c.point.formattedX)}: ${escapeHtml(c.point.formattedY)}</title>
    </circle>
  `).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="viz-svg viz-line-svg" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <defs>
        <linearGradient id="area-grad-${escapeHtml(vizIr.id)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <g class="viz-grid">${gridlines}</g>
      ${filled ? `<path d="${areaD}" fill="url(#area-grad-${escapeHtml(vizIr.id)})" class="viz-area-path"/>` : ""}
      <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="viz-line-path"/>
      <g class="viz-dots">${dots}</g>
      <g class="viz-x-labels">${xLabels}</g>
    </svg>
  `;
}

/**
 * 2. Vertical Bar Chart Renderer
 */
function renderSvgVerticalBarChart(vizIr) {
  const width = 700;
  const height = 260;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = vizIr.series?.[0]?.points ?? [];
  const count = points.length || 1;
  const barSlotW = chartW / count;
  const barW = Math.min(Math.max(barSlotW * 0.65, 12), 48);

  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const minY = 0;
  const yRange = maxY - minY || 1;

  const strokeColor = vizIr.series?.[0]?.color ?? VISUAL_PALETTE[0].hex;

  // Gridlines
  const yTicks = vizIr.yAxis?.ticks ?? [];
  const gridlines = yTicks.map((tick) => {
    const norm = (tick.value - minY) / yRange;
    const yPos = padTop + chartH - norm * chartH;
    return `
      <line x1="${padLeft}" y1="${yPos.toFixed(1)}" x2="${width - padRight}" y2="${yPos.toFixed(1)}" stroke="var(--border, rgba(255,255,255,0.08))" stroke-dasharray="3 3"/>
      <text x="${padLeft - 8}" y="${(yPos + 4).toFixed(1)}" font-size="10" fill="var(--meta, #94a3b8)" text-anchor="end" font-family="inherit">${escapeHtml(tick.label)}</text>
    `;
  }).join("");

  const bars = points.map((p, i) => {
    const norm = Math.max(0, p.y - minY) / yRange;
    const bHeight = Math.max(norm * chartH, 2);
    const x = padLeft + i * barSlotW + (barSlotW - barW) / 2;
    const y = padTop + chartH - bHeight;

    return `
      <g class="viz-bar-group" tabindex="0" role="graphics-symbol" aria-label="${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bHeight.toFixed(1)}" rx="4" fill="${strokeColor}" class="viz-bar-rect">
          <title>${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}</title>
        </rect>
        <text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" font-size="10" fill="var(--meta, #94a3b8)" text-anchor="middle" font-family="inherit">${escapeHtml(p.formattedX)}</text>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="viz-svg viz-bar-svg" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <g class="viz-grid">${gridlines}</g>
      <g class="viz-bars">${bars}</g>
    </svg>
  `;
}

/**
 * 3. Horizontal Bar Chart Renderer
 */
function renderSvgHorizontalBarChart(vizIr, { isCompact = false } = {}) {
  const points = vizIr.series?.[0]?.points ?? [];
  const barHeight = isCompact ? 18 : 24;
  const rowGap = isCompact ? 10 : 16;
  const labelWidth = isCompact ? 80 : 110;
  const valueWidth = 60;
  const width = 500;
  const totalH = points.length * (barHeight + rowGap) + 20;

  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const barAreaW = width - labelWidth - valueWidth - 20;
  const strokeColor = vizIr.series?.[0]?.color ?? VISUAL_PALETTE[0].hex;

  const rows = points.map((p, i) => {
    const norm = Math.max(0, p.y) / maxY;
    const barW = Math.max(norm * barAreaW, 4);
    const y = i * (barHeight + rowGap) + 10;

    return `
      <g class="viz-h-bar-group" tabindex="0" role="graphics-symbol" aria-label="${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}">
        <text x="${labelWidth - 10}" y="${(y + barHeight * 0.7).toFixed(1)}" font-size="11" fill="var(--text, #f8fafc)" text-anchor="end" font-family="inherit">${escapeHtml(p.formattedX)}</text>
        <rect x="${labelWidth}" y="${y.toFixed(1)}" width="${barAreaW.toFixed(1)}" height="${barHeight}" rx="3" fill="var(--surface-muted, rgba(255,255,255,0.06))" class="viz-h-bar-bg"/>
        <rect x="${labelWidth}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barHeight}" rx="3" fill="${strokeColor}" class="viz-h-bar-fill">
          <title>${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}</title>
        </rect>
        <text x="${(labelWidth + barW + 8).toFixed(1)}" y="${(y + barHeight * 0.7).toFixed(1)}" font-size="11" font-weight="600" fill="var(--text, #f8fafc)" text-anchor="start" font-family="inherit">${escapeHtml(p.formattedY)}</text>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${totalH}" class="viz-svg viz-h-bar-svg" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      ${rows}
    </svg>
  `;
}

/**
 * 4. Stacked Bar Chart Renderer
 */
function renderSvgStackedBarChart(vizIr) {
  const width = 700;
  const height = 260;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const categories = vizIr.categories ?? [];
  const count = categories.length || 1;
  const barSlotW = chartW / count;
  const barW = Math.min(Math.max(barSlotW * 0.65, 14), 48);

  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const seriesList = vizIr.series ?? [];

  // Compute category totals
  const categoryTotals = categories.map((cat, catIdx) => {
    return seriesList.reduce((sum, s) => sum + (s.points?.[catIdx]?.y ?? 0), 0);
  });
  const maxStackTotal = Math.max(...categoryTotals, maxY, 1);

  const bars = categories.map((cat, catIdx) => {
    const x = padLeft + catIdx * barSlotW + (barSlotW - barW) / 2;
    let accumulatedY = 0;

    const segments = seriesList.map((s, sIdx) => {
      const val = s.points?.[catIdx]?.y ?? 0;
      const norm = val / maxStackTotal;
      const segH = norm * chartH;
      const y = padTop + chartH - accumulatedY - segH;
      accumulatedY += segH;

      if (segH <= 0) return "";

      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${escapeHtml(s.color)}" class="viz-stacked-seg">
          <title>${escapeHtml(cat)} - ${escapeHtml(s.label)}: ${escapeHtml(s.points?.[catIdx]?.formattedY ?? val)}</title>
        </rect>
      `;
    }).join("");

    return `
      <g class="viz-stacked-bar-group" tabindex="0" role="graphics-symbol" aria-label="${escapeHtml(cat)} stack">
        ${segments}
        <text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" font-size="10" fill="var(--meta, #94a3b8)" text-anchor="middle" font-family="inherit">${escapeHtml(cat)}</text>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="viz-svg viz-stacked-svg" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <g class="viz-stacked-bars">${bars}</g>
    </svg>
  `;
}

/**
 * 5. Scatter Chart Renderer
 */
function renderSvgScatterChart(vizIr) {
  const width = 600;
  const height = 240;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = vizIr.series?.[0]?.points ?? [];
  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const strokeColor = vizIr.series?.[0]?.color ?? VISUAL_PALETTE[0].hex;

  const dots = points.map((p, i) => {
    const x = padLeft + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
    const normY = Math.max(0, p.y) / maxY;
    const y = padTop + chartH - normY * chartH;

    return `
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${strokeColor}" fill-opacity="0.85" stroke="var(--surface, #0f172a)" stroke-width="1.5" class="viz-scatter-dot" tabindex="0" role="graphics-symbol" aria-label="${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}">
        <title>${escapeHtml(p.formattedX)}: ${escapeHtml(p.formattedY)}</title>
      </circle>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="viz-svg viz-scatter-svg" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <g class="viz-scatter-dots">${dots}</g>
    </svg>
  `;
}

/**
 * 6. Sparkline Summary Renderer
 */
function renderSvgSparkline(vizIr) {
  const width = 240;
  const height = 50;
  const pad = 6;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const points = vizIr.series?.[0]?.points ?? [];
  if (points.length === 0) return "";

  const maxY = vizIr.yAxis?.max > 0 ? vizIr.yAxis.max : 1;
  const minY = vizIr.yAxis?.min ?? 0;
  const yRange = maxY - minY || 1;

  const coords = points.map((p, i) => {
    const x = pad + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
    const norm = (p.y - minY) / yRange;
    const y = pad + chartH - norm * chartH;
    return { x, y };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? "M" : "L"} ${c.x.toFixed(1)},${c.y.toFixed(1)}`, "").trim();
  const strokeColor = vizIr.series?.[0]?.color ?? VISUAL_PALETTE[0].hex;

  const first = points[0];
  const last = points[points.length - 1];

  return `
    <div class="viz-sparkline-card">
      <div class="viz-sparkline-meta">
        <span class="viz-sparkline-start">${escapeHtml(first?.formattedY ?? "")}</span>
        <span class="viz-sparkline-end">${escapeHtml(last?.formattedY ?? "")}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="viz-svg viz-sparkline-svg" preserveAspectRatio="none" width="100%" height="50">
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${coords[coords.length - 1].x.toFixed(1)}" cy="${coords[coords.length - 1].y.toFixed(1)}" r="3.5" fill="${strokeColor}"/>
      </svg>
    </div>
  `;
}

/**
 * Accessible Exact Data Table Renderer
 */
function renderAccessibleDataTable(vizIr) {
  const rows = vizIr.exactData ?? [];
  if (rows.length === 0) return `<p class="viz-table-empty">No table records available.</p>`;

  const dimHeader = vizIr.xAxis?.label || "Dimension";
  const valHeader = vizIr.yAxis?.label || "Value";

  const rowsMarkup = rows.map((row) => `
    <tr>
      <th scope="row" class="viz-th-dim">${escapeHtml(row.dimension)}</th>
      <td class="viz-td-val"><strong>${escapeHtml(row.formattedValue)}</strong></td>
      <td class="viz-td-pct">
        <div class="viz-table-meter">
          <span class="viz-table-meter-bar" style="width: ${row.percentage || 0}%;"></span>
          <span class="viz-table-meter-text">${row.percentage || 0}%</span>
        </div>
      </td>
      <td class="viz-td-count">${row.count ?? 1}</td>
    </tr>
  `).join("");

  return `
    <div class="table-container viz-table-scroll">
      <table class="data-table viz-data-table" aria-label="${escapeHtml(vizIr.title)} exact data table">
        <thead>
          <tr>
            <th scope="col">${escapeHtml(dimHeader)}</th>
            <th scope="col">${escapeHtml(valHeader)}</th>
            <th scope="col">Share</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          ${rowsMarkup}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renders Semantic Graph Artifact (Workflow, DAG, Timeline, Architecture Flow)
 */
export function renderSemanticGraph(graphIr, options = {}) {
  if (!graphIr) return "";

  const graphId = graphIr.id || `graph_${Math.random().toString(36).slice(2, 9)}`;

  if (graphIr.mode === SEMANTIC_GRAPH_MODES.WORKFLOW) {
    return renderWorkflowGraphHtml(graphIr, graphId);
  }

  if (graphIr.mode === SEMANTIC_GRAPH_MODES.TIMELINE) {
    return renderTimelineGraphHtml(graphIr, graphId);
  }

  if (graphIr.mode === SEMANTIC_GRAPH_MODES.DAG || graphIr.mode === SEMANTIC_GRAPH_MODES.ARCHITECTURE_FLOW) {
    return renderDagGraphHtml(graphIr, graphId);
  }

  return `<div class="graph-placeholder">Unsupported graph mode</div>`;
}

/**
 * Workflow Graph HTML/SVG Renderer
 */
function renderWorkflowGraphHtml(graphIr, graphId) {
  const isVertical = graphIr.representation === SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_STATE_PATH;
  const nodes = graphIr.nodes ?? [];
  const edges = graphIr.edges ?? [];

  const nodesMarkup = nodes.map((n, idx) => {
    const isLast = idx === nodes.length - 1;
    const toneClass = n.status === "active" ? "node-active" : n.status === "completed" ? "node-completed" : n.status === "available" ? "node-available" : "node-locked";

    return `
      <div class="wf-node ${toneClass}" data-state-id="${escapeHtml(n.id)}" role="listitem">
        <div class="wf-node-header">
          <span class="wf-node-dot"></span>
          <strong class="wf-node-label">${escapeHtml(n.label)}</strong>
        </div>
        <span class="wf-node-badge">${escapeHtml(n.badge)}</span>
        ${!isLast && isVertical ? '<div class="wf-step-connector" aria-hidden="true"></div>' : ""}
      </div>
    `;
  }).join("");

  const transitionsMarkup = edges.map((e) => `
    <div class="wf-edge-item ${e.isAvailable ? "edge-available" : "edge-inactive"}">
      <span class="wf-edge-action"><strong>${escapeHtml(e.label)}</strong> (${escapeHtml(e.from)} → ${escapeHtml(e.to)})</span>
      <span class="wf-edge-actor">Actor: <code>${escapeHtml(e.actor)}</code></span>
      ${e.guard ? `<span class="wf-edge-guard">Guard: <code>${escapeHtml(e.guard)}</code></span>` : ""}
    </div>
  `).join("");

  return `
    <section class="panel graph-panel workflow-graph-panel" 
      id="${escapeHtml(graphId)}"
      data-artifact="semantic_graph" 
      data-graph-mode="workflow"
      data-representation="${escapeHtml(graphIr.representation)}"
      data-section-relationship="independent"
      aria-label="Workflow State Graph">
      
      <div class="panel-heading">
        <div>
          <p class="eyebrow">WORKFLOW STATE GRAPH</p>
          <div class="wf-title-row">
            <h3>State Lifecycle</h3>
            <span class="badge ${graphIr.currentState === "Approved" || graphIr.currentState === "Paid" ? "positive" : "violet"}">
              Current: ${escapeHtml(graphIr.currentState)}
            </span>
          </div>
        </div>
      </div>

      <p class="sr-only" aria-live="polite">${escapeHtml(graphIr.accessibleSummary)}</p>

      <div class="wf-graph-layout ${isVertical ? "wf-vertical-stepper" : "wf-horizontal-graph"}" role="list" aria-label="Workflow steps">
        ${nodesMarkup}
      </div>

      ${edges.length > 0 ? `
        <div class="wf-transitions-panel">
          <h4 class="wf-transitions-title">Declared Transitions & Guards</h4>
          <div class="wf-transitions-list">${transitionsMarkup}</div>
        </div>
      ` : ""}
    </section>
  `;
}

/**
 * Timeline Graph HTML/SVG Renderer
 */
function renderTimelineGraphHtml(graphIr, graphId) {
  const events = graphIr.events ?? [];

  const eventsMarkup = events.map((evt, idx) => `
    <div class="timeline-event tone-${escapeHtml(evt.statusTone)}" role="listitem">
      <div class="timeline-marker">
        <span class="timeline-dot"></span>
        ${idx < events.length - 1 ? '<span class="timeline-line" aria-hidden="true"></span>' : ""}
      </div>
      <div class="timeline-content">
        <div class="timeline-header">
          <strong class="timeline-label">${escapeHtml(evt.label)}</strong>
          <span class="timeline-time">${escapeHtml(evt.formattedDate)}</span>
        </div>
        <div class="timeline-actor">by <strong>${escapeHtml(evt.actorRole)}</strong> (${escapeHtml(evt.actor)})</div>
        ${evt.comment ? `<p class="timeline-comment">"${escapeHtml(evt.comment)}"</p>` : ""}
      </div>
    </div>
  `).join("");

  return `
    <section class="panel graph-panel timeline-graph-panel" 
      id="${escapeHtml(graphId)}"
      data-artifact="semantic_graph" 
      data-graph-mode="timeline"
      data-representation="${escapeHtml(graphIr.representation)}"
      data-section-relationship="independent"
      aria-label="Sequential History Timeline">
      
      <div class="panel-heading">
        <div>
          <p class="eyebrow">AUDIT & HISTORY</p>
          <h3>Event Timeline</h3>
        </div>
      </div>

      <p class="sr-only" aria-live="polite">${escapeHtml(graphIr.accessibleSummary)}</p>

      <div class="timeline-stream" role="list" aria-label="Timeline event history">
        ${eventsMarkup.length > 0 ? eventsMarkup : '<div class="empty-state">No events recorded.</div>'}
      </div>
    </section>
  `;
}

/**
 * Directed Acyclic Graph (DAG) HTML Renderer
 */
function renderDagGraphHtml(graphIr, graphId) {
  const nodes = graphIr.nodes ?? [];
  const edges = graphIr.edges ?? [];

  const nodesMarkup = nodes.map((n) => `
    <div class="dag-node-card" role="listitem">
      <strong class="dag-node-id">${escapeHtml(n.label || n.id)}</strong>
      ${n.description ? `<p class="dag-node-desc">${escapeHtml(n.description)}</p>` : ""}
    </div>
  `).join("");

  return `
    <section class="panel graph-panel dag-graph-panel" 
      id="${escapeHtml(graphId)}"
      data-artifact="semantic_graph" 
      data-graph-mode="dag"
      data-representation="${escapeHtml(graphIr.representation)}"
      data-section-relationship="independent"
      aria-label="${escapeHtml(graphIr.title || "DAG Graph")}">
      
      <div class="panel-heading">
        <div>
          <p class="eyebrow">SEMANTIC GRAPH</p>
          <h3>${escapeHtml(graphIr.title || "Dependency DAG")}</h3>
        </div>
      </div>

      <p class="sr-only" aria-live="polite">${escapeHtml(graphIr.accessibleSummary)}</p>

      <div class="dag-nodes-grid" role="list">
        ${nodesMarkup}
      </div>
    </section>
  `;
}
