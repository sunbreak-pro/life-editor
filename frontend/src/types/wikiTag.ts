export interface WikiTag {
  id: string;
  name: string;
  color: string;
  textColor?: string;
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

export interface WikiTagConnection {
  id: string;
  sourceTagId: string;
  targetTagId: string;
  createdAt: string;
}

export interface WikiTagGroup {
  id: string;
  name: string;
  filterTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiTagGroupMember {
  groupId: string;
  noteId: string;
}

export interface NoteConnection {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  createdAt: string;
}
