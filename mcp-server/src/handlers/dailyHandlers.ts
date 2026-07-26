import { getSupabase } from "../supabase.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";
import { contentJsonToString } from "../utils/content.js";
import {
  bumpMeta,
  findMeta,
  insertItem,
  META_COLUMNS,
  type ItemsMetaRow,
} from "../utils/items.js";
import { assertDateKey } from "../utils/localDate.js";
import { fetchAllPages, fetchByIdChunks } from "../utils/pagination.js";

/*
 * Daily handlers — Supabase edition (#360).
 *
 * Legacy `dailies` (dropped by 0007) → items_meta (role='daily') +
 * dailies_payload, where `date` is the natural key (UNIQUE) and the body is
 * `content_json` (jsonb). Id convention: `daily-<YYYY-MM-DD>`, and
 * items_meta.title carries the date — the date IS a daily's identity (same
 * rule as dailiesUnifiedMapper / writeBriefing).
 */

export interface DailiesPayloadRow {
  item_id: string;
  date: string;
  content_json: unknown;
}

/** A live daily: its items_meta row paired with its payload row. */
export interface DailyRecord {
  meta: ItemsMetaRow;
  payload: DailiesPayloadRow;
}

const PAYLOAD_COLUMNS = "item_id, date, content_json";

/**
 * Every live daily, newest date first. Shared with search_all, which has to
 * match bodies in-app because `content_json` is jsonb (no PostgREST ilike).
 */
export async function fetchLiveDailies(): Promise<DailyRecord[]> {
  const { client } = await getSupabase();

  const payloadRows = await fetchAllPages<DailiesPayloadRow>(
    (from, to) =>
      client
        .from("dailies_payload")
        .select(PAYLOAD_COLUMNS)
        .order("date", { ascending: false })
        .order("item_id", { ascending: true })
        .range(from, to),
    "list dailies_payload",
  );
  if (payloadRows.length === 0) return [];

  const metaRows = await fetchByIdChunks<ItemsMetaRow>(
    payloadRows.map((p) => p.item_id),
    async (chunk) => {
      const { data, error } = await client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("role", "daily")
        .eq("is_deleted", false)
        .in("id", chunk);
      if (error) throw new Error(`list daily items_meta: ${error.message}`);
      return (data ?? []) as unknown as ItemsMetaRow[];
    },
  );
  const metaById = new Map<string, ItemsMetaRow>();
  for (const m of metaRows) metaById.set(m.id, m);

  const out: DailyRecord[] = [];
  for (const payload of payloadRows) {
    const meta = metaById.get(payload.item_id);
    if (meta) out.push({ meta, payload }); // trashed dailies drop out here
  }
  return out;
}

/** Payload row for a date, or null. Liveness is checked by the caller. */
export async function findDailyPayload(
  date: string,
): Promise<DailiesPayloadRow | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("dailies_payload")
    .select(PAYLOAD_COLUMNS)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(`dailies_payload read: ${error.message}`);
  return (data as unknown as DailiesPayloadRow | null) ?? null;
}

export async function getDaily(args: { date: string }) {
  const date = assertDateKey(args.date);
  const payload = await findDailyPayload(date);
  if (!payload) return { date, content: null };

  const meta = await findMeta(payload.item_id, "daily");
  if (!meta) return { date, content: null }; // trashed daily reads as empty

  return {
    id: meta.id,
    date: payload.date,
    content: contentJsonToString(payload.content_json),
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

export async function upsertDaily(args: { date: string; content: string }) {
  return upsertDailyContent(
    assertDateKey(args.date),
    markdownToTiptap(args.content),
  );
}

/**
 * Write a TipTap document into a date's daily, creating the item when the
 * date has none yet. Shared with generate_content / format_content, which
 * build the document structurally instead of from markdown.
 */
export async function upsertDailyContent(date: string, contentJson: unknown) {
  const { client } = await getSupabase();

  const existing = await findDailyPayload(date);
  if (existing) {
    const { error } = await client
      .from("dailies_payload")
      .update({ content_json: contentJson })
      .eq("item_id", existing.item_id);
    if (error) throw new Error(`dailies_payload update: ${error.message}`);

    // §10.2 LWW bump. A soft-deleted daily is restored — content written
    // into a trashed (invisible) daily would silently vanish, same rule as
    // write_briefing.
    await bumpMeta(existing.item_id, "daily", {
      is_deleted: false,
      deleted_at: null,
    });

    const { data: meta, error: mErr } = await client
      .from("items_meta")
      .select(META_COLUMNS)
      .eq("id", existing.item_id)
      .maybeSingle();
    if (mErr) throw new Error(`items_meta read: ${mErr.message}`);
    const metaRow = meta as { created_at: string; updated_at: string } | null;

    return {
      id: existing.item_id,
      date,
      content: contentJsonToString(contentJson),
      createdAt: metaRow?.created_at ?? null,
      updatedAt: metaRow?.updated_at ?? null,
    };
  }

  const id = `daily-${date}`;
  await insertItem({
    id,
    role: "daily",
    // items_meta.title is NOT NULL and a daily has no title of its own.
    title: date,
    payloadTable: "dailies_payload",
    payload: {
      date,
      content_json: contentJson,
      is_pinned: false,
      is_edit_locked: false,
    },
  });

  const meta = await findMeta(id, "daily");
  return {
    id,
    date,
    content: contentJsonToString(contentJson),
    createdAt: meta?.created_at ?? null,
    updatedAt: meta?.updated_at ?? null,
  };
}
