export type NoteLinkType = "inline" | "embed";

export interface NoteLink {
  id: string;
  sourceNoteId: string | null;
  sourceMemoDate: string | null;
  targetNoteId: string;
  targetHeading: string | null;
  targetBlockId: string | null;
  alias: string | null;
  linkType: NoteLinkType;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  isDeleted: number;
  deletedAt: string | null;
}

export interface NoteLinkPayload {
  targetNoteId: string;
  targetHeading?: string | null;
  targetBlockId?: string | null;
  alias?: string | null;
  linkType?: NoteLinkType;
}

export interface BacklinkHit {
  link: NoteLink;
  sourceTitle: string | null;
  sourcePreview: string | null;
}

export interface UnlinkedMention {
  sourceNoteId: string;
  sourceTitle: string;
  matchText: string;
}
