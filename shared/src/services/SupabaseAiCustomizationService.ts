import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCustomizationDataService } from "./DataService";
import type {
  AiMemory,
  AiRule,
  AiSkill,
  AiSkillInput,
} from "../types/aiCustomization";
import {
  AI_MEMORY_COLUMNS,
  AI_RULE_COLUMNS,
  AI_SKILL_COLUMNS,
  aiMemoryToInsert,
  aiRuleToUpsert,
  aiSkillToInsert,
  aiSkillUpdatesToPatch,
  rowToAiMemory,
  rowToAiRule,
  rowToAiSkill,
  type AiMemoryRow,
  type AiRuleRow,
  type AiSkillRow,
} from "./aiCustomizationMapper";
import {
  AiCustomizationValidationError,
  aiMemoryBodyIssue,
  aiRuleBodyIssue,
  aiSkillIssues,
  throwFirstAiIssue,
} from "./aiCustomizationLimits";
import { fetchAllPages } from "./postgrestFetchAll";
import { fetchMaybeSingleRow, requireSingleRow } from "./postgrestSingle";
import { generateId } from "../utils/generateId";

/*
 * SupabaseAiCustomizationService (#2118). I/O over the three independent
 * tables of 0037 — ai_rules (one row per user), ai_memories, ai_skills. Pure
 * mapping is aiCustomizationMapper.ts, the limits aiCustomizationLimits.ts.
 * `user_id` is never written (DB default auth.uid()); RLS scopes every read.
 *
 * Every write is checked against the 0037 limits first, so a refusal arrives
 * as an AiCustomizationValidationError naming the field rather than as a raw
 * CHECK violation. The DB CHECKs stay the last word.
 *
 * Deletes are physical: none of the three goes to the Trash (0037 header).
 */

/** Postgres unique_violation — the (user_id, slug) UNIQUE of ai_skills. */
const UNIQUE_VIOLATION = "23505";

