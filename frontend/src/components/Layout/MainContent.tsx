import type { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main
      className="flex-1 overflow-auto bg-notion-bg"
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </main>
  );
}
