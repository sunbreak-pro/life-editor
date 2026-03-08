export interface WikiTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiTagAssignment {
  tagId: string;
  entityId: string;
  entityType: "task" | "memo" | "note";
  source: "inline" | "manual";
  createdAt: string;
}

export type WikiTagEntityType = "task" | "memo" | "note";
