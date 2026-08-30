// TagPill now lives in the parts layer (#1291) — a chip that has to appear
// "everywhere a tag's name does" cannot belong to one host. Re-exported here so
// the surfaces that already reach for it through this barrel keep working while
// the notes filter rebuild (#1288) lands in its own lane.
export { TagPill } from "@life-editor/shared";
export { TagPicker } from "./TagPicker";
export { LinkPanel } from "./LinkPanel";
