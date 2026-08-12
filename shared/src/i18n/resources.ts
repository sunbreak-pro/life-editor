import type { ParseKeys } from "i18next";
import type en from "./locales/en.json";

/*
 * The catalog, as a type (#726 — the S8 half of #671 C4).
 *
 * S7 gave the catalog a runtime guard (shared/tests/i18nKeys.test.ts): it
 * scans for literal `t("...")` calls and fails when one names a key en or ja
 * does not have. That leaves the keys a scanner cannot see — the ones held in
 * a constant and passed as a variable (`t(section.labelKey)`), which is how
 * the nav, the shortcut sheet and the settings tabs all address the catalog.
 *
 * Declaring the resources here puts every key in the type system, so those
 * become checkable too: `t` now takes a literal union of the catalog's keys,
 * and any constant feeding it is checked at the point it is DEFINED rather
 * than where it is used. `TranslationKey` below is that union, exported so
 * those constants can be typed with it.
 *
 * en is the source of truth for the shape — ja's parity is the runtime test's
 * job, and typing off en keeps a key that only exists in ja from becoming
 * callable.
 *
 * This module has no runtime side effects; `i18n/index.ts` imports it so a
 * host that loads the singleton also loads the declaration. That import is
 * what carries the types across the package boundary into web's `t`.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

/**
 * Every key the catalog resolves, in `a.b.c` form — the exact argument type
 * `t` accepts. Type a constant that holds a key with this and the constant is
 * checked where it is DEFINED, which is the only place a key reaching `t`
 * through a variable can be checked at all.
 *
 * Taken from i18next's own `ParseKeys` rather than walked out of the JSON by
 * hand, so plural variants keep resolving the way `t` resolves them: the
 * catalog spells them `foo_one` / `foo_other` and call sites pass the bare
 * `foo`.
 */
export type TranslationKey = ParseKeys<"translation">;
