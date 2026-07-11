// Notes (life-tags unification S1) — pure tag-heading grouping for the Notes
// side list. UI-free: the interactive list + DnD glue stay host-side (web),
// this sub-barrel only exposes the pure grouping + its types (§6.4).
export {
  buildTagGroups,
  type NoteTagGroup,
  type BuildTagGroupsInput,
} from "./buildTagGroups";
