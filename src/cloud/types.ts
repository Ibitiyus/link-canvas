import type { Project } from "../model/types";
export interface Profile {
  id: string;
  username: string;
}
export interface Draft {
  owner_id: string;
  project: Project;
  revision: number;
  updated_at: string;
}
export interface PublishedPage {
  owner_id: string;
  username: string;
  project: Project;
  source_revision: number;
  published_at: string;
}
export type SyncStatus =
  "loading" | "local" | "saved" | "saving" | "pending" | "error" | "conflict";
