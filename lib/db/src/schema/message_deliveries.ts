import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { messagesTable } from "./messages";
import { usersTable } from "./users";

export const messageDeliveriesTable = pgTable("message_deliveries", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["in_app", "email", "whatsapp"] }).notNull(),
  status: text("status", { enum: ["pending", "sent", "read", "failed"] }).default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  errorDetail: text("error_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("message_deliveries_unique").on(t.messageId, t.userId, t.channel),
]);

export type MessageDelivery = typeof messageDeliveriesTable.$inferSelect;
