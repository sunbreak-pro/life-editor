import type { LucideIcon } from "lucide-react";
import {
  Lightbulb,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Star,
  Heart,
  Flame,
  Zap,
  BookOpen,
  FileText,
  Pencil,
  Clock,
  Calendar,
  Tag,
  Bookmark,
  Bell,
  MessageCircle,
  Search,
  Settings,
  User,
  Users,
  Globe,
  Link,
  Lock,
  Folder,
  Archive,
  Trash2,
  Download,
  Upload,
} from "lucide-react";

// Frequently-used icon subset (avoids full lucide bundle ~200KB gzip)
const ICON_SUBSET: Record<string, LucideIcon> = {
  Lightbulb,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Star,
  Heart,
  Flame,
  Zap,
  BookOpen,
  FileText,
  Pencil,
  Clock,
  Calendar,
  Tag,
  Bookmark,
  Bell,
  MessageCircle,
  Search,
  Settings,
  User,
  Users,
  Globe,
  Link,
  Lock,
  Folder,
  Archive,
  Trash2,
  Download,
  Upload,
};

let fullIconMap: Record<string, LucideIcon> | null = null;

export function getDynamicIcon(name: string): LucideIcon | null {
  if (ICON_SUBSET[name]) return ICON_SUBSET[name];
  if (fullIconMap) return fullIconMap[name] ?? null;
  return ICON_SUBSET.Lightbulb;
}

export function getIconNames(): string[] {
  if (fullIconMap) return Object.keys(fullIconMap);
  return Object.keys(ICON_SUBSET);
}

export async function loadAllIcons(): Promise<string[]> {
  if (fullIconMap) return Object.keys(fullIconMap);
  const { icons } = await import("lucide-react");
  fullIconMap = icons as Record<string, LucideIcon>;
  return Object.keys(fullIconMap);
}
