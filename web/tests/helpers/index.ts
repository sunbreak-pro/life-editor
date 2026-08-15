/*
 * web/tests' door onto the shared test helpers (#777).
 *
 * `web/` reaches shared PRODUCTION code through the `@life-editor/shared`
 * alias (vite.config.ts -> ../shared/src), but that alias points at `src` and
 * the helpers live under `shared/tests` — outside it, and outside the built
 * `dist` the package exports. So the path here is relative.
 *
 * A re-export barrel rather than a relative import per suite, for two
 * reasons. The path is four segments of `..` that no reader can verify at a
 * glance, and it is the kind of thing that gets copied wrong; and if the
 * helpers ever move (into the alias, into their own package), this is the one
 * file that changes instead of every web suite.
 *
 * Only vitest ever loads this. `tsconfig.app.json` includes `src` alone, so
 * nothing here reaches the browser bundle or `tsc -b`.
 */
export { stubDataService } from "../../../shared/tests/helpers/dataServiceStub";
export { makeNote, makeTodo } from "../../../shared/tests/helpers/nodeFixtures";
export {
  createBumpableSync,
  type BumpableSync,
  type BumpableSyncHandle,
} from "../../../shared/tests/helpers/bumpableSync";
