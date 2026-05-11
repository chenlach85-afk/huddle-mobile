import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role", { enum: ["coach", "player", "admin"] }).notNull().default("coach"),
  senderUserId: integer("sender_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title"),
  messageType: text("message_type", { enum: ["announcement", "reminder", "urgent", "general"] }).default("general"),
  targetAudience: text("target_audience", { enum: ["all", "players_only", "specific_players"] }).default("all"),
  channels: jsonb("channels").$type<{ in_app: boolean; email: boolean; whatsapp: boolean }>().default({ in_app: true, email: false, whatsapp: false }),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
