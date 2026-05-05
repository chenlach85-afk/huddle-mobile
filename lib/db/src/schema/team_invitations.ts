import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const teamInvitationsTable = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  invitedByUserId: integer("invited_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  inviteType: text("invite_type", { enum: ["email", "link"] }).notNull().default("email"),
  email: text("email"),
  status: text("status", { enum: ["pending", "accepted", "revoked", "expired"] }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: integer("accepted_by_user_id"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TeamInvitation = typeof teamInvitationsTable.$inferSelect;
