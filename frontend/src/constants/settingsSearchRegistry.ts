export interface SettingsSearchEntry {
  id: string;
  labelKey: string;
  keywords?: string[];
  tab: "general" | "advanced" | "claude" | "shortcuts";
  subTab: string;
  sectionId: string;
}

export const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  // General > Appearance
  {
    id: "appearance",
    labelKey: "settings.appearance",
    keywords: ["theme", "dark", "light", "font", "editor"],
    tab: "general",
    subTab: "appearance",
    sectionId: "appearance",
  },
  // General > Language
  {
    id: "language",
    labelKey: "settings.language",
    keywords: ["english", "japanese", "locale", "i18n"],
    tab: "general",
    subTab: "language",
    sectionId: "language",
  },
  // General > Notifications & Sounds
  {
    id: "notifications",
    labelKey: "notifications.title",
    keywords: ["alert", "sound", "timer", "confetti"],
    tab: "general",
    subTab: "notifications",
    sectionId: "notifications",
  },
  // General > Timer
  {
    id: "timer",
    labelKey: "timerSettings.title",
    keywords: [
      "timer",
      "pomodoro",
      "work",
      "break",
      "session",
      "duration",
      "focus",
    ],
    tab: "general",
    subTab: "timer",
    sectionId: "timer",
  },
  // Advanced > Mobile Access
  {
    id: "mobile",
    labelKey: "settings.mobileAccess.title",
    keywords: ["mobile", "phone", "remote", "http", "server"],
    tab: "advanced",
    subTab: "mobile",
    sectionId: "mobile",
  },
  // Advanced > Data Management
  {
    id: "data",
    labelKey: "data.title",
    keywords: ["export", "import", "backup", "reset", "trash"],
    tab: "advanced",
    subTab: "data",
    sectionId: "data",
  },
  // Advanced > Updates
  {
    id: "updates",
    labelKey: "updates.title",
    keywords: ["update", "version", "download"],
    tab: "advanced",
    subTab: "updates",
    sectionId: "updates",
  },
  // Advanced > Developer Tools
  {
    id: "devtools",
    labelKey: "settings.developerTools",
    keywords: [
      "performance",
      "memory",
      "ipc",
      "metrics",
      "monitor",
      "log",
      "error",
      "debug",
    ],
    tab: "advanced",
    subTab: "devtools",
    sectionId: "devtools",
  },
  // Claude > Setup
  {
    id: "claude-setup",
    labelKey: "settings.claude.setup",
    keywords: ["mcp", "register", "claude", "ai"],
    tab: "claude",
    subTab: "setup",
    sectionId: "claude-setup",
  },
  // Claude > MCP Tools
  {
    id: "claude-mcpTools",
    labelKey: "settings.claude.mcpTools",
    keywords: ["mcp", "tools", "api"],
    tab: "claude",
    subTab: "mcpTools",
    sectionId: "claude-mcpTools",
  },
  // Claude > CLAUDE.md
  {
    id: "claude-claudeMd",
    labelKey: "settings.claude.claudeMd",
    keywords: ["claude", "markdown", "instructions"],
    tab: "claude",
    subTab: "claudeMd",
    sectionId: "claude-claudeMd",
  },
  // Claude > Skills
  {
    id: "claude-skills",
    labelKey: "settings.claude.skills",
    keywords: ["skills", "plugins"],
    tab: "claude",
    subTab: "skills",
    sectionId: "claude-skills",
  },
  // General > Behaviors
  {
    id: "behaviors",
    labelKey: "settings.behaviors",
    keywords: [
      "startup",
      "default",
      "folder",
      "archive",
      "completed",
      "auto",
      "priority",
      "behavior",
    ],
    tab: "general",
    subTab: "behaviors",
    sectionId: "behaviors",
  },
  // Advanced > System
  {
    id: "system",
    labelKey: "settings.system",
    keywords: [
      "auto launch",
      "startup",
      "tray",
      "minimize",
      "global shortcut",
      "system",
    ],
    tab: "advanced",
    subTab: "system",
    sectionId: "system",
  },
  // Shortcuts categories
  {
    id: "shortcuts-global",
    labelKey: "tips.shortcutsTab.global",
    keywords: ["shortcut", "keyboard", "hotkey", "global"],
    tab: "shortcuts",
    subTab: "global",
    sectionId: "shortcuts-global",
  },
  {
    id: "shortcuts-navigation",
    labelKey: "tips.shortcutsTab.navigation",
    keywords: ["navigate", "go to"],
    tab: "shortcuts",
    subTab: "navigation",
    sectionId: "shortcuts-navigation",
  },
  {
    id: "shortcuts-layout",
    labelKey: "tips.shortcutsTab.view",
    keywords: ["sidebar", "layout", "view"],
    tab: "shortcuts",
    subTab: "layout",
    sectionId: "shortcuts-layout",
  },
  {
    id: "shortcuts-terminal",
    labelKey: "tips.shortcutsTab.terminal",
    keywords: ["terminal", "split", "tab"],
    tab: "shortcuts",
    subTab: "terminal",
    sectionId: "shortcuts-terminal",
  },
  {
    id: "shortcuts-taskTree",
    labelKey: "tips.shortcutsTab.taskTree",
    keywords: ["task", "tree", "indent"],
    tab: "shortcuts",
    subTab: "taskTree",
    sectionId: "shortcuts-taskTree",
  },
  {
    id: "shortcuts-calendar",
    labelKey: "tips.shortcutsTab.calendar",
    keywords: ["calendar", "schedule", "date"],
    tab: "shortcuts",
    subTab: "calendar",
    sectionId: "shortcuts-calendar",
  },
];
