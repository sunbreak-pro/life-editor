import type { Template } from "../../types/template";
import { tauriInvoke } from "../bridge";

export const templatesApi = {
  fetchAllTemplates(): Promise<Template[]> {
    return tauriInvoke("db_templates_fetch_all");
  },
  fetchTemplateById(id: string): Promise<Template | undefined> {
    return tauriInvoke("db_templates_fetch_by_id", { id });
  },
  createTemplate(id: string, name: string): Promise<Template> {
    return tauriInvoke("db_templates_create", { id, name });
  },
  updateTemplate(
    id: string,
    updates: { name?: string; content?: string },
  ): Promise<Template> {
    return tauriInvoke("db_templates_update", { id, updates });
  },
  softDeleteTemplate(id: string): Promise<void> {
    return tauriInvoke("db_templates_soft_delete", { id });
  },
  permanentDeleteTemplate(id: string): Promise<void> {
    return tauriInvoke("db_templates_permanent_delete", { id });
  },
};
