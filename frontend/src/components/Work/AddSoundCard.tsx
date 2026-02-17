import { useRef, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

interface AddSoundCardProps {
  onAddSound: (file: File) => Promise<{ error?: string }>;
}

export function AddSoundCard({ onAddSound }: AddSoundCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const result = await onAddSound(file);
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-notion-border hover:border-notion-text-secondary transition-colors cursor-pointer min-h-[100px]"
      >
        {isUploading ? (
          <Loader2 size={24} className="text-notion-text-secondary animate-spin" />
        ) : (
          <Plus size={24} className="text-notion-text-secondary" />
        )}
        <span className="text-xs font-medium text-notion-text-secondary">
          {isUploading ? 'Loading...' : 'Add Sound'}
        </span>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3,.mp3,.wav,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
