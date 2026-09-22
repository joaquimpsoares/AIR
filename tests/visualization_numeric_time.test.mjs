import test from "node:test";
import assert from "node:assert/strict";
import {
  compileVisualizationIR,
  formatDimensionKey,
  formatMetricValue,
  VISUAL_INTENTS
} from "../web/runtime/visualization_ir.mjs";

test("Visualization Numeric & Time Correctness Gate", async (t) => {
  await t.test("1. Exact Minor-Unit Money Aggregation (Zero Binary Float Drift)", () => {
    // 19.99 + 10.01 in standard JS IEEE-754 float is 30.000000000000004
    const records = [
      { category: "Hardware", amount: 19.99 },
      { category: "Hardware", amount: 10.01 },
      { category: "Software", amount: 0.10 },
      { category: "Software", amount: 0.20 }
    ];

    const viz = compileVisualizationIR({
      title: "Expense Totals",
      dimension: "category",
      measure: "amount",
      format: "currency",
      currency: "USD",
      aggregate: "sum"
    }, records);

    const hwRow = viz.exactData.find((r) => r.dimension === "Hardware");
    const swRow = viz.exactData.find((r) => r.dimension === "Software");

    assert.equal(hwRow.value, 30.00, "19.99 + 10.01 must equal exact 30.00 without floating point drift");
    assert.equal(swRow.value, 0.30, "0.10 + 0.20 must equal exact 0.30");
    assert.equal(viz.grandTotal, 30.30, "Grand total must equal exact 30.30");
    assert.equal(viz.formattedGrandTotal, "$30.30");

    // Negative midpoint money averages (symmetric half-away-from-zero)
    const negAvgViz1 = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency",
      aggregate: "avg"
    }, [
      { category: "Test1", amount: -0.01 },
      { category: "Test1", amount: 0.00 }
    ]);
    assert.equal(negAvgViz1.exactData[0].value, -0.01, "(-0.01 + 0.00) / 2 must round to -0.01");

    const negAvgViz2 = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency",
      aggregate: "avg"
    }, [
      { category: "Test2", amount: -0.01 },
      { category: "Test2", amount: -0.02 }
    ]);
    assert.equal(negAvgViz2.exactData[0].value, -0.02, "(-0.01 + -0.02) / 2 must round to -0.02");

    const negAvgViz3 = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency",
      aggregate: "avg"
    }, [
      { category: "Test3", amount: -10.00 },
      { category: "Test3", amount: -10.01 }
    ]);
    assert.equal(negAvgViz3.exactData[0].value, -10.01, "(-10.00 + -10.01) / 2 must round to -10.01");

    const posAvgViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency",
      aggregate: "avg"
    }, [
      { category: "Pos", amount: 10.00 },
      { category: "Pos", amount: 10.01 }
    ]);
    assert.equal(posAvgViz.exactData[0].value, 10.01, "(10.00 + 10.01) / 2 must round to 10.01");

    // Large money value precision
    const largeViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency",
      aggregate: "sum"
    }, [
      { category: "Enterprise", amount: 999999999999.99 },
      { category: "Enterprise", amount: 0.01 }
    ]);
    assert.equal(largeViz.grandTotal, 1000000000000.00, "Large money value must sum cleanly to exact 1 trillion");
  });

  await t.test("2. Currency Compatibility & Mismatch Enforcement", () => {
    const singleCurrRecords = [
      { category: "Services", amount: 500, currency: "EUR" },
      { category: "Licensing", amount: 300, currency: "EUR" }
    ];

    const singleViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency"
    }, singleCurrRecords);

    assert.equal(singleViz.currency, "EUR");
    assert.equal(singleViz.currencyMismatch, false);
    assert.equal(singleViz.formattedGrandTotal, "€800");

    const mixedCurrRecords = [
      { category: "US Branch", amount: 500, currency: "USD" },
      { category: "EU Branch", amount: 500, currency: "EUR" }
    ];

    const mixedViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency"
    }, mixedCurrRecords);

    assert.equal(mixedViz.currencyMismatch, true, "Mixed currencies must be detected");
    assert.deepEqual(mixedViz.detectedCurrencies.sort(), ["EUR", "USD"]);
    assert.match(mixedViz.accessibleSummary, /Warning: Multiple currencies detected/);

    assert.throws(() => {
      compileVisualizationIR({
        dimension: "category",
        measure: "amount",
        format: "currency"
      }, mixedCurrRecords, { strictCurrency: true });
    }, /Currency compatibility error: Mixed currencies detected/);
  });

  await t.test("3. Decimal & Percentage Semantics (Zero Denominator, Ratios, Outliers)", () => {
    // Zero grand total
    const zeroRecords = [
      { category: "A", amount: 0 },
      { category: "B", amount: 0 }
    ];
    const zeroViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency"
    }, zeroRecords);

    assert.equal(zeroViz.grandTotal, 0);
    assert.equal(zeroViz.exactData[0].percentage, 0, "Zero denominator must yield 0%, never NaN");
    assert.equal(zeroViz.exactData[1].percentage, 0);

    // Standard exact ratios
    const ratioRecords = [
      { category: "A", val: 25 },
      { category: "B", val: 75 }
    ];
    const ratioViz = compileVisualizationIR({
      dimension: "category",
      measure: "val",
      format: "number"
    }, ratioRecords);

    assert.equal(ratioViz.exactData[0].percentage, 25);
    assert.equal(ratioViz.exactData[1].percentage, 75);
  });

  await t.test("4. Invalid Numeric Handling (NaN, Infinity, null, non-numeric strings)", () => {
    const corruptRecords = [
      { category: "Valid", amount: 100 },
      { category: "NullValue", amount: null },
      { category: "UndefinedValue", amount: undefined },
      { category: "NaNValue", amount: NaN },
      { category: "InfValue", amount: Infinity },
      { category: "NegInfValue", amount: -Infinity },
      { category: "BadString", amount: "N/A" },
      { category: "BooleanVal", amount: true }
    ];

    const safeViz = compileVisualizationIR({
      dimension: "category",
      measure: "amount",
      format: "currency"
    }, corruptRecords);

    assert.equal(safeViz.grandTotal, 100, "Corrupt or non-finite inputs must be safely ignored");
    assert.equal(Number.isFinite(safeViz.grandTotal), true);
    for (const row of safeViz.exactData) {
      assert.equal(Number.isFinite(row.value), true);
      assert.equal(Number.isFinite(row.percentage), true);
    }
  });

  await t.test("5. Deterministic UTC Time Grouping & Midnight / Year Boundaries", () => {
    // Midnight transition test between years
    const k1 = formatDimensionKey("2026-12-31T23:59:59Z", "date", "year");
    const k2 = formatDimensionKey("2027-01-01T00:00:00Z", "date", "year");
    assert.equal(k1, "2026");
    assert.equal(k2, "2027");

    const q1 = formatDimensionKey("2026-12-31T23:59:59Z", "date", "quarter");
    const q2 = formatDimensionKey("2027-01-01T00:00:00Z", "date", "quarter");
    assert.equal(q1, "2026-Q4");
    assert.equal(q2, "2027-Q1");

    const m1 = formatDimensionKey("2026-02-28T23:59:59Z", "date", "month");
    const m2 = formatDimensionKey("2026-03-01T00:00:00Z", "date", "month");
    assert.equal(m1, "Feb 2026");
    assert.equal(m2, "Mar 2026");

    const h1 = formatDimensionKey("2026-06-15T14:30:00Z", "time", "hour");
    assert.equal(h1, "2026-06-15 14:00 UTC");

    // ISO week determinism
    const w1 = formatDimensionKey("2026-01-01T00:00:00Z", "date", "week");
    assert.equal(w1, "2026-W01");
  });
});
