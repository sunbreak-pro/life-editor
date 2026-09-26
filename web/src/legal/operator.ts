/*
 * Who runs the service, as one record (#1198).
 *
 * Both documents, in both languages, quote these three facts — and they are
 * the part a reader checks first and the part that is worst to get wrong. One
 * record means a change lands in all four places at once.
 *
 * The name and the contact channel are public already (the repository is
 * public), which is why a personal email address is deliberately NOT here: a
 * policy page is scraped, and an address on it becomes spam. The GitHub issue
 * tracker is a contact channel the owner already watches.
 *
 * The storage region is named in legalContent §4: AWS ap-northeast-1
 * (Tokyo). D-20260829-web-2 settled it on 2026-08-30, backed by measurement
 * (the project's db host resolves into AWS's Tokyo IPv6 range; three
 * independent sources agree). A policy that names the wrong region is worse
 * than one that names none, so if the project ever migrates, §4 of both
 * documents must move with it.
 *
 * #1989 added the help dialog (Settings + the sign-in screen), which reads
 * its contact links from here too — so the terms and the dialog can never
 * name two different places.
 */

/**
 * A way to reach the operator that does not need a GitHub account (#1989).
 * `email` becomes a `mailto:` link; `form` is opened as a web page.
 */
export interface OperatorDirectContact {
  kind: "email" | "form";
  /** The address without `mailto:`, or the form's https URL. */
  value: string;
}

/**
 * 🛑 The owner's choice (#1989 Gate): an email address or a form URL. While
 * this is `null` the help dialog offers GitHub Issues alone. Filling it in
 * makes the dialog offer it first, in Settings and on the sign-in screen at
 * once; the policy and the terms keep quoting `contactUrl` until their text
 * is changed on purpose.
 */
// Cast rather than annotated: an annotated `const` is narrowed to `null`
// at every use, which would type the slot as permanently empty.
const DIRECT_CONTACT = null as OperatorDirectContact | null;

export const OPERATOR = {
  /** Public handle of the individual running the service. */
  name: "sunbreak-pro",
  /** Where enquiries and deletion requests are received. */
  contactUrl: "https://github.com/sunbreak-pro/life-editor/issues",
  /** The non-GitHub contact, or null until one is chosen. */
  directContact: DIRECT_CONTACT,
} as const;

/** One link in the help dialog's contact list. */
export interface OperatorContactLink {
  id: "direct" | "github";
  kind: "email" | "form" | "github";
  href: string;
}

/**
 * The contact links the help dialog shows, in the order it shows them: the
 * one that needs no account first, GitHub after it. Takes the record as a
 * parameter so the suite can check the filled-in slot without editing it.
 */
export function operatorContactLinks(
  operator: {
    contactUrl: string;
    directContact: OperatorDirectContact | null;
  } = OPERATOR,
): OperatorContactLink[] {
  const links: OperatorContactLink[] = [];
  const direct = operator.directContact;
  if (direct) {
    links.push({
      id: "direct",
      kind: direct.kind,
      href: direct.kind === "email" ? `mailto:${direct.value}` : direct.value,
    });
  }
  links.push({ id: "github", kind: "github", href: operator.contactUrl });
  return links;
}
