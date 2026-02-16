import { useTranslation, Trans } from "react-i18next";
import { Section, Kbd } from "./shared";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  Quote,
  Minus,
  CheckSquare,
  ChevronRight,
  Table2,
  Lightbulb,
  ImageIcon,
} from "lucide-react";
import type { ComponentType } from "react";

interface CommandInfo {
  nameKey: string;
  icon: ComponentType<{ size?: number }>;
  descKey: string;
}

const SLASH_COMMANDS: CommandInfo[] = [
  {
    nameKey: "tips.editorTab.heading1",
    icon: Heading1,
    descKey: "tips.editorTab.heading1Desc",
  },
  {
    nameKey: "tips.editorTab.heading2",
    icon: Heading2,
    descKey: "tips.editorTab.heading2Desc",
  },
  {
    nameKey: "tips.editorTab.heading3",
    icon: Heading3,
    descKey: "tips.editorTab.heading3Desc",
  },
  {
    nameKey: "tips.editorTab.bulletList",
    icon: List,
    descKey: "tips.editorTab.bulletListDesc",
  },
  {
    nameKey: "tips.editorTab.orderedList",
    icon: ListOrdered,
    descKey: "tips.editorTab.orderedListDesc",
  },
  {
    nameKey: "tips.editorTab.codeBlock",
    icon: Code2,
    descKey: "tips.editorTab.codeBlockDesc",
  },
  {
    nameKey: "tips.editorTab.blockquote",
    icon: Quote,
    descKey: "tips.editorTab.blockquoteDesc",
  },
  {
    nameKey: "tips.editorTab.horizontalRule",
    icon: Minus,
    descKey: "tips.editorTab.horizontalRuleDesc",
  },
  {
    nameKey: "tips.editorTab.taskList",
    icon: CheckSquare,
    descKey: "tips.editorTab.taskListDesc",
  },
  {
    nameKey: "tips.editorTab.toggleList",
    icon: ChevronRight,
    descKey: "tips.editorTab.toggleListDesc",
  },
  {
    nameKey: "tips.editorTab.table",
    icon: Table2,
    descKey: "tips.editorTab.tableDesc",
  },
  {
    nameKey: "tips.editorTab.callout",
    icon: Lightbulb,
    descKey: "tips.editorTab.calloutDesc",
  },
  {
    nameKey: "tips.editorTab.image",
    icon: ImageIcon,
    descKey: "tips.editorTab.imageDesc",
  },
];

const FORMAT_HINTS = [
  { syntax: "**bold**", resultKey: "tips.editorTab.bold" },
  { syntax: "*italic*", resultKey: "tips.editorTab.italic" },
  { syntax: "`code`", resultKey: "tips.editorTab.inlineCode" },
  { syntax: "~~strike~~", resultKey: "tips.editorTab.strikethrough" },
  { syntax: "---", resultKey: "tips.editorTab.horizontalRuleMd" },
  { syntax: "> quote", resultKey: "tips.editorTab.blockquoteMd" },
  { syntax: "```", resultKey: "tips.editorTab.codeBlockMd" },
];

export function EditorTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm text-notion-text-secondary">
      <Section title={t("tips.editorTab.slashCommands")}>
        <p className="mb-3">
          <Trans
            i18nKey="tips.editorTab.slashCommandsDesc"
            components={{ kbd: <Kbd /> }}
          />
        </p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-notion-border">
              <th className="text-left py-2 pr-4 text-notion-text font-medium">
                {t("tips.editorTab.command")}
              </th>
              <th className="text-left py-2 text-notion-text font-medium">
                {t("tips.editorTab.description")}
              </th>
            </tr>
          </thead>
          <tbody>
            {SLASH_COMMANDS.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <tr
                  key={cmd.nameKey}
                  className="border-b border-notion-border/50"
                >
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-2 text-notion-text">
                      <Icon size={14} />
                      {t(cmd.nameKey)}
                    </span>
                  </td>
                  <td className="py-2">{t(cmd.descKey)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t("tips.editorTab.markdownShortcuts")}>
        <p className="mb-3">{t("tips.editorTab.markdownShortcutsDesc")}</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-notion-border">
              <th className="text-left py-2 pr-4 text-notion-text font-medium w-40">
                {t("tips.editorTab.syntax")}
              </th>
              <th className="text-left py-2 text-notion-text font-medium">
                {t("tips.editorTab.result")}
              </th>
            </tr>
          </thead>
          <tbody>
            {FORMAT_HINTS.map((hint) => (
              <tr
                key={hint.syntax}
                className="border-b border-notion-border/50"
              >
                <td className="py-2 pr-4">
                  <code className="text-xs bg-notion-hover px-1.5 py-0.5 rounded">
                    {hint.syntax}
                  </code>
                </td>
                <td className="py-2">{t(hint.resultKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
