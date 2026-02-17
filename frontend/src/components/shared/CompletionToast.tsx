import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

interface CompletionToastProps {
  taskName: string;
  onDismiss: () => void;
}

export function CompletionToast({ taskName, onDismiss }: CompletionToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), 1700);
    const dismissTimer = setTimeout(onDismiss, 2000);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return createPortal(
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-notion-accent text-white shadow-lg ${
          isExiting ? 'toast-exit' : 'toast-enter'
        }`}
      >
        <CheckCircle2 size={16} />
        <span className="text-sm font-medium">{taskName}</span>
      </div>
    </div>,
    document.body,
  );
}
