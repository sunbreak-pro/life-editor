import { useState, useEffect, useCallback, useRef } from "react";
import { getDataService } from "../services/dataServiceFactory";
import { generateId } from "../utils/generateId";
import { logServiceError } from "../utils/logError";
import type { Template } from "../types/template";

const SETTING_KEY_NOTE = "default_template_note";
const SETTING_KEY_DAILY = "default_template_daily";

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [defaultNoteTemplateId, setDefaultNoteTemplateIdState] = useState<
    string | null
  >(null);
  const [defaultDailyTemplateId, setDefaultDailyTemplateIdState] = useState<
    string | null
  >(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const ds = getDataService();
    Promise.all([
      ds.fetchAllTemplates(),
      ds.getAppSetting(SETTING_KEY_NOTE),
      ds.getAppSetting(SETTING_KEY_DAILY),
    ])
      .then(([tmpl, noteId, dailyId]) => {
        setTemplates(tmpl);
        setDefaultNoteTemplateIdState(noteId);
        setDefaultDailyTemplateIdState(dailyId);
        setIsLoaded(true);
      })
      .catch((e) => logServiceError("Templates", "load", e));
  }, []);

  const createTemplate = useCallback((name: string): string => {
    const id = generateId("tmpl");
    const now = new Date().toISOString();
    const newTemplate: Template = {
      id,
      name,
      content: "",
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    setTemplates((prev) => [...prev, newTemplate]);
    getDataService()
      .createTemplate(id, name)
      .catch((e) => logServiceError("Templates", "create", e));
    return id;
  }, []);

  const updateTemplate = useCallback(
    (id: string, updates: { name?: string; content?: string }) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
      getDataService()
        .updateTemplate(id, updates)
        .catch((e) => logServiceError("Templates", "update", e));
    },
    [],
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      getDataService()
        .softDeleteTemplate(id)
        .catch((e) => logServiceError("Templates", "delete", e));

      // Clear default if deleted template was the default
      if (defaultNoteTemplateId === id) {
        setDefaultNoteTemplateIdState(null);
        getDataService()
          .removeAppSetting(SETTING_KEY_NOTE)
          .catch((e) => logServiceError("Templates", "clearDefaultNote", e));
      }
      if (defaultDailyTemplateId === id) {
        setDefaultDailyTemplateIdState(null);
        getDataService()
          .removeAppSetting(SETTING_KEY_DAILY)
          .catch((e) => logServiceError("Templates", "clearDefaultDaily", e));
      }
    },
    [defaultNoteTemplateId, defaultDailyTemplateId],
  );

  const setDefaultNoteTemplate = useCallback((id: string | null) => {
    setDefaultNoteTemplateIdState(id);
    if (id) {
      getDataService()
        .setAppSetting(SETTING_KEY_NOTE, id)
        .catch((e) => logServiceError("Templates", "setDefaultNote", e));
    } else {
      getDataService()
        .removeAppSetting(SETTING_KEY_NOTE)
        .catch((e) => logServiceError("Templates", "clearDefaultNote", e));
    }
  }, []);

  const setDefaultDailyTemplate = useCallback((id: string | null) => {
    setDefaultDailyTemplateIdState(id);
    if (id) {
      getDataService()
        .setAppSetting(SETTING_KEY_DAILY, id)
        .catch((e) => logServiceError("Templates", "setDefaultDaily", e));
    } else {
      getDataService()
        .removeAppSetting(SETTING_KEY_DAILY)
        .catch((e) => logServiceError("Templates", "clearDefaultDaily", e));
    }
  }, []);

  const getDefaultNoteContent = useCallback((): string => {
    if (!defaultNoteTemplateId) return "";
    const tmpl = templates.find((t) => t.id === defaultNoteTemplateId);
    return tmpl?.content ?? "";
  }, [defaultNoteTemplateId, templates]);

  const getDefaultDailyContent = useCallback((): string => {
    if (!defaultDailyTemplateId) return "";
    const tmpl = templates.find((t) => t.id === defaultDailyTemplateId);
    return tmpl?.content ?? "";
  }, [defaultDailyTemplateId, templates]);

  return {
    templates,
    isLoaded,
    defaultNoteTemplateId,
    defaultDailyTemplateId,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultNoteTemplate,
    setDefaultDailyTemplate,
    getDefaultNoteContent,
    getDefaultDailyContent,
  };
}
