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
 */
export const OPERATOR = {
  /** Public handle of the individual running the service. */
  name: "sunbreak-pro",
  /** Where enquiries and deletion requests are received. */
  contactUrl: "https://github.com/sunbreak-pro/life-editor/issues",
} as const;
