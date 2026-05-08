import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { usersTable } from "./users";
import { teamInvitationsTable } from "./team_invitations";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["coach", "player", "assistant"] }).notNull().default("player"),
  placeholderFullName: text("placeholder_full_name"),
  placeholderEmail: text("placeholder_email"),
  placeholderPhone: text("placeholder_phone"),
  invitationId: integer("invitation_id").references(() => teamInvitationsTable.id, { onDelete: "set null" }),
  jerseyNumber: integer("jersey_number"),
  position: text("position"),
  memberNotes: text("member_notes"),
  status: text("status", { enum: ["active", "inactive", "pending_invitation", "invited", "declined"] }).default("active"),
  coachTitle: text("coach_title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("team_members_team_user_unique").on(t.teamId, t.userId).where(isNotNull(t.userId)),
]);

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({ id: true, createdAt: true });
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;
