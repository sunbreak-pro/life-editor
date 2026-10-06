import { useTranslation } from "@life-editor/shared";

/*
 * Connect's "tags N / items N" (D1 / #1643), beside the header's tab band.
 *
 * It used to be the SectionHeader subtitle, which a tab band replaces along
 * with the title (#2108, plan Risks), so the totals moved to the band's
 * trailing slot. Renders nothing while there is nothing to report — before
 * the hub's first load, and while the Goals tab has the hub unmounted.
 */
export function ConnectHeaderCounts({
  counts,
}: {
  counts: { tags: number; items: number } | null;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!counts) return null;
  return (
    <span className="whitespace-nowrap text-xs tabular-nums text-lumen-text-tertiary">
      {t("connect.headerCounts", counts)}
    </span>
  );
}
