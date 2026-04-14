export interface Template {
  id: string;
  name: string;
  content: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
