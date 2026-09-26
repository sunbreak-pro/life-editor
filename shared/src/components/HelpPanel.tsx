import { useId } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "./Button";
import { CARD_BTN_TAP } from "./styleTokens";

export interface HelpFaqItem {
  question: string;
  answer: string;
}

export interface HelpContactItem {
  /** Stable key for the list, and a hook for tests (`data-contact-id`). */
  id: string;
  /** The link's text ("GitHub Issues", "Email"). */
  label: string;
  /** Where it goes: an https URL or a `mailto:`. */
  href: string;
  /** One sentence under the link ("Needs a GitHub account"). */
  note?: string;
}

export interface HelpPanelProps {
  faq: readonly HelpFaqItem[];
  contacts: readonly HelpContactItem[];
  /**
   * Opens the tutorial launcher. Omitted where there is no tour to open —
   * the sign-in screen has no app behind it yet — and the section goes with it.
   */
  onOpenTutorial?: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    tutorialHeading: string;
    tutorialDescription: string;
    tutorialButton: string;
    faqHeading: string;
    contactHeading: string;
    contactDescription: string;
    /** Screen-reader suffix for links that leave the app ("opens in a new tab"). */
    opensExternally: string;
  };
}

const SECTION_HEADING = "text-sm font-semibold text-lumen-text";

const CONTACT_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lumen-sm text-sm font-medium " +
  "text-lumen-accent underline underline-offset-2 hover:text-lumen-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent " +
  "max-md:min-h-11";

/*
 * Help body (#1989): how to use the app, the questions people actually get
 * stuck on, and who to ask when those do not cover it. Shared by the Settings
 * dialog and the sign-in screen's dialog, so a person who cannot sign in reads
 * the same answers as one who can.
 *
 * FAQ entries are native <details>: keyboard, screen reader and "find in page"
 * support come with the element, and nothing here needs to remember which
 * answer is open.
 *
 * Contacts are plain links with target=_blank. In a browser that is a new tab;
 * in the desktop shell the window-open handler hands https and mailto to the
 * OS, so the app window is never navigated away.
 */
export function HelpPanel({
  faq,
  contacts,
  onOpenTutorial,
  labels,
}: HelpPanelProps) {
  // Heading ids for aria-labelledby, unique per mount.
  const id = useId();
  const tutorialId = `${id}-tutorial`;
  const faqId = `${id}-faq`;
  const contactId = `${id}-contact`;
  return (
    <div className="flex flex-col gap-6" data-section-id="help">
      {onOpenTutorial ? (
        <section
          className="flex flex-col gap-2"
          aria-labelledby={tutorialId}
        >
          <h3 id={tutorialId} className={SECTION_HEADING}>
            {labels.tutorialHeading}
          </h3>
          <p className="text-sm text-lumen-text-secondary">
            {labels.tutorialDescription}
          </p>
          <div>
            <Button
              variant="secondary"
              className={CARD_BTN_TAP}
              onClick={() => onOpenTutorial()}
            >
              {labels.tutorialButton}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby={faqId}>
        <h3 id={faqId} className={SECTION_HEADING}>
          {labels.faqHeading}
        </h3>
        <div className="flex flex-col divide-y divide-lumen-border rounded-lumen-md border border-lumen-border">
          {faq.map((item) => (
            <details key={item.question} className="group px-4">
              <summary className="cursor-pointer py-3 text-sm font-medium text-lumen-text max-md:min-h-11">
                {item.question}
              </summary>
              <p className="pb-3 text-sm text-lumen-text-secondary">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby={contactId}>
        <h3 id={contactId} className={SECTION_HEADING}>
          {labels.contactHeading}
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.contactDescription}
        </p>
        <ul className="flex flex-col gap-3">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                data-contact-id={c.id}
                className={CONTACT_LINK_CLASS}
              >
                <span>{c.label}</span>
                <ExternalLink size={14} aria-hidden />
                <span className="sr-only">{labels.opensExternally}</span>
              </a>
              {c.note ? (
                <span className="text-xs text-lumen-text-tertiary">
                  {c.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
