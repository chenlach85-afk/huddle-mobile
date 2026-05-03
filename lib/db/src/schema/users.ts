import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["coach", "player", "admin"] }).notNull().default("coach"),
  language: text("language", { enum: ["en", "he", "es"] }).notNull().default("en"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(false),
  calendarReminderMinutes: text("calendar_reminder_minutes").notNull().default("30"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
