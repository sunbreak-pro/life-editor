import { EditableTitle } from "../../shared/EditableTitle";

interface TaskNodeEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function TaskNodeEditor({
  initialValue,
  onSave,
  onCancel,
}: TaskNodeEditorProps) {
  return (
    <EditableTitle
      value={initialValue}
      onSave={onSave}
      onCancel={onCancel}
      className="flex-1 bg-transparent outline-none text-[15px] text-notion-text px-1 border-b border-notion-accent"
    />
  );
}
