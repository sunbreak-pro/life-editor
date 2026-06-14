/*
 * W4 Analytics — scaffold stub.
 *
 * Wired into MainScreen's section router by the W4 kickoff PR so the
 * `w4-analytics` lane can build out the real view (aggregation logic in
 * shared/ + recharts UI here) WITHOUT re-touching the shared router. This is
 * a prop-less placeholder today; the lane replaces the body (and may add its
 * own dataService/Provider wiring on its own mount line in MainScreen).
 */
export function AnalyticsScreen() {
  return (
    <div className="rounded-md border border-notion-border p-6 text-notion-text-secondary">
      Analytics — coming soon (W4)
    </div>
  );
}
