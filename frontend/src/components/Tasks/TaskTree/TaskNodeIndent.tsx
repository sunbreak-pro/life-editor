interface TaskNodeIndentProps {
  depth: number;
  isLastChild?: boolean;
}

export function TaskNodeIndent({ depth, isLastChild }: TaskNodeIndentProps) {
  if (depth <= 0) return null;

  return (
    <div
      className="flex shrink-0 self-stretch -my-1"
      style={{ width: `${depth * 12}px` }}
    >
      {Array.from({ length: depth }, (_, i) => (
        <div key={i} className="w-5 flex justify-center">
          <div
            className={`w-px bg-notion-text/15 ${
              i === depth - 1 && isLastChild ? "h-1/2 self-start" : "h-full"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
