import { useTranslation } from "react-i18next";
import { useTheme } from "../../../hooks/useTheme";
import { PillOption, SettingsSection } from "./MobileSettingsPrimitives";

const FONT_PRESETS: Array<{ key: string; label: string; value: number }> = [
  { key: "s", label: "S", value: 3 },
  { key: "m", label: "M", value: 5 },
  { key: "l", label: "L", value: 7 },
  { key: "xl", label: "XL", value: 9 },
];

function nearestPreset(current: number): number {
  let best = FONT_PRESETS[0].value;
  let bestDist = Math.abs(FONT_PRESETS[0].value - current);
  for (const p of FONT_PRESETS) {
    const d = Math.abs(p.value - current);
    if (d < bestDist) {
      best = p.value;
      bestDist = d;
    }
  }
  return best;
}

export function MobileFontSizeSection() {
  const { t } = useTranslation();
  const { fontSize, setFontSize } = useTheme();
  const active = nearestPreset(fontSize);
  return (
    <SettingsSection title={t("mobile.settings.fontSize", "Font size")}>
      <div className="flex gap-2 px-4 py-2.5">
        {FONT_PRESETS.map((p) => (
          <PillOption
            key={p.key}
            label={p.label}
            isActive={active === p.value}
            onClick={() => setFontSize(p.value)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
