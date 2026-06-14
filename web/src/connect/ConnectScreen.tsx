/*
 * W4 Connect — scaffold stub.
 *
 * Wired into MainScreen's section router by the W4 kickoff PR so the
 * `w4-connect` lane can build out the real view (node-graph build in shared/ +
 * @xyflow/react UI + backlinks here) WITHOUT re-touching the shared router.
 * This is a prop-less placeholder today; the lane replaces the body (and may
 * add its own dataService/Provider wiring on its own mount line in MainScreen).
 */
export function ConnectScreen() {
  return (
    <div className="rounded-md border border-notion-border p-6 text-notion-text-secondary">
      Connect — coming soon (W4)
    </div>
  );
}
