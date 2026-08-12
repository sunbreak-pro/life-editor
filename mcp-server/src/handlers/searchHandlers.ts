import { getSupabase } from "../supabase.js";
import {
  contentPlainText,
  contentPreview,
  PREVIEW_LENGTH,
} from "../utils/content.js";
import { META_COLUMNS, type ItemsMetaRow } from "../utils/items.js";
import { fetchByIdChunks } from "../utils/pagination.js";
import { fetchLiveNotes } from "./noteHandlers.js";
import { fetchLiveDailies } from "./dailyHandlers.js";

/*
 * search_all — Supabase edition (#360).
 *
 * Two matching strategies, picked per domain by what the column type
 * allows:
 *   - tasks: `items_meta.title` and `tasks_payload.content` are TEXT, so
 *     both sides filter server-side with `ilike` and the union is merged
 *     in-app (PostgREST cannot OR across two tables in one request).
 *   - notes / dailies: bodies live in `content_json` (jsonb), which has no
 *     `ilike`. Those domains pull the live collection and match the
 *     extracted plain text — more accurate than the legacy LIKE over raw
 *     TipTap JSON, which also matched node names like "paragraph".
 */

const VALID_DOMAINS = ["tasks", "dailies", "notes"] as const;
type Domain = (typeof VALID_DOMAINS)[number];

interface TasksPayloadRow {
  item_id: string;
  task_type: "folder" | "task" | null;
  status: string | null;
  scheduled_at: string | null;
  content: string | null;
}

const TASK_PAYLOAD_COLUMNS =
  "item_id, task_type, status, scheduled_at, content";

/** Tasks whose title OR content matches, newest first, capped at `limit`. */
async function searchTasks(pattern: string, limit: number) {
  const { client } = await getSupabase();

  const [{ data: titleRows, error: tErr }, { data: contentRows, error: cErr }] =
    await Promise.all([
      client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("role", "task")
        .eq("is_deleted", false)
        .ilike("title", pattern)
        .order("created_at", { ascending: false })
        .limit(limit),
      client
        .from("tasks_payload")
        .select(TASK_PAYLOAD_COLUMNS)
        .eq("task_type", "task")
        .ilike("content", pattern)
        .limit(limit),
    ]);
  if (tErr) throw new Error(`search task items_meta: ${tErr.message}`);
  if (cErr) throw new Error(`search tasks_payload: ${cErr.message}`);

  const metaById = new Map<string, ItemsMetaRow>();
  for (const m of (titleRows ?? []) as unknown as ItemsMetaRow[])
    metaById.set(m.id, m);

  const payloadById = new Map<string, TasksPayloadRow>();
  for (const p of (contentRows ?? []) as unknown as TasksPayloadRow[])
    payloadById.set(p.item_id, p);

  // Fill in each half's missing side: payloads for title-only hits, live
  // metas for content-only hits (a content hit on a trashed task drops out).
  const missingPayloadIds = [...metaById.keys()].filter(
    (id) => !payloadById.has(id),
  );
  const missingMetaIds = [...payloadById.keys()].filter(
    (id) => !metaById.has(id),
  );

  const [extraPayloads, extraMetas] = await Promise.all([
    fetchByIdChunks<TasksPayloadRow>(missingPayloadIds, async (chunk) => {
      const { data, error } = await client
        .from("tasks_payload")
        .select(TASK_PAYLOAD_COLUMNS)
        .in("item_id", chunk);
      if (error) throw new Error(`search tasks_payload: ${error.message}`);
      return (data ?? []) as unknown as TasksPayloadRow[];
    }),
    fetchByIdChunks<ItemsMetaRow>(missingMetaIds, async (chunk) => {
      const { data, error } = await client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("role", "task")
        .eq("is_deleted", false)
        .in("id", chunk);
      if (error) throw new Error(`search task items_meta: ${error.message}`);
      return (data ?? []) as unknown as ItemsMetaRow[];
    }),
  ]);
  for (const p of extraPayloads) payloadById.set(p.item_id, p);
  for (const m of extraMetas) metaById.set(m.id, m);

  const merged = [];
  for (const [id, meta] of metaById) {
    const payload = payloadById.get(id);
    if (!payload) continue;
    // A title hit can land on a retired folder row (task_type lives on the
    // payload, so the items_meta query cannot exclude it) — S3 #225.
    if (payload.task_type === "folder") continue;
    merged.push({
      id,
      title: meta.title,
      status: payload.status === null ? null : payload.status.toLowerCase(),
      scheduledAt: payload.scheduled_at,
      contentPreview: contentPreview(payload.content),
      createdAt: meta.created_at,
    });
  }
  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return merged
    .slice(0, limit)
    .map(({ createdAt: _createdAt, ...rest }) => rest);
}

export async function searchAll(args: {
  query: string;
  domains?: string[];
  limit?: number;
}) {
  const limit = args.limit ?? 10;
  const domains: Domain[] = args.domains
    ? (args.domains.filter((d) =>
        VALID_DOMAINS.includes(d as Domain),
      ) as Domain[])
    : [...VALID_DOMAINS];

  const needle = args.query.toLowerCase();
  const result: Record<string, unknown[]> = {};
  let totalHits = 0;

  if (domains.includes("tasks")) {
    const tasks = await searchTasks(`%${args.query}%`, limit);
    result.tasks = tasks;
    totalHits += tasks.length;
  }

  if (domains.includes("dailies")) {
    const dailies = (await fetchLiveDailies())
      .map((d) => ({
        date: d.payload.date,
        text: contentPlainText(d.payload.content_json),
      }))
      .filter((d) => d.text.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((d) => ({
        date: d.date,
        contentPreview: d.text.slice(0, PREVIEW_LENGTH),
      }));
    result.dailies = dailies;
    totalHits += dailies.length;
  }

  if (domains.includes("notes")) {
    const notes = (await fetchLiveNotes())
      .map((n) => ({
        id: n.meta.id,
        title: n.meta.title,
        updatedAt: n.meta.updated_at,
        text: contentPlainText(n.payload.content_json),
      }))
      .filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.text.toLowerCase().includes(needle),
      )
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        title: n.title,
        contentPreview: n.text.slice(0, PREVIEW_LENGTH),
        updatedAt: n.updatedAt,
      }));
    result.notes = notes;
    totalHits += notes.length;
  }

  return { ...result, totalHits };
}
