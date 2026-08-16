/*
 * The tag edit panel (#310 / #409 / #368 / #740 / #715), split out of one
 * 1,050-line file in #896.
 *
 * Only the four names the app barrel already published leave this directory —
 * the two columns, the icon picker, the item list and the draft model are
 * internals of the panel, and a host reaching for one of them directly would be
 * building a second tag editor rather than using this one.
 */
export { TagEditModal } from "./TagEditModal";
export {
  type TagEditModalProps,
  type TagEditModalLabels,
  type TagEditRow,
  type TagEditItem,
} from "./types";
