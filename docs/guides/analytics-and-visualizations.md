# Analytics & Visualizations

Metrics grids, time-series trends, category breakdowns, and dashboard sections.

---

## 📊 Overview Insights

Declare high-level KPI cards with `insight`:

```air
overview
insight customers.total op=count field=name label="Total Customers"
insight orders.revenue op=sum field=total label="Total Revenue" format=currency
insight orders.pending op=count field=status filter="status==Pending" label="Pending Orders" tone=warning
```

### Aggregation Operations:
- `op=count`: Counts matching records.
- `op=sum`: Sums numeric or minor-unit money values.
- `op=avg`: Computes arithmetic average.
- `format=currency`: Displays values in standard currency format.
- `tone=warning|positive|danger`: Sets visual accent tone on metric card.

---

## 📈 Automatic Data Story Charts

When a resource contains discrete categories or temporal dates, AIR's presentation compiler automatically constructs:
1. **Category Distribution**: Bar/donut charts comparing record volumes by status.
2. **Time-Series Trends**: Linear charts plotting metric volume over time.
3. **Recent Activity Feed**: Latest records with one-click navigation.
