import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";

/*
 * NoticePanel (#1184) — the one in-place band for a warning, a notice or a
 * refusal that stays ON the screen it belongs to.
 *
 * It is the non-modal half of a pair, and the split is by who owns the next
 * move. <ConfirmDialog> (#707) takes the page away to ask a question nothing
 * can proceed without; NoticePanel reports something the user can read past —
 * a failed submit, a filter that is hiding rows, an offline connection. Ask
 * with the dialog, tell with the panel.
 *
 * It exists because "tell" had been re-invented per screen: a bordered band
 * with an icon on the auth cards, the same band without an icon in the notes
 * sidebar, a bare red <p> in two dialogs, a full-width strip for offline, and
 * an accent-tinted box with its own hand-rolled button in the schedule
 * sidebar. Same job, five paddings, four roles, three ideas about whether a
 * glyph belongs there. The inventory and the sites still to move are on #1184.
 *
 * Tones are ToastVariant's four, deliberately — a message that arrives as a
 * toast and the same message shown in place should not be different colors.
 *
 * Pure presentation (§3.1 / §6.4): every string arrives already translated,
 * the action is a callback, lumen-* tokens only, and the surface is opaque
 * (§5) because each tone's `-subtle` face is a flat pre-mixed color rather
 * than an alpha overlay.
 */

export type NoticeTone = "info" | "success" | "warning" | "danger";

/**
 * Inset card inside a column, a full-bleed strip across a surface, or bare
 * tone-colored copy for a container too tight to carry a band at all (#1278).
 */
export type NoticeVariant = "card" | "banner" | "text";

/** Body size. Default "sm"; "xs" is for dense chip rows. */
export type NoticeSize = "sm" | "xs";

export interface NoticeAction {
  /** Already-translated label. */
  label: string;
  onClick: () => void;
}

export interface NoticePanelProps {
  /** Already-translated body copy (props-injected i18n, §6.4). */
  message: ReactNode;
  /** Semantic tone. Default "info". */
  tone?: NoticeTone;
  /** Already-translated heading above the message. */
  title?: string;
  /**
   * Replaces the tone's default glyph. Pass `null` for no glyph at all — the
   * tone still reads from the border and the text color, so a band that is
   * one line of text in a dense list does not need the extra 16px.
   */
  icon?: ReactNode | null;
  /** The single "…and here is what to do about it" affordance. */
  action?: NoticeAction;
  /**
   * Layout. Default "card". "text" drops the border, the fill and the padding
   * and keeps only the tone color plus the live region — `title`, `icon` and
   * `action` are not drawn in that variant.
   */
  variant?: NoticeVariant;
  /**
   * Body size. Default "sm". A prop rather than a `className` because `cn` is
   * plain concatenation, not tailwind-merge: a caller-supplied `text-xs` still
   * loses to the base `text-sm` on CSS source order (rules/frontend.md
   * §Gotchas — the same trap that drew an 860px panel at 448px in #830).
   */
  size?: NoticeSize;
  /**
   * Overrides the tone-derived live-region role. The default follows Toast:
   * danger / warning interrupt (`alert`), info / success are polite
   * (`status`). Pass "status" for a danger band that is part of the page
   * rather than the answer to something the user just did, and "alert" for a
   * success that IS that answer (the auth surfaces do the latter).
   */
  role?: "alert" | "status";
  /**
   * DOM id for the message node, so the field that just failed can point its
   * `aria-describedby` at it (NotePasswordDialog's two inputs do exactly that).
   */
  id?: string;
  className?: string;
}

/*
 * One static class string per tone, looked up rather than string-built: a
 * dynamic `border-lumen-${tone}` is invisible to Tailwind's scanner and the
 * utility would never be emitted, which shows up as a transparent band rather
 * than as an error (§7 silent-transparent-fail — the same trap Toast's TONE_BG
 * map documents).
 */
const TONE_SURFACE: Record<NoticeTone, string> = {
  info: "border-lumen-info bg-lumen-info-subtle",
  success: "border-lumen-success bg-lumen-success-subtle",
  warning: "border-lumen-warning bg-lumen-warning-subtle",
  danger: "border-lumen-danger bg-lumen-danger-subtle",
};

const TONE_TEXT: Record<NoticeTone, string> = {
  info: "text-lumen-info",
  success: "text-lumen-success",
  warning: "text-lumen-warning",
  danger: "text-lumen-danger",
};

/* Looked up, not string-built, for the same scanner reason as TONE_SURFACE. */
const SIZE_TEXT: Record<NoticeSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

const TONE_ICON: Record<NoticeTone, ReactNode> = {
  info: <Info aria-hidden />,
  success: <CircleCheck aria-hidden />,
  warning: <TriangleAlert aria-hidden />,
  danger: <CircleAlert aria-hidden />,
};

export function NoticePanel({
  message,
  tone = "info",
  title,
  icon,
  action,
  variant = "card",
  size = "sm",
  role,
  id,
  className,
}: NoticePanelProps) {
  // Same derivation as Toast, so the two agree on which tones interrupt.
  const resolvedRole =
    role ?? (tone === "danger" || tone === "warning" ? "alert" : "status");
  // `undefined` (not "off") when assertive: aria-live on an alert would
  // re-declare politeness the role already implies.
  const ariaLive = resolvedRole === "status" ? "polite" : undefined;
  // `icon === null` is "no glyph"; `undefined` is "use the tone's".
  const glyph = icon === undefined ? TONE_ICON[tone] : icon;

  /*
   * The text variant (#1278) is this same message with the band taken away:
   * one line of tone-colored copy under the control it is complaining about.
   * It exists because three in-form errors live in containers where a
   * bordered, filled, padded band outweighs the field it belongs to — a small
   * modal that already carries a danger-tinted title glyph, and a chip row.
   *
   * Leaving them as bare `<p className="text-lumen-danger">` was the
   * per-screen re-invention #1184 set out to end, and routing them here buys
   * the one thing every hand-rolled copy kept typing out by hand: the
   * live-region role is DERIVED from the tone instead of chosen per site.
   */
  if (variant === "text") {
    return (
      <p
        id={id}
        role={resolvedRole}
        aria-live={ariaLive}
        className={cn(
          "leading-normal",
          SIZE_TEXT[size],
          TONE_TEXT[tone],
          className,
        )}
      >
        {message}
      </p>
    );
  }

  return (
    <div
      id={id}
      role={resolvedRole}
      aria-live={ariaLive}
      className={cn(
        "flex items-start gap-2",
        SIZE_TEXT[size],
        variant === "banner"
          ? // A strip owns the full width of its host and only draws the edge
            // it sits against, so it reads as part of the chrome.
            "w-full justify-center border-b px-4 py-2 text-center"
          : "rounded-lumen-md border px-3 py-2.5",
        TONE_SURFACE[tone],
        className,
      )}
    >
      {glyph ? (
        <span
          className={cn(
            "mt-0.5 grid shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4",
            // A centered strip has no second line to align a glyph against.
            variant === "banner" ? "mt-0" : null,
            TONE_TEXT[tone],
          )}
        >
          {glyph}
        </span>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1.5",
          variant === "banner" ? null : "flex-1",
        )}
      >
        {title ? (
          <span className={cn("font-semibold leading-normal", TONE_TEXT[tone])}>
            {title}
          </span>
        ) : null}
        {/* The body stays in the tone's color only when it is the whole
            message; under a heading it drops to normal text so a paragraph of
            explanation is not painted red end to end. */}
        <span
          className={cn(
            "leading-normal",
            title ? "text-lumen-text" : TONE_TEXT[tone],
          )}
        >
          {message}
        </span>
        {action ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
