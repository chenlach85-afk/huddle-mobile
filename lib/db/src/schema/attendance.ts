import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { playersTable } from "./players";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["attending", "not_attending", "maybe", "no_response"] }).notNull().default("no_response"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique().on(t.eventId, t.playerId),
]);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, updatedAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
