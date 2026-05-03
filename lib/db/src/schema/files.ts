import { pgTable, text, serial, timestamp, integer, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { teamsTable } from "./teams";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  uploaderId: integer("uploader_id").references(() => usersTable.id, { onDelete: "set null" }),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  url: text("url").notNull(),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({ id: true, createdAt: true });
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof filesTable.$inferSelect;
