/*
 * Await a call that is expected to REJECT, and hand back the Error (#1001).
 *
 * The suites used to write this inline:
 *
 *   const error = await callTool(...).catch((e: unknown) => e as Error);
 *   expect(error.message).toContain("...");
 *
 * which reads as if `error` were an Error but is not: `.catch()` widens the
 * type to `Resolved | Error`, so `.message` is only there on one arm. That is
 * what the first type check of tests/ found, 23 times over.
 *
 * The cast was also hiding a failure mode. If the call ever stopped rejecting,
 * `error` would be the RESOLVED value, `error.message` would be `undefined`,
 * and the suite would fail with "expected undefined to contain ..." — a
 * message that sends you looking at the wrong half of the test. Rejecting is
 * the thing these suites assert, so it is asserted here, once, by name.
 */
export async function rejection(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (e) {
    if (e instanceof Error) return e;
    throw new Error(`expected an Error, got ${typeof e}: ${String(e)}`);
  }
  throw new Error("expected the call to reject, but it resolved");
}
