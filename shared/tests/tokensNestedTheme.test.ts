import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #887 — a nested `data-theme` subtree must re-resolve the lumen-* layer.
 *
 * Tailwind emits the `@theme` aliases onto `:root`, and a custom property's
 * own `var()` is substituted where it is DECLARED — so the lumen-* colors
 * freeze to the root theme and are inherited unchanged. ThemePreviewCard's
 * fixed-theme miniatures therefore painted in the app's current theme and the
 * light / dark / system cards looked identical.
 *
 * jsdom does not resolve custom properties, so the fix cannot be verified as
 * runtime behavior here (same constraint as the #827 scrollbar test). This
 * pins the tokens.css declarations instead: drop the `[data-theme]` alias
 * block and the cards silently go identical again, which no other gate would
 * catch.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

/** The `[data-theme] { … }` alias block, matching both themes at once. */
const aliasBlock = /\[data-theme\]\s*\{([^}]*)\}/.exec(css);

/** Every lumen-* color ThemePreviewCard paints inside a fixed-theme mock. */
const MINIATURE_TOKENS = [
  ["--color-lumen-bg", "--color-bg-primary"],
  ["--color-lumen-bg-subsidebar", "--color-bg-subsidebar"],
  ["--color-lumen-surface-sunken", "--color-surface-sunken"],
  ["--color-lumen-border", "--color-border"],
  ["--color-lumen-accent", "--color-accent"],
  ["--color-lumen-accent-subtle", "--color-accent-subtle"],
] as const;

describe("tokens.css nested-theme aliases (#887)", () => {
  it("re-declares the aliases on the bare [data-theme] attribute", () => {
    // A bare attribute selector is what makes the block cover BOTH themes;
    // scoping it to one value would leave the other frozen to the root.
    expect(aliasBlock).not.toBeNull();
  });

  it.each(MINIATURE_TOKENS)("re-resolves %s per subtree", (alias, source) => {
    expect(aliasBlock![1]).toContain(`${alias}: var(${source})`);
  });

  it.each(MINIATURE_TOKENS)(
    "defines %s's source in both theme scopes",
    (_alias, source) => {
      // The alias only re-resolves if the underlying --color-* is declared in
      // each scope; a token missing from one side would fall back to inherit.
      const dark = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);
      const light = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/.exec(
        css,
      );
      expect(dark![1]).toContain(`${source}:`);
      expect(light![1]).toContain(`${source}:`);
    },
  );

  it("aliases through a var(), never a copied color value", () => {
    // Copying hex values into this block would let the two definitions drift
    // (rules/frontend.md §デザイン規約: no hardcoded colors).
    const declarations = aliasBlock![1]
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      expect(declaration).toMatch(/^--[\w-]+:\s*var\(--[\w-]+\)$/);
    }
  });
});
