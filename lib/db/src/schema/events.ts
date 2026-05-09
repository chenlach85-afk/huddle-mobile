import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const EVENT_TYPES = [
  "training",
  "league_game",
  "friendly_game",
  "tournament",
  "celebration",
  "meeting",
  "other",
] as const;

export type EventType = typeof EVENT_TYPES[number];

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type", { enum: EVENT_TYPES }).notNull().default("training"),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  notes: text("notes"),
  opponent: text("opponent"),
  isHome: boolean("is_home"),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }),
  uniformColor: text("uniform_color"),
  uniformSecondaryColor: text("uniform_secondary_color"),
  uniformNotes: text("uniform_notes"),
  whatToBring: text("what_to_bring"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
