import { Terminal, Circle, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClaudeState } from "../../hooks/useClaudeStatus";

interface StatusBarProps {
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  claudeState: ClaudeState;
}

const stateColorMap: Record<ClaudeState, string> = {
  inactive: "text-[#6c7086]",
  idle: "text-green-400",
  thinking: "text-yellow-400",
  generating: "text-blue-400",
  tool_use: "text-purple-400",
  error: "text-red-400",
};

export function StatusBar({
  isTerminalOpen,
  onToggleTerminal,
  claudeState,
}: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className="h-[22px] bg-[#181825] border-t border-[#313244] flex items-center justify-between px-2 text-[11px] text-[#6c7086] select-none shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTerminal}
          className="flex items-center gap-1 hover:text-[#cdd6f4] transition-colors"
        >
          <Terminal size={12} />
          <span>{t("statusBar.terminal")}</span>
          {isTerminalOpen && (
            <span className="text-[10px] opacity-60">
              ({t("statusBar.open")})
            </span>
          )}
        </button>
        {claudeState !== "inactive" && (
          <div className="flex items-center gap-1">
            <Circle
              size={8}
              className={`fill-current ${stateColorMap[claudeState]}`}
            />
            <span className={stateColorMap[claudeState]}>
              {t(`statusBar.claude.${claudeState}`)}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Server size={10} />
        <span>{t("statusBar.mcpServer")}</span>
      </div>
    </div>
  );
}
