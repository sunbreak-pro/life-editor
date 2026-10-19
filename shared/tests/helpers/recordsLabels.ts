import type { RecordsLabels } from "../../src/components/Analytics/labels";

/*
 * A complete `RecordsLabels` fixture (#2164) — plain English copy and simple
 * formatters, so a suite can assert on what the Records tab and the narrow
 * block print. `formatValue` puts the unit after the number ("450 JPY").
 */
export function makeRecordsLabels(): RecordsLabels {
  return {
    filtersLabel: "Filter records",
    app: { label: "App", all: "All apps" },
    kind: { label: "Kind", all: "All kinds" },
    claudeSource: "Claude",
    stats: {
      count: "Records",
      sum: "Total",
      avg: "Average",
      latest: "Latest",
      needOneKind: "Pick one kind",
      headline: "Shown first",
    },
    chart: {
      sumTitle: "Total over time",
      countTitle: "Records over time",
      avgTitle: "Average over time",
      latestTitle: "Latest in each period",
      sumSeries: "Total",
      countSeries: "Count",
      avgSeries: "Average",
      latestSeries: "Latest",
    },
    views: {
      title: "How each kind is shown",
      description: "Pick the number each kind leads with.",
      selectLabel: (kind) => `How to show ${kind}`,
      metrics: {
        sum: "Total",
        avg: "Average",
        latest: "Latest",
        count: "Count",
      },
      chartSelectLabel: (kind) => `Chart for ${kind}`,
      charts: { bar: "Bars", line: "Line" },
      saveFailed: "That choice could not be saved",
    },
    list: {
      title: "Record list",
      showMore: "Show more",
      shown: (shown, total) => `Showing ${shown} of ${total}`,
    },
    empty: {
      title: "No records in this range",
      description: "Tell Claude “coffee, 450 yen”.",
    },
    emptyFiltered: {
      title: "No records match",
      description: "Change the filters.",
    },
    loadFailed: "Records could not be loaded",
    formatValue: (value, unit) => (unit ? `${value} ${unit}` : String(value)),
    formatNumber: (value) => String(value),
    formatDateTime: (iso) => iso,
    mobile: {
      title: "Records",
      range: "Last 7 days",
      empty: "No records in the last 7 days.",
      formatCount: (count) => `${count} records`,
    },
  };
}
