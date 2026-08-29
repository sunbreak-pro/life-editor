import { ArrowLeft } from "lucide-react";
import type { LegalDocument } from "./legalContent";

export interface LegalViewProps {
  document: LegalDocument;
  /** Already-translated label of the back control. */
  backLabel: string;
  /** Already-translated "last updated" prefix, e.g. "Last updated". */
  updatedLabel: string;
  onBack: () => void;
}

/*
 * Reader for the policy and the terms (#1198).
 *
 * A full-screen page rather than a modal: these are documents people scroll,
 * link to and occasionally print, and a dialog that traps focus fights all
 * three. It is still not a route — the app has no router (CLAUDE.md §3.2) —
 * so AuthScreen swaps it in the same way it swaps its other cards, and the
 * `?legal=` query it keeps in the address bar is what makes a link to it
 * possible.
 *
 * Pure presentation: the document arrives as data and every label as a prop.
 */
export function LegalView({
  document: doc,
  backLabel,
  updatedLabel,
  onBack,
}: LegalViewProps) {
  return (
    <div className="min-h-svh w-full overflow-y-auto bg-lumen-bg text-lumen-text">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 self-start rounded-lumen-sm text-sm text-lumen-text-secondary transition-colors hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {backLabel}
        </button>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-lumen-text">{doc.title}</h1>
          <p className="text-xs text-lumen-text-tertiary">
            {updatedLabel}: {doc.updated}
          </p>
        </header>

        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {doc.intro}
        </p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-lumen-text">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="text-sm leading-relaxed text-lumen-text-secondary"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-sm leading-relaxed break-words text-lumen-text-secondary"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