export class SupabaseAiCustomizationService implements AiCustomizationDataService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Rules (one document per user)
  // -------------------------------------------------------------------------

  /** null = nothing saved yet. A read never creates the row (#499). */
  async fetchAiRule(): Promise<AiRule | null> {
    const row = await fetchMaybeSingleRow<AiRuleRow>(
      this.client.from("ai_rules").select(AI_RULE_COLUMNS).maybeSingle(),
      "fetchAiRule failed",
    );
    return row ? rowToAiRule(row) : null;
  }

  async saveAiRule(body: string): Promise<AiRule> {
    const label = "saveAiRule";
    const issue = aiRuleBodyIssue(body);
    if (issue) throw new AiCustomizationValidationError("body", issue, label);
    const now = new Date().toISOString();
    const data = await requireSingleRow<AiRuleRow>(
      this.client
        .from("ai_rules")
        .upsert(aiRuleToUpsert(body, now), { onConflict: "user_id" })
        .select(AI_RULE_COLUMNS)
        .single(),
      `${label} failed`,
    );
    return rowToAiRule(data);
  }

  // -------------------------------------------------------------------------
  // Memories (one item per row)
  // -------------------------------------------------------------------------

  async fetchAiMemories(): Promise<AiMemory[]> {
    // Trailing .order("id") = unique tiebreaker so .range() pages are
    // deterministic (sort_order can tie).
    const rows = await fetchAllPages<AiMemoryRow>(
      (from, to) =>
        this.client
          .from("ai_memories")
          .select(AI_MEMORY_COLUMNS)
          .order("sort_order", { ascending: true })
          .order("id")
          .range(from, to),
      "fetchAiMemories failed",
    );
    return rows.map(rowToAiMemory);
  }

  /** Appends at the end of the list (sort_order = current max + 1). */
  async createAiMemory(body: string): Promise<AiMemory> {
    const label = "createAiMemory";
    const issue = aiMemoryBodyIssue(body);
    if (issue) throw new AiCustomizationValidationError("body", issue, label);
    const last = await fetchMaybeSingleRow<{ sort_order: number }>(
      this.client
        .from("ai_memories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle(),
      `${label} read failed`,
    );
    const data = await requireSingleRow<AiMemoryRow>(
      this.client
        .from("ai_memories")
        .insert(
          aiMemoryToInsert(
            generateId("aimemory"),
            body,
            (last?.sort_order ?? -1) + 1,
          ),
        )
        .select(AI_MEMORY_COLUMNS)
        .single(),
      `${label} failed`,
    );
    return rowToAiMemory(data);
  }

  async updateAiMemory(id: string, body: string): Promise<AiMemory> {
    const label = `updateAiMemory (id=${id})`;
    const issue = aiMemoryBodyIssue(body);
    if (issue) throw new AiCustomizationValidationError("body", issue, label);
    const data = await requireSingleRow<AiMemoryRow>(
      this.client
        .from("ai_memories")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(AI_MEMORY_COLUMNS)
        .single(),
      `${label} failed`,
    );
    return rowToAiMemory(data);
  }

  /**
   * Rewrite sort_order to match `ids` (index = sort_order). One UPDATE per
   * item — PostgREST has no batch-by-position update, and the list is short
   * (reorderPlaylistItems does the same).
   */
  async reorderAiMemories(ids: readonly string[]): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await this.client
        .from("ai_memories")
        .update({ sort_order: i, updated_at: now })
        .eq("id", ids[i]);
      if (error)
        throw new Error(
          `reorderAiMemories (id=${ids[i]}) failed: ${error.message}`,
        );
    }
  }

  async deleteAiMemory(id: string): Promise<void> {
    const { error } = await this.client
      .from("ai_memories")
      .delete()
      .eq("id", id);
    if (error)
      throw new Error(`deleteAiMemory (id=${id}) failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Claude skills (one SKILL.md per row)
  // -------------------------------------------------------------------------

  async fetchAiSkills(): Promise<AiSkill[]> {
    const rows = await fetchAllPages<AiSkillRow>(
      (from, to) =>
        this.client
          .from("ai_skills")
          .select(AI_SKILL_COLUMNS)
          .order("slug", { ascending: true })
          .order("id")
          .range(from, to),
      "fetchAiSkills failed",
    );
    return rows.map(rowToAiSkill);
  }

  /** A slug another of the user's skills has is refused as `taken`. */
  async createAiSkill(input: AiSkillInput): Promise<AiSkill> {
    const label = "createAiSkill";
    throwFirstAiIssue(aiSkillIssues(input), label);
    const { data, error } = await this.client
      .from("ai_skills")
      .insert(aiSkillToInsert(generateId("aiskill"), input))
      .select(AI_SKILL_COLUMNS)
      .single();
    if (error) throw skillWriteError(error, label);
    return rowToAiSkill(data as unknown as AiSkillRow);
  }

  async updateAiSkill(
    id: string,
    updates: Partial<AiSkillInput>,
  ): Promise<AiSkill> {
    const label = `updateAiSkill (id=${id})`;
    throwFirstAiIssue(aiSkillIssues(updates), label);
    const { data, error } = await this.client
      .from("ai_skills")
      .update(aiSkillUpdatesToPatch(updates, new Date().toISOString()))
      .eq("id", id)
      .select(AI_SKILL_COLUMNS)
      .single();
    if (error) throw skillWriteError(error, label);
    return rowToAiSkill(data as unknown as AiSkillRow);
  }

  async deleteAiSkill(id: string): Promise<void> {
    const { error } = await this.client.from("ai_skills").delete().eq("id", id);
    if (error)
      throw new Error(`deleteAiSkill (id=${id}) failed: ${error.message}`);
  }
}

/** The slug UNIQUE becomes `taken`; anything else keeps the plain wording. */
function skillWriteError(
  error: { message: string; code?: string },
  label: string,
): Error {
  if (error.code === UNIQUE_VIOLATION)
    return new AiCustomizationValidationError("slug", "taken", label);
  return new Error(`${label} failed: ${error.message}`);
}

export const PHASE2_AI_CUSTOMIZATION_METHOD_NAMES = [
  "fetchAiRule",
  "saveAiRule",
  "fetchAiMemories",
  "createAiMemory",
  "updateAiMemory",
  "reorderAiMemories",
  "deleteAiMemory",
  "fetchAiSkills",
  "createAiSkill",
  "updateAiSkill",
  "deleteAiSkill",
] as const;

export type AiCustomizationMethodName =
  (typeof PHASE2_AI_CUSTOMIZATION_METHOD_NAMES)[number];

export const PHASE2_AI_CUSTOMIZATION_METHODS: ReadonlySet<string> = new Set(
  PHASE2_AI_CUSTOMIZATION_METHOD_NAMES,
);
