// Catppuccin Mocha palette — single source of truth for prototype colors.
// Previously duplicated as `const C` across every screen; consolidated here
// per IA v3 eval (13_design_information-architecture-v3-eval.md §5).
export const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  overlay1: "#7f849c",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  sky: "#89dceb",
  blue: "#89b4fa",
  red: "#f38ba8",
  lavender: "#b4befe",
  teal: "#94e2d5",
  maroon: "#eba0ac",
  flamingo: "#f2cdcd",
  rosewater: "#f5e0dc",
} as const;

export type ColorToken = keyof typeof C;
