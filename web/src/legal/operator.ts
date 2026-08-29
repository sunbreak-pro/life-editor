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
 * The storage region is stated as "outside Japan" rather than as a region
 * name. That is true of both a US and an EU Supabase project, and a policy
 * that names the wrong country is worse than one that names none — the exact
 * region is queued for the owner to confirm (D-20260829-web-2).
 */
export const OPERATOR = {
  /** Public handle of the individual running the service. */
  name: "sunbreak-pro",
  /** Where enquiries and deletion requests are received. */
  contactUrl: "https://github.com/sunbreak-pro/life-editor/issues",
} as const;
