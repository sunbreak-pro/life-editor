import type { DataService } from "../../src/services/DataService";

/*
 * The DataService stub base (#777).
 *
 * Thirty suites were each writing the same last line — `as unknown as
 * DataService` — around a hand-picked set of methods. The cast is unavoidable
 * (a suite stubs the four methods its subject calls, not the whole 620-line
 * interface), but written out thirty times it also switches OFF the one check
 * that was still available: whether those four names exist on DataService at
 * all. A stub keyed on a method that has since been renamed keeps compiling
 * and keeps "passing", because the subject calls the real name, gets
 * undefined, and the suite fails somewhere else entirely — or worse, does not.
 *
 * `stubDataService` puts the cast in one place and takes the KEYS back under
 * the type checker while leaving the VALUES loose:
 *
 *   Partial<Record<keyof DataService, unknown>>
 *            ^ names are checked          ^ shapes are not
 *
 * Loose values are deliberate, not laziness. Suites routinely hand back a
 * three-field object where the real signature returns a full TodoNode,
 * because the subject only reads `id` / `title` / `isDeleted`. Demanding the
 * true return type there would force every suite to build nodes it never
 * looks at — which is the duplication this helper exists to remove.
 *
 * Naming: the per-suite factories that wrap this are all called `makeDS`.
 * Two other spellings of that same name were in use before #777, and having
 * three names for one idea meant nobody could grep for it. This helper is
 * named differently on purpose, so a suite can import it and still define its
 * own `makeDS` around it.
 */
export function stubDataService(
  methods: Partial<Record<keyof DataService, unknown>> = {},
): DataService {
  return { ...methods } as unknown as DataService;
}
