/**
 * Tiny classname joiner. Accepts strings, falsy values (skipped), and
 * keeps order stable. Deliberately dependency-free (no clsx) to keep the
 * shared package's dep surface minimal — this is the only class-merge
 * helper the design-system components need.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string | number => Boolean(v)).join(" ");
}
