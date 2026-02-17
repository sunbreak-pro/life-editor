import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-notion-text-secondary gap-4">
      <FileText size={48} strokeWidth={1} />
      <p className="text-sm">{t('taskDetail.emptyState')}</p>
    </div>
  );
}
