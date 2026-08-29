/*
 * Backlinks feature sub-barrel. What survived the Connect retirement (#1152):
 * the presentational "what links here" panel, with the graph it used to sit
 * next to removed. Pure and injection-only — the host fetches the unified
 * item-link data, resolves copy into `BacklinkViewLabels`, and passes both in.
 *
 * The derivation helpers that used to sit beside it (`backlinkSourceIds` /
 * `resolveLinkId`) are NOT components, so they moved to
 * `shared/src/utils/itemLinks.ts` instead of here.
 *
 * The global components/index.ts re-exports this with `export *`.
 */
export { BacklinkView } from "./BacklinkView";
export type {
  BacklinkEntry,
  BacklinkNode,
  BacklinkNodeType,
  BacklinkViewLabels,
} from "./BacklinkView";
