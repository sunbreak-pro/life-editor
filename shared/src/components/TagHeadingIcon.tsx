/*
 * Tag heading icon (#311 / #364).
 *
 * Renders a wiki_tag's chosen lucide icon — the generic Tag when it has none —
 * tinted with the tag colour. Every tag heading (desktop list + its mobile
 * twin) draws the identical glyph, so it lives here as one component instead of
 * being re-resolved at each call site.
 *
 * WHY createElement and not `const Icon = ...; <Icon />`: a capitalized local
 * assigned during render reads as "component created during render" to
 * react-hooks/static-components, which web's eslint enforces in CI (#364).
 * Resolving straight into createElement keeps the same output without the
 * render-time declaration.
 */

import { createElement } from "react";
import { Tag } from "lucide-react";

import { resolveTagIcon } from "./tagIcon";

export interface TagHeadingIconProps {
  /** Stored lucide icon name, or null → the generic Tag glyph. */
  icon: string | null;
  /** Tag tint; null (untagged / no colour) falls back to the secondary text token. */
  color: string | null;
}

export function TagHeadingIcon({ icon, color }: TagHeadingIconProps) {
  return createElement(resolveTagIcon(icon) ?? Tag, {
    size: 15,
    "aria-hidden": true,
    className: "shrink-0 text-lumen-text-secondary",
    style: color ? { color } : undefined,
  });
}
