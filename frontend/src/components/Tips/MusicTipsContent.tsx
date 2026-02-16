import { useTranslation, Trans } from "react-i18next";
import { Section, Strong } from "./shared";

export function MusicTipsContent() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.musicTab.sounds")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.musicTab.soundsList1")}</li>
          <li>{t("tips.musicTab.soundsList2")}</li>
          <li>{t("tips.musicTab.soundsList3")}</li>
          <li>{t("tips.musicTab.soundsList4")}</li>
        </ul>
      </Section>

      <Section title={t("tips.musicTab.playlists")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.musicTab.playlistsList1")}</li>
          <li>{t("tips.musicTab.playlistsList2")}</li>
          <li>
            <Trans
              i18nKey="tips.musicTab.playlistsList3"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.musicTab.playlistsList4")}</li>
        </ul>
      </Section>

      <Section title={t("tips.musicTab.tags")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.musicTab.tagsList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.musicTab.tagsList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.musicTab.customSounds")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t("tips.musicTab.customSoundsList1")}</li>
          <li>{t("tips.musicTab.customSoundsList2")}</li>
        </ul>
      </Section>

      <Section title={t("tips.musicTab.timerPlaylist")}>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <Trans
              i18nKey="tips.musicTab.timerPlaylistList1"
              components={{ strong: <Strong /> }}
            />
          </li>
          <li>{t("tips.musicTab.timerPlaylistList2")}</li>
        </ul>
      </Section>
    </div>
  );
}
