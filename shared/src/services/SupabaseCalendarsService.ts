import { type SupabaseClient } from "@supabase/supabase-js";
import type {
  CalendarsDataService,
} from "./DataService";
import type { CalendarNode } from "../types/calendar";
import {
  CALENDAR_SELECT_COLUMNS,
  rowToCalendar,
  calendarUpdatesToPatch,
  type CalendarRow,
} from "./calendarMapper";
import { fetchAllPages } from "./postgrestFetchAll";

/*
 * Calendars domain (S4-2). VERSIONED but PHYSICAL-delete (0006 omits
 * is_deleted — the frontend never soft-deletes a calendar). 1:1 port of
 * the retired Tauri calendar_repository.rs (removed 2026-07-11, see tag
 * `pre-tauri-removal`).
 *
 * PARITY DIVERGENCE (documented, not silent): the Rust `update` accepted
 * the bind column too, but the S4-1 QA-passed `calendarUpdatesToPatch`
 * whitelist (the contract per the "frontend type is the SSOT" S2/S3
 * rule) only exposes title/order. The DataService interface's
 * `updateCalendar` signature also only accepts title/tagId/order;
 * tagId in `updates` is therefore accepted by the type but dropped
 * by the patch builder. This matches the mapper SSOT; a calendar is
 * rebound to a new life-tag by recreation in current UI flows. Flagged
 * for QA. (life-tags S2 / 0021: the bind column is now tag_id ->
 * wiki_tags(id), was folder_id -> items_meta(id).)
 */
export class SupabaseCalendarsService implements CalendarsDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_all`: ORDER BY "order" ASC, created_at ASC. */
  async fetchCalendars(): Promise<CalendarNode[]> {
    const rows = await fetchAllPages<CalendarRow>(
      (from, to) =>
        this.client
          .from("calendars")
          .select(CALENDAR_SELECT_COLUMNS)
          .order("order", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id")
          .range(from, to),
      "fetchCalendars failed",
    );
    return rows.map(rowToCalendar);
  }

  /**
   * Tauri `create`: `"order"` = next_order (MAX+1), version default 1.
   * `tagId` references wiki_tags(id) (the 0021 FK) — a calendar is a
   * life-tag-scoped view. `user_id` RLS-derived.
   */
  async createCalendar(
    id: string,
    title: string,
    tagId: string,
  ): Promise<CalendarNode> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      id,
      title,
      tag_id: tagId,
      order: nextOrder,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    const { data, error } = await this.client
      .from("calendars")
      .insert(payload)
      .select(CALENDAR_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createCalendar failed: ${error.message}`);
    return rowToCalendar(data as unknown as CalendarRow);
  }

  /**
   * Tauri `update`: whitelisted columns (calendarUpdatesToPatch =
   * title/order; see class header re tagId divergence). Empty patch
   * = re-read NO version bump. Otherwise version + 1 (read-then-written)
   * + updated_at.
   */
  async updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "tagId" | "order">>,
  ): Promise<CalendarNode> {
    const patch = calendarUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("calendars")
        .select(CALENDAR_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateCalendar failed: ${error.message}`);
      return rowToCalendar(data as unknown as CalendarRow);
    }
    const next = await this.nextVersion(id, "updateCalendar");
    const { data, error } = await this.client
      .from("calendars")
      .update({
        ...patch,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CALENDAR_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateCalendar failed: ${error.message}`);
    return rowToCalendar(data as unknown as CalendarRow);
  }

  /** Tauri `delete`: physical DELETE by id (no soft-delete column). */
  async deleteCalendar(id: string): Promise<void> {
    const { error } = await this.client.from("calendars").delete().eq("id", id);
    if (error) throw new Error(`deleteCalendar failed: ${error.message}`);
  }

  private async nextOrder(): Promise<number> {
    const { data, error } = await this.client
      .from("calendars")
      .select('"order"')
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`createCalendar failed: ${error.message}`);
    const max = (data as { order: number } | null)?.order;
    return (max ?? -1) + 1;
  }

  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("calendars")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }
}

export const PHASE2_CALENDAR_METHOD_NAMES = [
  "fetchCalendars",
  "createCalendar",
  "updateCalendar",
  "deleteCalendar",
] as const;

export type CalendarMethodName = (typeof PHASE2_CALENDAR_METHOD_NAMES)[number];

export const PHASE2_CALENDAR_METHODS: ReadonlySet<string> = new Set(PHASE2_CALENDAR_METHOD_NAMES);
