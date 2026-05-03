import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { playersTable } from "./players";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToPlayerId: integer("assigned_to_player_id").references(() => playersTable.id, { onDelete: "set null" }),
  dueDate: text("due_date"),
  status: text("status", { enum: ["pending", "in_progress", "done"] }).notNull().default("pending"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
