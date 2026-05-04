import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const platformInvitationsTable = pgTable("platform_invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  invitedRole: text("invited_role", { enum: ["coach", "admin"] }).notNull(),
  invitedByUserId: integer("invited_by_user_id").notNull(),
  status: text("status", { enum: ["pending", "accepted", "revoked", "expired"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: integer("accepted_by_user_id"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformInvitation = typeof platformInvitationsTable.$inferSelect;
